export default defineEventHandler(async (event) => {
  const { viewer, file, version } = await ownedVersion(event)
  const restored = await restoreVersion(file, version)
  const summaries = await summarizeMany([restored])
  return toItem(restored, { viewer, summary: summaries.get(restored.id) })
})
