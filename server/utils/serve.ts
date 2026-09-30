import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import type { PreviewInfo } from '#shared/types/api'
import { signPayload, verifyPayload } from '../lib/crypto'
import type { AccessContext } from '../domain/access'

const FRAME_TOKEN_TTL_MS = 30 * 60 * 1000
const FRAME_PURPOSE = 'usercontent'

interface FrameClaims {
  r: string
  u?: string
  l?: string
  i?: string
  e: number
}

export function frameTokenFor(viewer: Viewer, resourceId: string) {
  const claims: FrameClaims = {
    r: resourceId,
    e: Date.now() + FRAME_TOKEN_TTL_MS,
    ...(viewer.ctx.userId ? { u: viewer.ctx.userId } : {}),
    ...(viewer.ctx.linkRuleId ? { l: viewer.ctx.linkRuleId } : {}),
    ...(viewer.ctx.invitation ? { i: viewer.ctx.invitation.id } : {}),
  }
  return signPayload(claims, useRuntimeConfig().authSecret, FRAME_PURPOSE)
}

/** Rebuilds the access context from a frame token; access is then re-resolved on every request so revocation is immediate. */
export async function contextFromFrameToken(token: string): Promise<{ resourceId: string, ctx: AccessContext } | null> {
  const claims = verifyPayload<FrameClaims>(token, useRuntimeConfig().authSecret, FRAME_PURPOSE)
  if (!claims || claims.e < Date.now()) return null
  const db = useDB()
  const { user, invitations } = tables

  if (claims.u) {
    const [person] = await db.select().from(user).where(eq(user.id, claims.u)).limit(1)
    if (person?.status !== 'active') return null
    const role = userRole(person.role)
    return { resourceId: claims.r, ctx: { isOwner: role === 'owner', isMember: role !== 'reader', userId: person.id } }
  }
  if (claims.i) {
    const [invitation] = await db.select().from(invitations).where(eq(invitations.id, claims.i)).limit(1)
    return invitation ? { resourceId: claims.r, ctx: { isOwner: false, invitation } } : null
  }
  if (claims.l) return { resourceId: claims.r, ctx: { isOwner: false, linkRuleId: claims.l } }
  return null
}

export async function openResource(event: H3Event, viewer: Viewer, id: string): Promise<PreviewInfo> {
  const { resource, access } = await requireReadable(viewer, id)
  await logAccess(event, viewer, resource, 'view')
  const kind = resourceKind(resource)
  return {
    item: toItem(resource, { viewer, access }),
    kind,
    scripts: kind === 'html' && resource.allowScripts,
    contentUrl: `${viewer.apiBase}/resources/${resource.id}/content`,
    downloadUrl: access.download ? `${viewer.apiBase}/resources/${resource.id}/download` : null,
    frameUrl: kind === 'html' || resource.previewKey ? usercontentUrl(`/c/${frameTokenFor(viewer, resource.id)}/`) : null,
  }
}

export async function serveContent(event: H3Event, viewer: Viewer, id: string) {
  const { resource } = await requireReadable(viewer, id)
  event.context.logResourceId = resource.id
  return sendResourceContent(event, resource, 'inline')
}

export async function serveDownload(event: H3Event, viewer: Viewer, id: string) {
  const { resource, access } = await requireReadable(viewer, id)
  if (resource.type === 'folder') return serveArchive(event, viewer, [resource.id])
  event.context.logResourceId = resource.id
  if (!access.download) throw createError({ statusCode: 403, statusMessage: tr('errors.downloadDisabled') })
  if (!isRangeContinuation(event)) await logAccess(event, viewer, resource, 'download')
  return sendResourceContent(event, resource, 'attachment')
}

export async function serveThumbnail(event: H3Event, viewer: Viewer, id: string) {
  const { resource } = await requireReadable(viewer, id)
  if (resource.thumbnailStatus !== 'ready' || !resource.thumbnailKey) throw createError({ statusCode: 404, statusMessage: tr('errors.noThumbnail') })
  setResponseHeaders(event, {
    'Content-Type': 'image/webp',
    'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  })
  return streamBody(event, await useStorageProvider().get(resource.thumbnailKey))
}
