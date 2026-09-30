export default defineEventHandler(async (event) => {
  const { file, version } = await fileVersion(event)
  return sendResourceContent(event, asVersion(file, version), 'attachment')
})
