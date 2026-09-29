import type { Crumb, FolderListing } from '#shared/types/api'
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
  if (viewer.kind === 'reader') return [{ id: null, name: tr('labels.sharedWithMe') }, ...visible]
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
      items: await withFolderPreviews(viewer, children.map(child => toItem(child, { viewer, summary: summarizeAccess(byChild.get(child.id) ?? [], []) }))),
    }
  }

  const { folder, chain, rows, access } = await readableFolder(viewer, folderId)
  const [children, childRows] = await Promise.all([childrenOf(folder.id, options), loadRuleRows(rulesOnChildrenOf(folder.id))])
  const byChild = Map.groupBy(childRows, row => row.rule.resourceId)
  const breadcrumbs = crumbsFor(viewer, chain, rows.map(r => r.rule))

  if (viewer.ctx.isOwner) {
    const effective = effectiveRuleRows(chain, rows)
    const own = effective.filter(row => !row.inheritedFrom)
    return {
      folder: toItem(folder, { viewer, access, summary: summarizeAccess(own, effective.filter(row => row.inheritedFrom)) }),
      breadcrumbs,
      items: await withFolderPreviews(viewer, children.map(child => toItem(child, {
        viewer,
        summary: summarizeAccess(byChild.get(child.id) ?? [], child.inheritAccess ? effective : []),
      }))),
    }
  }

  const items = children.flatMap((child) => {
    const childAccess = resolveChildAccess(viewer.ctx, access, toAccessNode(child), (byChild.get(child.id) ?? []).map(row => row.rule))
    return childAccess.read ? [toItem(child, { viewer, access: childAccess })] : []
  })
  const [marked, ...markedItems] = await withFavorites(viewer, [toItem(folder, { viewer, access }), ...items])
  return { folder: marked!, breadcrumbs, items: await withFolderPreviews(viewer, markedItems) }
}
