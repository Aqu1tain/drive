export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  const clientId = getRouterParam(event, 'clientId')!
  if (!(await revokeApps(viewer.user!.id, clientId))) throw createError({ statusCode: 404, statusMessage: 'Application introuvable' })
  return { revoked: clientId }
})
