import type { H3Event } from 'h3'
import { kindOf } from '#shared/utils/search'
import { resolveAccess, type AccessContext } from '../domain/access'
import type { Resource } from '../database/schema'
import type { StorageProvider } from '../lib/storage/types'

const frameAncestors = () => `frame-ancestors ${new URL(useRuntimeConfig().public.appUrl).origin}`

function pagePolicy(resource: Resource) {
  return resource.allowScripts
    ? `sandbox allow-scripts allow-popups allow-forms allow-modals allow-downloads; default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; ${frameAncestors()}`
    : `sandbox allow-popups allow-popups-to-escape-sandbox; default-src 'none'; img-src * data: blob:; style-src * 'unsafe-inline'; font-src * data:; media-src * data: blob:; ${frameAncestors()}`
}

/** Converted documents are self-contained: nothing may load from elsewhere, not even an image. */
const previewPolicy = () => `sandbox allow-popups allow-popups-to-escape-sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'; ${frameAncestors()}`

interface Source {
  key: string
  policy: string
  contentType: string
  document: boolean
}

type Served =
  | { redirect: string }
  | { resource: Resource, document: boolean, stream: () => ReturnType<StorageProvider['get']> }

const HTML = 'text/html; charset=utf-8'

async function sourceOf(resource: Resource, path: string, previews: boolean): Promise<Source | { folder: true } | null> {
  if (isSite(resource)) {
    const file = await siteEntry(resource.id, path)
    if (file) return { key: file.storageKey, policy: pagePolicy(resource), contentType: file.mimeType, document: file.mimeType === 'text/html' }
    return path && !path.endsWith('/') && await siteHasFolder(resource.id, path) ? { folder: true } : null
  }
  if (path !== '' && path !== 'index.html') return null
  if (kindOf(resource.type, resource.mimeType) === 'html' && resource.storageKey) return { key: resource.storageKey, policy: pagePolicy(resource), contentType: HTML, document: true }
  if (previews && resource.previewKey) return { key: resource.previewKey, policy: previewPolicy(), contentType: HTML, document: true }
  return null
}

const refuse = (statusCode: number, message: string) => createError({ statusCode, statusMessage: message })

/**
 * Serves an HTML page, the HTML preview of a document or a file of a static site from the isolated origin: no cookies
 * ever, a sandbox CSP so pages run in an opaque origin, and scripts only when the owner made the page interactive.
 * Access is checked before anything about the content, even whether a path exists, is revealed.
 */
export async function serveHtmlPage(event: H3Event, ctx: AccessContext, resourceId: string, options: { previews?: boolean } = {}): Promise<Served> {
  const resource = await findResource(resourceId)
  if (!resource) throw refuse(404, 'Not Found')
  const chain = await loadChain(resource)
  const rules = ctx.isOwner ? [] : await loadRules(chain.map(r => r.id))
  if (!resolveAccess(ctx, chain.map(toAccessNode), rules).read) throw refuse(403, 'Access revoked')

  const param = getRouterParam(event, 'path', { decode: true }) ?? ''
  const path = param && getRequestURL(event).pathname.endsWith('/') ? `${param}/` : param
  const source = await sourceOf(resource, path, options.previews ?? false)
  if (!source) throw refuse(404, 'Not Found')
  if ('folder' in source) return { redirect: `${getRequestURL(event).pathname}/` }

  setResponseHeaders(event, {
    'Content-Type': source.contentType,
    'Content-Security-Policy': source.policy,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'private, no-store',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    ...(isSite(resource) ? { 'Access-Control-Allow-Origin': '*' } : {}),
  })
  return { resource, document: source.document, stream: () => useStorageProvider().get(source.key) }
}
