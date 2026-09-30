export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  const session = requireSession(viewer, getRouterParam(event, 'id')!)
  const { item, replaced } = await finishSession(viewer, session)
  setResponseStatus(event, replaced ? 200 : 201)
  return item
})
