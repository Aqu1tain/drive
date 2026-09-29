export default defineEventHandler(async (event) => {
  await requireOwner(event)
  await dropSession(requireSession(getRouterParam(event, 'id')!))
  return { aborted: true }
})
