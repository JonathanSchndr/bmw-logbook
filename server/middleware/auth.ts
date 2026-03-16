import { createHmac } from 'crypto'

const PUBLIC_PREFIXES = [
  '/login',           // login page
  '/api/auth/login',  // login API
  '/_nuxt/',          // JS/CSS bundles (needed to render the login page)
  '/__nuxt',          // Nuxt internals
  '/favicon',         // favicon
]

export default defineEventHandler((event) => {
  const sitePassword = process.env.SITE_PASSWORD
  // If no password is configured, allow everything through
  if (!sitePassword) return

  const path = getRequestURL(event).pathname

  if (PUBLIC_PREFIXES.some(p => path.startsWith(p))) return

  const secret = process.env.NUXT_SESSION_SECRET || 'fallback-secret'
  const expectedToken = createHmac('sha256', secret).update(sitePassword).digest('hex')
  const cookie = getCookie(event, 'site-auth')

  if (cookie !== expectedToken) {
    // API requests get 401, page requests get redirected to /login
    if (path.startsWith('/api/')) {
      throw createError({ statusCode: 401, message: 'Unauthorized' })
    }
    return sendRedirect(event, `/login?redirect=${encodeURIComponent(path)}`)
  }
})
