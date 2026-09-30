export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  return resourceAccess((await requireAccess(viewer, getRouterParam(event, 'id')!, 'manage')).resource)
})
