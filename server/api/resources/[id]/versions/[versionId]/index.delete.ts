export default defineEventHandler(async (event) => {
  const { version } = await fileVersion(event, 'manage')
  await deleteVersion(version)
  return { deleted: version.id }
})
