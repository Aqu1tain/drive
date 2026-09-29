const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Called by AI clients from their own origin, never with cookies: a PKCE verifier or client credentials authenticate them. */
const OAUTH_CLIENT_ENDPOINTS = new Set(['/api/auth/oauth2/token', '/api/auth/oauth2/register'])

export default defineEventHandler((event) => {
  if (SAFE_METHODS.has(event.method)) return
  if (!event.path.startsWith('/api/')) return
  if (OAUTH_CLIENT_ENDPOINTS.has(getRequestURL(event).pathname)) return
  assertSameOrigin(event)
})
