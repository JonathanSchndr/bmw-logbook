export default defineEventHandler((event) => {
  deleteCookie(event, 'site-auth', { path: '/' })
  return { ok: true }
})
