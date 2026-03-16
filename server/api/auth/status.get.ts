export default defineEventHandler(() => {
  return { passwordProtected: !!process.env.SITE_PASSWORD }
})
