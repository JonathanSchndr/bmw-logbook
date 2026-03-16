import { connectDB } from '../../utils/db'
import { SettingsModel } from '../../models/Settings'

// PKCE helpers
function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.floor(Math.random() * 256)
  }
  return Buffer.from(array)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Buffer.from(digest)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// In-memory store for code_verifier (short-lived, for the auth flow)
// In production, use a session store
const pendingFlows = new Map<string, { codeVerifier: string; expiresAt: number }>()

export default defineEventHandler(async (event) => {
  try {
    await connectDB()

    const body = await readBody(event) as { clientId?: string }
    const clientId = body?.clientId?.trim()

    if (!clientId) {
      throw createError({ statusCode: 400, message: 'clientId is required' })
    }

    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'device_code',
      scope: 'authenticate_user openid cardata:api:read cardata:streaming:read',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    })

    const response = await fetch('https://customer.bmwgroup.com/gcdm/oauth/device/code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[Auth] Device code request failed:', response.status, text)
      throw createError({
        statusCode: response.status,
        message: `BMW API error: ${text}`,
      })
    }

    const data = await response.json() as {
      device_code: string
      user_code: string
      verification_uri: string
      verification_uri_complete?: string
      expires_in: number
      interval: number
    }

    // Store code_verifier mapped to device_code for the token exchange step
    pendingFlows.set(data.device_code, {
      codeVerifier,
      expiresAt: Date.now() + data.expires_in * 1000,
    })

    // Clean up expired flows
    for (const [key, val] of pendingFlows.entries()) {
      if (val.expiresAt < Date.now()) pendingFlows.delete(key)
    }

    // Save client ID to settings
    let settings = await SettingsModel.findOne()
    if (!settings) {
      settings = new SettingsModel()
    }
    settings.bmwClientId = clientId
    await settings.save()

    return {
      device_code: data.device_code,
      user_code: data.user_code,
      verification_uri: data.verification_uri,
      verification_uri_complete: data.verification_uri_complete || data.verification_uri,
      expires_in: data.expires_in,
      interval: data.interval || 5,
      // Return code_verifier so the client can use it in the token exchange
      // This is safe since it's only useful alongside the specific device_code
      code_verifier: codeVerifier,
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, message: err.message })
  }
})

// Export the pendingFlows so the token endpoint can access it
export { pendingFlows }
