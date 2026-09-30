export default defineEventHandler(async (event) => {
  await requireMember(event)
  return { tags: await listTags() }
})
