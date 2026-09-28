const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export default defineEventHandler((event) => {
  if (SAFE_METHODS.has(event.method)) return
  if (!event.path.startsWith('/api/')) return
  assertSameOrigin(event)
})
