import { and, eq } from 'drizzle-orm'
import type { Crumb, FolderListing, ResourceDetails, ResourceItem } from '#shared/types/api'
import { resolveAccess, resolveChildAccess, type AccessContext } from '../domain/access'
import type { AccessRule, Resource } from '../database/schema'

export const rootCrumb = (): Crumb => ({ id: null, name: tr('common.myDrive') })

/** Index in `chain` of the highest resource the viewer can read: where their breadcrumb starts. */
function topReadableIndex(ctx: AccessContext, chain: Resource[], rules: AccessRule[]) {
  for (let i = chain.length - 1; i >= 0; i--) {
    if (resolveAccess(ctx, chain.slice(i).map(toAccessNode), rules).read) return i
  }
  return 0
}

export function crumbsFor(viewer: Viewer, chain: Resource[], rules: AccessRule[]): Crumb[] {
  const toCrumb = (r: Resource): Crumb => ({ id: r.id, name: r.name })
  if (viewer.ctx.isOwner) return [rootCrumb(), ...chain.toReversed().map(toCrumb)]

  const visible = chain.slice(0, topReadableIndex(viewer.ctx, chain, rules) + 1).toReversed().map(toCrumb)
  if (viewer.ctx.isMember) return [rootCrumb(), ...visible]
  if (viewer.user) return [{ id: null, name: tr('labels.sharedWithMe') }, ...visible]
  if (viewer.invitation) return [{ id: null, name: tr('labels.sharedWithYou') }, ...visible]
  return visible
}

async function readableFolder(viewer: Viewer, folderId: string) {
  const folder = await findResource(folderId)
  if (!folder || folder.type !== 'folder') throw createError({ statusCode: 404, statusMessage: tr('errors.folderNotFound') })
  const chain = await loadChain(folder)
  if (viewer.ctx.isOwner && chain.some(node => node.deletedAt)) {
    throw createError({ statusCode: 409, statusMessage: tr('errors.folderInTrash'), data: { reason: 'trashed' } })
  }
  const rows = await loadRuleRows(rulesOn(chain.map(r => r.id)))
  const access = resolveAccess(viewer.ctx, chain.map(toAccessNode), rows.map(r => r.rule))
  if (!access.read) throw createError({ statusCode: 403, statusMessage: tr('errors.noAccessFolder') })
  return { folder, chain, rows, access }
}

export async function listFolder(viewer: Viewer, folderId: string | null, options: { foldersOnly?: boolean } = {}): Promise<FolderListing> {
  if (!folderId) {
    if (viewer.ctx.isMember && !viewer.ctx.isOwner) return { folder: null, breadcrumbs: [rootCrumb()], items: await listSharedWithMe(viewer) }
    if (!viewer.ctx.isOwner) throw createError({ statusCode: 403, statusMessage: tr('errors.accessDenied') })
    const [children, rows] = await Promise.all([childrenOf(null, options), loadRuleRows(rulesOnChildrenOf(null))])
    const byChild = Map.groupBy(rows, row => row.rule.resourceId)
    const items = children.map((child) => {
      const item = toItem(child, { viewer, summary: summarizeAccess(byChild.get(child.id) ?? [], []) })
      return child.type === 'folder' ? { ...item, versioning: child.versioning ?? false } : item
    })
    return { folder: null, breadcrumbs: [rootCrumb()], items: await withFolderPreviews(viewer, await withFavorites(viewer, items)) }
  }

  const { folder, chain, rows, access } = await readableFolder(viewer, folderId)
  const [children, childRows] = await Promise.all([childrenOf(folder.id, options), loadRuleRows(rulesOnChildrenOf(folder.id))])
  const byChild = Map.groupBy(childRows, row => row.rule.resourceId)
  const effective = effectiveRuleRows(chain, rows)
  const { enabled } = await versioningOf(folder)
  const withSettings = <T extends ResourceItem>(item: T, resource: Resource, manage: boolean): T =>
    manage && resource.type === 'folder' ? { ...item, versioning: resource.id === folder.id ? enabled : resource.versioning ?? enabled } : item

  const folderItem = withSettings(toItem(folder, {
    viewer,
    access,
    summary: access.manage ? summarizeAccess(effective.filter(row => !row.inheritedFrom), effective.filter(row => row.inheritedFrom)) : undefined,
  }), folder, access.manage)
  const items = children.flatMap((child) => {
    const childAccess = resolveChildAccess(viewer.ctx, access, toAccessNode(child), (byChild.get(child.id) ?? []).map(row => row.rule))
    if (!childAccess.read) return []
    const summary = childAccess.manage ? summarizeAccess(byChild.get(child.id) ?? [], child.inheritAccess ? effective : []) : undefined
    return [withSettings(toItem(child, { viewer, access: childAccess, summary }), child, childAccess.manage)]
  })
  const [marked, ...markedItems] = await withFavorites(viewer, [folderItem, ...items])
  return { folder: marked!, breadcrumbs: crumbsFor(viewer, chain, rows.map(r => r.rule)), items: await withFolderPreviews(viewer, markedItems) }
}

/** Top-level resources shared with someone; items already reachable through a shared parent are folded into it. For members, this is their drive. */
export async function listSharedWithMe(viewer: Viewer) {
  const { accessRules, resources } = tables
  const rows = await useDB().select({ resource: resources }).from(accessRules)
    .innerJoin(resources, eq(accessRules.resourceId, resources.id))
    .where(and(eq(accessRules.userId, viewer.user!.id), notInTrash))

  const readable = []
  for (const { resource } of rows) {
    const { access } = await accessOf(viewer, resource)
    if (access.read) readable.push({ resource, access })
  }
  const ids = new Set(readable.map(r => r.resource.id))
  const top = readable.filter(({ resource }) => !resource.ancestorIds.some(id => ids.has(id)))
  const summaries = await summarizeMany(top.filter(({ access }) => access.manage).map(({ resource }) => resource))
  const items = top.map(({ resource, access }) => toItem(resource, { viewer, access, summary: summaries.get(resource.id) }))
  return withFolderPreviews(viewer, await withFavorites(viewer, items))
}

export async function resourceDetails(viewer: Viewer, id: string): Promise<ResourceDetails> {
  const { resource, access, chain } = await requireReadable(viewer, id)
  const rules = viewer.ctx.isOwner ? [] : await loadRules(chain.map(r => r.id))
  const path = crumbsFor(viewer, chain.slice(1), rules)

  if (!access.manage) {
    const [item] = await withFolderPreviews(viewer, await withFavorites(viewer, [toItem(resource, { viewer, access })]))
    return { item: item!, path, stats: null }
  }

  const summaries = await summarizeMany([resource])
  return {
    item: (await withFolderPreviews(viewer, await withFavorites(viewer, [toItem(resource, { viewer, access, summary: summaries.get(resource.id) })])))[0]!,
    path,
    stats: await activityStats(resource),
    versioning: await versioningOf(resource),
  }
}
