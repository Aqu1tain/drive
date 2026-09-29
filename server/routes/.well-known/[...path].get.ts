/**
 * OAuth discovery for AI clients, at the root of the app origin. The authorization server lives under /api/auth, so
 * Better Auth answers the path-inserted variants itself; the bare document is for clients that only look at the root.
 */
export default defineEventHandler((event) => {
  if (!mcpResource()) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  const request = toWebRequest(event)
  if (getRequestURL(event).pathname === '/.well-known/oauth-authorization-server') return useAuth().api.getOAuthServerConfig({ request })
  return useAuth().handler(request)
})
