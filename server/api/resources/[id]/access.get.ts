export default defineEventHandler(async (event) => {
  await requireOwner(event)
  return resourceAccess(await requireOwned(getRouterParam(event, 'id')!))
})
