import type { H3Event } from 'h3'
import { and, eq, gt } from 'drizzle-orm'
import { hashIp } from '../lib/crypto'
import type { Resource } from '../database/schema'

const { accessEvents, resources } = tables

const VIEW_DEDUP_MS = 10 * 60 * 1000

interface Actor {
  actorKind: 'owner' | 'user' | 'invitation' | 'link'
  actorLabel: string
  userId?: string
  invitationId?: string
  accessRuleId?: string
  visitorId?: string
}

function actorOf(viewer: Viewer): Actor {
  if (viewer.user) {
    return { actorKind: viewer.kind === 'owner' ? 'owner' : 'user', actorLabel: viewer.user.name || viewer.user.email, userId: viewer.user.id }
  }
  if (viewer.invitation) {
    return {
      actorKind: 'invitation',
      actorLabel: viewer.invitation.name || viewer.invitation.email,
      invitationId: viewer.invitation.id,
      visitorId: viewer.visitorId,
    }
  }
  return { actorKind: 'link', actorLabel: 'Lien public', accessRuleId: viewer.linkRule?.id, visitorId: viewer.visitorId }
}

function sameActor(actor: Actor) {
  if (actor.userId) return eq(accessEvents.userId, actor.userId)
  if (actor.invitationId) return eq(accessEvents.invitationId, actor.invitationId)
  return actor.visitorId ? eq(accessEvents.visitorId, actor.visitorId) : undefined
}

function networkTraits(event: H3Event) {
  const { authSecret, activity } = useRuntimeConfig()
  const ip = getRequestIP(event, { xForwardedFor: true })
  return {
    ipHash: activity.ipMode === 'hash' && ip ? hashIp(ip, authSecret) : null,
    userAgent: getRequestHeader(event, 'user-agent')?.slice(0, 256) ?? null,
  }
}

/** One logical event per consultation: repeated views by the same actor within a short window are merged. */
export async function logAccess(event: H3Event, viewer: Viewer, resource: Resource, type: 'view' | 'download') {
  const db = useDB()
  if (viewer.kind === 'owner') {
    if (type === 'view') await db.update(resources).set({ ownerOpenedAt: new Date() }).where(eq(resources.id, resource.id))
    return
  }
  if (viewer.kind === 'share' && (await getSessionUser(event))?.role === 'owner') return

  const actor = actorOf(viewer)
  const identity = sameActor(actor)
  if (type === 'view' && identity) {
    const [recent] = await db.select({ id: accessEvents.id }).from(accessEvents).where(and(
      eq(accessEvents.resourceId, resource.id),
      eq(accessEvents.type, 'view'),
      identity,
      gt(accessEvents.createdAt, new Date(Date.now() - VIEW_DEDUP_MS)),
    )).limit(1)
    if (recent) return
  }

  await db.insert(accessEvents).values({ resourceId: resource.id, type, ...actor, ...networkTraits(event) })
  if (type === 'view') {
    await db.update(resources).set({ lastExternalViewAt: new Date() }).where(eq(resources.id, resource.id))
  }
}

export async function logOwnerAction(
  event: H3Event,
  viewer: Viewer,
  resourceId: string,
  type: 'share_added' | 'share_removed' | 'share_updated' | 'link_created' | 'link_updated' | 'link_removed',
  targetLabel: string,
) {
  await useDB().insert(accessEvents).values({ resourceId, type, targetLabel, ...actorOf(viewer), ...networkTraits(event) })
}

export async function logInvitationAccepted(event: H3Event, resourceIds: string[], label: string, userId: string) {
  if (resourceIds.length === 0) return
  await useDB().insert(accessEvents).values(resourceIds.map(resourceId => ({
    resourceId,
    type: 'invite_accepted' as const,
    actorKind: 'user' as const,
    actorLabel: label,
    userId,
    ...networkTraits(event),
  })))
}
