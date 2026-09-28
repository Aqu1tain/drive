import type { H3Event } from 'h3'
import type { Readable } from 'node:stream'
import type { Resource } from '../database/schema'

/** Types a browser may render inline from the app origin without running anything. */
const INLINE_SAFE = [
  /^image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)$/,
  /^video\/(mp4|webm|ogg|quicktime)$/,
  /^audio\/(mpeg|mp4|ogg|wav|webm|flac|aac|x-m4a)$/,
  /^application\/pdf$/,
]

/** Rendered as source code rather than as a document. */
const AS_TEXT = [/^text\//, /\/(json|xml|yaml|x-yaml|javascript|x-sh|sql|toml)$/, /\+xml$/, /\+json$/]

const CONTENT_CSP = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox"

export function contentTypeFor(resource: Resource, disposition: 'inline' | 'attachment') {
  const mime = resource.mimeType ?? 'application/octet-stream'
  if (disposition === 'attachment') return mime
  if (mime === 'image/svg+xml') return mime
  if (INLINE_SAFE.some(p => p.test(mime))) return mime
  if (AS_TEXT.some(p => p.test(mime))) return 'text/plain; charset=utf-8'
  return null
}

export function contentDisposition(disposition: 'inline' | 'attachment', name: string) {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

function parseRange(header: string | undefined, size: number) {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/)
  if (!match || (!match[1] && !match[2])) return null

  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  if (start > end || start >= size) return 'invalid' as const
  return { start, end }
}

export async function sendResourceContent(event: H3Event, resource: Resource, disposition: 'inline' | 'attachment') {
  if (resource.type !== 'file' || !resource.storageKey) {
    throw createError({ statusCode: 404, statusMessage: 'Aucun contenu' })
  }

  const contentType = contentTypeFor(resource, disposition)
  const effective = contentType ? disposition : 'attachment'
  const size = resource.size
  const range = parseRange(getRequestHeader(event, 'range'), size)

  setResponseHeaders(event, {
    'Content-Type': contentType ?? 'application/octet-stream',
    'Content-Disposition': contentDisposition(effective, resource.name),
    'Content-Security-Policy': CONTENT_CSP,
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-cache',
    'ETag': `"${resource.checksum ?? resource.updatedAt.getTime()}"`,
  })

  if (range === 'invalid') {
    setResponseHeader(event, 'Content-Range', `bytes */${size}`)
    throw createError({ statusCode: 416, statusMessage: 'Range Not Satisfiable' })
  }

  const storage = useStorageProvider()
  if (range) {
    setResponseStatus(event, 206)
    setResponseHeaders(event, {
      'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
      'Content-Length': String(range.end - range.start + 1),
    })
    return streamBody(event, await storage.get(resource.storageKey, range))
  }

  setResponseHeader(event, 'Content-Length', String(size))
  if (event.method === 'HEAD') return null
  return streamBody(event, await storage.get(resource.storageKey))
}

/** Releases the storage stream (and its pooled socket) when the client goes away mid-transfer. */
export function streamBody(event: H3Event, body: Readable) {
  event.node.res.once('close', () => body.destroy())
  return sendStream(event, body)
}

export const isRangeContinuation = (event: H3Event) => /^bytes=[1-9]/.test(getRequestHeader(event, 'range') ?? '')
