export default defineEventHandler(async (event) => {
  const { viewer, file } = await versionedFile(event)
  return versionHistory(viewer, file)
})
