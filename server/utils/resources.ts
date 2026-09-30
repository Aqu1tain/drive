import { and, asc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm'
import { kindOf } from '#shared/utils/search'
import type { AccessPerson, AccessSummary, ResourceItem } from '#shared/types/api'
import { effectiveRules, isExpired, resolveAccess, type Access, type AccessNode } from '../domain/access'
import type { AccessRule, Resource } from '../database/schema'

const { resources, accessRules, invitations, user } = tables

export type RuleStatus = 'active' | 'pending' | 'disabled' | 'expired' | 'revoked'

export interface RuleRow {
  rule: AccessRule
  person: AccessPerson | null
  /** The share goes to a member of the organization, who can be given more than reading. */
  member: boolean
  active: boolean
  status: RuleStatus
  invitationMode: 'account' | 'link' | null
  invitationTokenSealed: string | null
}

export async function findResource(id: string) {
  if (!isUuid(id)) return null
  const [row] = await useDB().select().from(resources).where(eq(resources.id, id)).limit(1)
  return row ?? null
}

/** The resource followed by its ancestors, from the closest parent up to the root. */
export async function loadChain(resource: Resource): Promise<Resource[]> {
  if (resource.ancestorIds.length === 0) return [resource]
  const ancestors = await useDB().select().from(resources).where(inArray(resources.id, resource.ancestorIds))
  const byId = new Map(ancestors.map(a => [a.id, a]))
  return [resource, ...resource.ancestorIds.toReversed().map(id => byId.get(id)).filter(a => a !== undefined)]
}

export const rulesOn = (ids: string[]) => ids.length ? inArray(accessRules.resourceId, ids) : sql`false`

export const rulesOnChildrenOf = (parentId: string | null) => sql`${accessRules.resourceId} in (
  select id from ${resources} where ${parentId ? sql`parent_id = ${parentId}` : sql`parent_id is null`} and deleted_at is null
)`

export async function loadRules(ids: string[]) {
  if (ids.length === 0) return []
  return useDB().select().from(accessRules).where(rulesOn(ids))
}

export async function loadRuleRows(where: SQL): Promise<RuleRow[]> {
  const now = new Date()
  const rows = await useDB()
    .select({
      rule: accessRules,
      userName: user.name,
      userEmail: user.email,
      userStatus: user.status,
      userRole: user.role,
      invitationEmail: invitations.email,
      invitationName: invitations.name,
      invitationStatus: invitations.status,
      invitationMode: invitations.mode,
      invitationTokenSealed: invitations.tokenSealed,
      invitationExpiresAt: invitations.expiresAt,
    })
    .from(accessRules)
    .leftJoin(user, eq(accessRules.userId, user.id))
    .leftJoin(invitations, eq(accessRules.invitationId, invitations.id))
    .where(where)
    .orderBy(asc(accessRules.createdAt))

  return rows.map((row): RuleRow => {
    const expired = isExpired(row.rule.expiresAt, now)
    if (row.rule.kind === 'user') {
      const status: RuleStatus = expired ? 'expired' : row.userStatus === 'active' ? 'active' : 'disabled'
      return {
        rule: row.rule,
        person: { kind: 'user', label: row.userName || row.userEmail!, email: row.userEmail! },
        member: row.userRole === 'member',
        active: status === 'active',
        status,
        invitationMode: null,
        invitationTokenSealed: null,
      }
    }
    if (row.rule.kind === 'invitation') {
      const status: RuleStatus = expired || isExpired(row.invitationExpiresAt, now)
        ? 'expired'
        : row.invitationStatus === 'revoked' ? 'revoked' : row.invitationMode === 'account' ? 'pending' : 'active'
      return {
        rule: row.rule,
        person: { kind: 'invitation', label: row.invitationName || row.invitationEmail!, email: row.invitationEmail! },
        member: false,
        active: status === 'active' || status === 'pending',
        status,
        invitationMode: row.invitationMode,
        invitationTokenSealed: row.invitationTokenSealed,
      }
    }
    return { rule: row.rule, person: null, member: false, active: !expired, status: expired ? 'expired' : 'active', invitationMode: null, invitationTokenSealed: null }
  })
}

export function toAccessNode(resource: Resource): AccessNode {
  return { id: resource.id, inheritAccess: resource.inheritAccess, deletedAt: resource.deletedAt }
}

export async function accessOf(viewer: Viewer, resource: Resource, options: { trashed?: boolean } = {}): Promise<{ access: Access, chain: Resource[] }> {
  const chain = await loadChain(resource)
  if (viewer.ctx.isOwner) return { access: resolveAccess(viewer.ctx, chain.map(toAccessNode), []), chain }
  const rules = await loadRules(chain.map(r => r.id))
  return { access: resolveAccess(viewer.ctx, chain.map(toAccessNode), rules, new Date(), options), chain }
}

/** Effective rule rows of a resource: own rules, then inherited ones until inheritance is broken. */
export function effectiveRuleRows(chain: Resource[], rows: RuleRow[]) {
  const byRuleId = new Map(rows.map(row => [row.rule.id, row]))
  return effectiveRules(chain.map(toAccessNode), rows.map(row => row.rule))
    .map(({ rule, inheritedFrom }) => ({ ...byRuleId.get(rule.id)!, inheritedFrom }))
}

export function summarizeAccess(own: RuleRow[], inherited: RuleRow[]): AccessSummary {
  const active = [...own, ...inherited].filter(row => row.active)
  const people = new Map<string, AccessPerson>()
  for (const row of active) {
    if (row.person) people.set(`${row.person.kind}:${row.person.email}`, row.person)
  }
  const list = [...people.values()]
  const hasLink = active.some(row => row.rule.kind === 'link')
  return {
    level: hasLink ? 'public' : list.length > 0 ? 'shared' : 'private',
    people: list,
    userCount: list.filter(p => p.kind === 'user').length,
    invitationCount: list.filter(p => p.kind === 'invitation').length,
    hasLink,
    inherited: own.filter(row => row.active).length === 0 && inherited.some(row => row.active),
  }
}

/** Summaries for a batch of resources that may live in different folders (search, recent, starred...). */
export async function summarizeMany(items: Resource[]) {
  const ids = new Set<string>()
  for (const item of items) {
    ids.add(item.id)
    for (const ancestor of item.ancestorIds) ids.add(ancestor)
  }
  const [rows, ancestors] = await Promise.all([
    loadRuleRows(rulesOn([...ids])),
    ids.size ? useDB().select().from(resources).where(inArray(resources.id, [...ids])) : [],
  ])
  const byId = new Map(ancestors.map(a => [a.id, a]))
  const rowsByResource = Map.groupBy(rows, row => row.rule.resourceId)

  return new Map(items.map((item) => {
    const chain = [item, ...item.ancestorIds.toReversed().map(id => byId.get(id)).filter(a => a !== undefined)]
    const effective = effectiveRuleRows(chain, chain.flatMap(node => rowsByResource.get(node.id) ?? []))
    return [item.id, summarizeAccess(effective.filter(r => !r.inheritedFrom), effective.filter(r => r.inheritedFrom))]
  }))
}

export const thumbnailUrl = (id: string, checksum: string, base: string) => `${base}/resources/${id}/thumbnail?v=${checksum.slice(0, 12)}`

export function thumbnailPath(resource: Resource, base: string) {
  if (resource.thumbnailStatus !== 'ready' || !resource.checksum) return null
  return thumbnailUrl(resource.id, resource.checksum, base)
}

export const resourceKind = (resource: Resource) => isSite(resource) ? 'html' as const : kindOf(resource.type, resource.mimeType)

/** What the viewer gets to see of a resource: those who can edit it also see its labels and state, those who manage it who has access. */
export function toItem(resource: Resource, options: { viewer: Viewer, access?: Access, summary?: AccessSummary, location?: string }): ResourceItem {
  const { viewer } = options
  const isOwner = viewer.ctx.isOwner
  const canEdit = isOwner || !!options.access?.edit
  const canManage = isOwner || !!options.access?.manage
  const item: ResourceItem = {
    id: resource.id,
    parentId: resource.parentId,
    type: resource.type,
    kind: resourceKind(resource),
    name: resource.name,
    extension: resource.extension,
    mimeType: resource.mimeType,
    size: resource.size,
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
    thumbnailUrl: thumbnailPath(resource, viewer.apiBase),
    canDownload: isOwner || (options.access?.download ?? false),
    canEdit,
    canManage,
    location: options.location,
  }
  if (!canEdit) return item

  return {
    ...item,
    tagIds: resource.tagIds,
    allowScripts: resource.allowScripts,
    deletedAt: resource.deletedAt?.toISOString() ?? null,
    ...(canManage ? { access: options.summary, lastExternalViewAt: resource.lastExternalViewAt?.toISOString() ?? null } : {}),
  }
}

export async function childrenOf(parentId: string | null, options: { foldersOnly?: boolean } = {}) {
  return useDB().select().from(resources).where(and(
    parentId ? eq(resources.parentId, parentId) : isNull(resources.parentId),
    isNull(resources.deletedAt),
    options.foldersOnly ? eq(resources.type, 'folder') : undefined,
  ))
}

/** Excludes resources whose own deletion or an ancestor's deletion put them in the trash. */
export const notInTrash = sql`${resources.deletedAt} is null and not exists (
  select 1 from ${resources} as trashed_ancestor
  where trashed_ancestor.id = any(${resources.ancestorIds}) and trashed_ancestor.deleted_at is not null
)`

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)

export type Need = 'read' | 'edit' | 'manage'

const REFUSALS = { read: 'errors.noAccessItem', edit: 'errors.cannotEdit', manage: 'errors.cannotManage' } as const

/** Every read or change of a resource goes through here: `trashed` also reaches what sits in the trash, for those who can edit it. */
export async function requireAccess(viewer: Viewer, id: string, need: Need = 'read', options: { trashed?: boolean } = {}) {
  const resource = await findResource(id)
  if (!resource) throw createError({ statusCode: 404, statusMessage: tr('errors.itemNotFound') })
  const { access, chain } = await accessOf(viewer, resource, options)
  if (!access.read) throw createError({ statusCode: 403, statusMessage: tr('errors.noAccessItem') })
  if (!access[need]) throw createError({ statusCode: 403, statusMessage: tr(REFUSALS[need]) })
  return { resource, access, chain }
}

export const requireReadable = (viewer: Viewer, id: string) => requireAccess(viewer, id, 'read')

export async function requireAll(viewer: Viewer, ids: string[], need: Need, options: { trashed?: boolean } = {}) {
  const found = []
  for (const id of new Set(ids)) found.push((await requireAccess(viewer, id, need, options)).resource)
  return found
}
