export default defineEventHandler((event) => {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  }

  if (event.context.origin === 'app') {
    headers['Referrer-Policy'] = event.path.startsWith('/s/') || event.path.startsWith('/invite/') ? 'no-referrer' : 'strict-origin-when-cross-origin'
    headers['Cross-Origin-Opener-Policy'] = 'same-origin'
    headers['X-Frame-Options'] = 'DENY'
  }

  if (useRuntimeConfig().public.appUrl.startsWith('https://')) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
  }

  setResponseHeaders(event, headers)
})
