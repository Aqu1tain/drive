import type { H3Event } from 'h3'
import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm'
import { kindOf } from '#shared/utils/search'
import type { ActivityEvent, ActivityStats } from '#shared/types/api'
import type { MessageKey } from '#shared/i18n'
import { hashIp } from '../lib/crypto'
import type { AccessEvent, Resource } from '../database/schema'

const { accessEvents, resources } = tables

const VIEW_DEDUP_MS = 10 * 60 * 1000

/** Fixed labels are stored as tokens and named in the reader's language; rows written before hold the French words. */
export const ACTIVITY_LABELS = { publicLink: '@public-link', inheritRestored: '@inherit-restored', inheritRemoved: '@inherit-removed' } as const
const LABEL_KEYS: Record<string, MessageKey> = {
  '@public-link': 'labels.publicLink',
  'Lien public': 'labels.publicLink',
  '@inherit-restored': 'labels.inheritRestored',
  'Accès hérités rétablis': 'labels.inheritRestored',
  '@inherit-removed': 'labels.inheritRemoved',
  'Accès hérités retirés': 'labels.inheritRemoved',
}
const readLabel = <T extends string | null>(label: T) => (label && LABEL_KEYS[label] ? tr(LABEL_KEYS[label]) : label) as T

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
  return { actorKind: 'link', actorLabel: ACTIVITY_LABELS.publicLink, accessRuleId: viewer.linkRule?.id, visitorId: viewer.visitorId }
}

function sameActor(actor: Actor, ipHash: string | null) {
  if (actor.userId) return eq(accessEvents.userId, actor.userId)
  if (actor.invitationId) return eq(accessEvents.invitationId, actor.invitationId)
  if (actor.visitorId) return eq(accessEvents.visitorId, actor.visitorId)
  return ipHash ? eq(accessEvents.ipHash, ipHash) : undefined
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
  const traits = networkTraits(event)
  const identity = sameActor(actor, traits.ipHash)
  if (type === 'view' && identity) {
    const [recent] = await db.select({ id: accessEvents.id }).from(accessEvents).where(and(
      eq(accessEvents.resourceId, resource.id),
      eq(accessEvents.type, 'view'),
      identity,
      gt(accessEvents.createdAt, new Date(Date.now() - VIEW_DEDUP_MS)),
    )).limit(1)
    if (recent) return
  }

  await db.insert(accessEvents).values({ resourceId: resource.id, type, ...actor, ...traits })
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

/** Views and downloads of a resource; for a folder, of everything inside it too. */
export function activityScope(resource: Resource) {
  return resource.type === 'folder'
    ? sql`${accessEvents.resourceId} in (select id from ${resources} where id = ${resource.id} or ancestor_ids @> array[${resource.id}::uuid])`
    : eq(accessEvents.resourceId, resource.id)
}

export async function activityStats(resource: Resource): Promise<ActivityStats> {
  const db = useDB()
  const scope = activityScope(resource)
  const [counts] = await db.select({
    views: sql<number>`count(*) filter (where ${accessEvents.type} = 'view')::int`,
    downloads: sql<number>`count(*) filter (where ${accessEvents.type} = 'download')::int`,
    visitors: sql<number>`count(distinct coalesce(${accessEvents.userId}, ${accessEvents.invitationId}::text, ${accessEvents.visitorId}, ${accessEvents.ipHash})) filter (where ${accessEvents.type} in ('view', 'download'))::int`,
  }).from(accessEvents).where(scope)
  const [last] = await db.select({ at: accessEvents.createdAt, by: accessEvents.actorLabel }).from(accessEvents)
    .where(and(scope, eq(accessEvents.type, 'view'))).orderBy(desc(accessEvents.createdAt)).limit(1)
  return {
    views: counts?.views ?? 0,
    downloads: counts?.downloads ?? 0,
    visitors: counts?.visitors ?? 0,
    lastViewAt: last?.at.toISOString() ?? null,
    lastViewBy: last ? readLabel(last.by) : null,
  }
}

export async function toActivityEvents(events: AccessEvent[]): Promise<ActivityEvent[]> {
  const ids = [...new Set(events.map(e => e.resourceId).filter((id): id is string => !!id))]
  const rows = ids.length ? await useDB().select().from(resources).where(inArray(resources.id, ids)) : []
  const byId = new Map(rows.map(r => [r.id, r]))
  return events.map((event) => {
    const resource = event.resourceId ? byId.get(event.resourceId) : undefined
    return {
      id: event.id,
      type: event.type,
      actorKind: event.actorKind,
      actorLabel: readLabel(event.actorLabel),
      targetLabel: readLabel(event.targetLabel),
      resource: resource ? { id: resource.id, name: resource.name, type: resource.type, kind: kindOf(resource.type, resource.mimeType) } : null,
      createdAt: event.createdAt.toISOString(),
    }
  })
}
