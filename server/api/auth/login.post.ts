import { createHmac } from 'crypto'

export default defineEventHandler(async (event) => {
  const sitePassword = process.env.SITE_PASSWORD
  if (!sitePassword) {
    return { ok: true } // no password configured, always pass
  }

  const body = await readBody(event) as { password?: string }
  if (!body?.password || body.password !== sitePassword) {
    throw createError({ statusCode: 401, message: 'Wrong password' })
  }

  const secret = process.env.NUXT_SESSION_SECRET || 'fallback-secret'
  const token = createHmac('sha256', secret).update(sitePassword).digest('hex')

  setCookie(event, 'site-auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  return { ok: true }
})
