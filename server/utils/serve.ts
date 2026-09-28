import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { kindOf } from '#shared/utils/search'
import type { PreviewInfo } from '#shared/types/api'
import { signPayload, verifyPayload } from '../lib/crypto'
import type { AccessContext } from '../domain/access'

const FRAME_TOKEN_TTL_MS = 30 * 60 * 1000
const FRAME_PURPOSE = 'usercontent'

interface FrameClaims {
  r: string
  o?: 1
  u?: string
  l?: string
  i?: string
  e: number
}

export function frameTokenFor(viewer: Viewer, resourceId: string) {
  const claims: FrameClaims = {
    r: resourceId,
    e: Date.now() + FRAME_TOKEN_TTL_MS,
    ...(viewer.ctx.isOwner ? { o: 1 as const } : {}),
    ...(viewer.ctx.userId && !viewer.ctx.isOwner ? { u: viewer.ctx.userId } : {}),
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

  if (claims.o) {
    const [owner] = await db.select().from(user).where(eq(user.role, 'owner')).limit(1)
    return owner?.status === 'active' ? { resourceId: claims.r, ctx: { isOwner: true, userId: owner.id } } : null
  }
  if (claims.u) {
    const [reader] = await db.select().from(user).where(eq(user.id, claims.u)).limit(1)
    return reader?.status === 'active' ? { resourceId: claims.r, ctx: { isOwner: false, userId: reader.id } } : null
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
  const kind = kindOf(resource.type, resource.mimeType)
  return {
    kind,
    contentUrl: `${viewer.apiBase}/resources/${resource.id}/content`,
    downloadUrl: access.download && resource.type === 'file' ? `${viewer.apiBase}/resources/${resource.id}/download` : null,
    frameUrl: kind === 'html' ? usercontentUrl(`/c/${frameTokenFor(viewer, resource.id)}/`) : null,
  }
}

export async function serveContent(event: H3Event, viewer: Viewer, id: string) {
  const { resource } = await requireReadable(viewer, id)
  event.context.logResourceId = resource.id
  return sendResourceContent(event, resource, 'inline')
}

export async function serveDownload(event: H3Event, viewer: Viewer, id: string) {
  const { resource, access } = await requireReadable(viewer, id)
  event.context.logResourceId = resource.id
  if (!access.download) throw createError({ statusCode: 403, statusMessage: 'Le téléchargement est désactivé pour ce partage' })
  if (!isRangeContinuation(event)) await logAccess(event, viewer, resource, 'download')
  return sendResourceContent(event, resource, 'attachment')
}

export async function serveThumbnail(event: H3Event, viewer: Viewer, id: string) {
  const { resource } = await requireReadable(viewer, id)
  if (resource.thumbnailStatus !== 'ready' || !resource.thumbnailKey) throw createError({ statusCode: 404, statusMessage: 'Pas de miniature' })
  setResponseHeaders(event, {
    'Content-Type': 'image/webp',
    'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  })
  return streamBody(event, await useStorageProvider().get(resource.thumbnailKey))
}
