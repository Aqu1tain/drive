const TOKEN_SEGMENTS = /^\/(api\/s|s|invite|c|p)\/[^/?]+/

const redact = (path: string) => path.replace(TOKEN_SEGMENTS, '/$1/:token').replace(/\?.*$/, '')

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('afterResponse', (event) => {
    if (event.path.startsWith('/_nuxt/') || event.path.startsWith('/__nuxt')) return
    const { requestId, startedAt, auth, logResourceId } = event.context
    console.info(JSON.stringify({
      level: 'info',
      requestId,
      method: event.method,
      path: redact(event.path),
      status: getResponseStatus(event),
      latencyMs: startedAt ? Math.round(performance.now() - startedAt) : undefined,
      userId: auth?.user?.id,
      resourceId: logResourceId,
    }))
  })

  nitro.hooks.hook('error', (error, { event }) => {
    const status = (error as { statusCode?: number }).statusCode ?? 500
    if (status < 500) return
    console.error(JSON.stringify({
      level: 'error',
      requestId: event?.context.requestId,
      method: event?.method,
      path: event ? redact(event.path) : undefined,
      status,
      error: error.message,
      stack: error.stack,
    }))
  })
})
