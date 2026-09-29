import type { ResourceDetails } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<ResourceDetails> => {
  const viewer = await requireViewer(event)
  const { resource, access, chain } = await requireReadable(viewer, getRouterParam(event, 'id')!)
  const rules = viewer.ctx.isOwner ? [] : await loadRules(chain.map(r => r.id))
  const path = crumbsFor(viewer, chain.slice(1), rules)

  if (!viewer.ctx.isOwner) {
    const [item] = await withFolderPreviews(viewer, await withFavorites(viewer, [toItem(resource, { viewer, access })]))
    return { item: item!, path, stats: null }
  }

  const summaries = await summarizeMany([resource])
  return {
    item: (await withFolderPreviews(viewer, [toItem(resource, { viewer, access, summary: summaries.get(resource.id) })]))[0]!,
    path,
    stats: await activityStats(resource),
  }
})
