export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  const id = getRouterParam(event, 'id')!
  const foldersOnly = getQuery(event).foldersOnly === '1'
  return listFolder(viewer, id === 'root' ? null : id, { foldersOnly })
})
