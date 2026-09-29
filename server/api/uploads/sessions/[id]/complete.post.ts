export default defineEventHandler(async (event) => {
  const viewer = await requireOwner(event)
  const session = requireSession(getRouterParam(event, 'id')!)
  const { item, replaced } = await finishSession(viewer, session)
  setResponseStatus(event, replaced ? 200 : 201)
  return item
})
