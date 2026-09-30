import { and, eq } from 'drizzle-orm'
import type { Crumb, FolderListing, ResourceDetails } from '#shared/types/api'
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
    if (!viewer.ctx.isOwner) throw createError({ statusCode: 403, statusMessage: tr('errors.accessDenied') })
    const [children, rows] = await Promise.all([childrenOf(null, options), loadRuleRows(rulesOnChildrenOf(null))])
    const byChild = Map.groupBy(rows, row => row.rule.resourceId)
    return {
      folder: null,
      breadcrumbs: [rootCrumb()],
      items: await withFolderPreviews(viewer, await withFavorites(viewer, withVersioning(children, false, children.map(child => toItem(child, { viewer, summary: summarizeAccess(byChild.get(child.id) ?? [], []) }))))),
    }
  }

  const { folder, chain, rows, access } = await readableFolder(viewer, folderId)
  const [children, childRows] = await Promise.all([childrenOf(folder.id, options), loadRuleRows(rulesOnChildrenOf(folder.id))])
  const byChild = Map.groupBy(childRows, row => row.rule.resourceId)
  const breadcrumbs = crumbsFor(viewer, chain, rows.map(r => r.rule))

  if (viewer.ctx.isOwner) {
    const effective = effectiveRuleRows(chain, rows)
    const own = effective.filter(row => !row.inheritedFrom)
    const { enabled } = await versioningOf(folder)
    const [marked, ...items] = await withFavorites(viewer, [
      { ...toItem(folder, { viewer, access, summary: summarizeAccess(own, effective.filter(row => row.inheritedFrom)) }), versioning: enabled },
      ...withVersioning(children, enabled, children.map(child => toItem(child, {
        viewer,
        summary: summarizeAccess(byChild.get(child.id) ?? [], child.inheritAccess ? effective : []),
      }))),
    ])
    return { folder: marked!, breadcrumbs, items: await withFolderPreviews(viewer, items) }
  }

  const items = children.flatMap((child) => {
    const childAccess = resolveChildAccess(viewer.ctx, access, toAccessNode(child), (byChild.get(child.id) ?? []).map(row => row.rule))
    return childAccess.read ? [toItem(child, { viewer, access: childAccess })] : []
  })
  const [marked, ...markedItems] = await withFavorites(viewer, [toItem(folder, { viewer, access }), ...items])
  return { folder: marked!, breadcrumbs, items: await withFolderPreviews(viewer, markedItems) }
}

/** Top-level resources shared with a reader; items already reachable through a shared parent are folded into it. */
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
  const items = readable
    .filter(({ resource }) => !resource.ancestorIds.some(id => ids.has(id)))
    .map(({ resource, access }) => toItem(resource, { viewer, access }))
  return withFolderPreviews(viewer, await withFavorites(viewer, items))
}

export async function resourceDetails(viewer: Viewer, id: string): Promise<ResourceDetails> {
  const { resource, access, chain } = await requireReadable(viewer, id)
  const rules = viewer.ctx.isOwner ? [] : await loadRules(chain.map(r => r.id))
  const path = crumbsFor(viewer, chain.slice(1), rules)

  if (!viewer.ctx.isOwner) {
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

/** For the owner's menus: whether each child folder keeps versions, its own choice or the one it inherits. */
function withVersioning(children: Resource[], inherited: boolean, items: ResourceItem[]) {
  return items.map((item, index) => item.type === 'folder' ? { ...item, versioning: children[index]!.versioning ?? inherited } : item)
}
