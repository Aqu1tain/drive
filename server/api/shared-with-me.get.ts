export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  if (viewer.ctx.isOwner) throw createError({ statusCode: 400, statusMessage: 'Réservé aux lecteurs' })
  return { items: await listSharedWithMe(viewer) }
})
