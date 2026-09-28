import { randomUUID } from 'node:crypto'

const USERCONTENT_PREFIXES = ['/c/', '/p/']

declare module 'h3' {
  interface H3EventContext {
    requestId: string
    startedAt: number
    origin: 'app' | 'usercontent'
    logResourceId?: string
  }
}

export default defineEventHandler((event) => {
  event.context.requestId = randomUUID()
  event.context.startedAt = performance.now()
  event.context.origin = isUsercontentHost(event) ? 'usercontent' : 'app'
  setResponseHeader(event, 'X-Request-Id', event.context.requestId)

  const isUsercontentPath = USERCONTENT_PREFIXES.some(prefix => event.path.startsWith(prefix))
  if (event.context.origin === 'usercontent' && !isUsercontentPath) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
  if (event.context.origin === 'app' && isUsercontentPath) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
})
