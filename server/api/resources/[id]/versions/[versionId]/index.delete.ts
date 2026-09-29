export default defineEventHandler(async (event) => {
  const { version } = await ownedVersion(event)
  await deleteVersion(version)
  return { deleted: version.id }
})
