export default defineEventHandler(async (event) => {
  const viewer = await requireOwner(event)
  return { items: await listTrash(viewer) }
})
