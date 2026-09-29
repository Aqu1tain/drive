export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  return { apps: await connectedApps(viewer.user!.id) }
})
