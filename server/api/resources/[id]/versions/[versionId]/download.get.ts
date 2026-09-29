export default defineEventHandler(async (event) => {
  const { file, version } = await ownedVersion(event)
  return sendResourceContent(event, asVersion(file, version), 'attachment')
})
