export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  const favorites = await favoritesOf(viewer)
  if (!viewer.ctx.isOwner) return { items: await withFolderPreviews(viewer, favorites.map(({ resource, access }) => ({ ...toItem(resource, { viewer, access }), starred: true }))) }
  const resources = favorites.map(({ resource }) => resource)
  const [summaries, locations] = await Promise.all([summarizeMany(resources), locationsOf(resources)])
  return { items: await withFolderPreviews(viewer, resources.map(item => ({ ...toItem(item, { viewer, summary: summaries.get(item.id), location: locations.get(item.id) }), starred: true }))) }
})
