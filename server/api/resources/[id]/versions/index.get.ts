export default defineEventHandler(async (event) => {
  const { viewer, file } = await ownedFile(event)
  return versionHistory(viewer, file)
})
