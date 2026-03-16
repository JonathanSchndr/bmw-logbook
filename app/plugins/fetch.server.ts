// Forwards the browser's cookie to all internal SSR API calls.
// Without this, useFetch('/api/...') during SSR has no cookie and gets 401
// from the auth middleware, even though the page request itself was authenticated.
export default defineNuxtPlugin(() => {
  const headers = useRequestHeaders(['cookie'])
  if (headers.cookie) {
    globalThis.$fetch = $fetch.create({ headers })
  }
})
