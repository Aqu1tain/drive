export default defineEventHandler(async (event) => {
  const viewer = await requireMember(event)
  return { items: await listTrash(viewer) }
})
