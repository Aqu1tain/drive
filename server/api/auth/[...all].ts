/** Better Auth only sees a web Request: hand it the client IP we trust, never one the client made up. */
export default defineEventHandler((event) => {
  const request = toWebRequest(event)
  const ip = getRequestIP(event, { xForwardedFor: useRuntimeConfig().trustProxy }) ?? ''
  const headers = new Headers(request.headers)
  headers.set('x-drive-client-ip', ip)
  return useAuth().handler(new Request(request, { headers }))
})
