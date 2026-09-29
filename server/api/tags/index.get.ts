export default defineEventHandler(async (event) => {
  await requireOwner(event)
  return { tags: await listTags() }
})
