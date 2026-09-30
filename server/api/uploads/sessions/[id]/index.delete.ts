export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  await dropSession(requireSession(viewer, getRouterParam(event, 'id')!))
  return { aborted: true }
})
