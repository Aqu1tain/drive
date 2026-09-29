import type { H3Event } from 'h3'
import { kindOf } from '#shared/utils/search'
import { resolveAccess, type AccessContext } from '../domain/access'
import type { Resource } from '../database/schema'

const frameAncestors = () => `frame-ancestors ${new URL(useRuntimeConfig().public.appUrl).origin}`

function pagePolicy(resource: Resource) {
  return resource.allowScripts
    ? `sandbox allow-scripts allow-popups allow-forms allow-modals allow-downloads; default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; ${frameAncestors()}`
    : `sandbox allow-popups allow-popups-to-escape-sandbox; default-src 'none'; img-src * data: blob:; style-src * 'unsafe-inline'; font-src * data:; media-src * data: blob:; ${frameAncestors()}`
}

/** Converted documents are self-contained: nothing may load from elsewhere, not even an image. */
const previewPolicy = () => `sandbox allow-popups allow-popups-to-escape-sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'; ${frameAncestors()}`

function sourceOf(resource: Resource, previews: boolean) {
  if (kindOf(resource.type, resource.mimeType) === 'html' && resource.storageKey) return { key: resource.storageKey, policy: pagePolicy(resource) }
  if (previews && resource.previewKey) return { key: resource.previewKey, policy: previewPolicy() }
  return null
}

const refuse = (statusCode: number, message: string) => createError({ statusCode, statusMessage: message })

/**
 * Serves an HTML resource, or the HTML preview of a document, from the isolated origin: no cookies ever, a sandbox
 * CSP so the page runs in an opaque origin, and scripts only when the owner published it as an interactive page.
 */
export async function serveHtmlPage(event: H3Event, ctx: AccessContext, resourceId: string, options: { previews?: boolean } = {}) {
  const path = getRouterParam(event, 'path') ?? ''
  if (path !== '' && path !== 'index.html') throw refuse(404, 'Not Found')

  const resource = await findResource(resourceId)
  const source = resource && sourceOf(resource, options.previews ?? false)
  if (!resource || !source) throw refuse(404, 'Not Found')
  const chain = await loadChain(resource)
  const rules = ctx.isOwner ? [] : await loadRules(chain.map(r => r.id))
  if (!resolveAccess(ctx, chain.map(toAccessNode), rules).read) throw refuse(403, 'Access revoked')

  setResponseHeaders(event, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': source.policy,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'private, no-store',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  })
  return { resource, stream: () => useStorageProvider().get(source.key) }
}
