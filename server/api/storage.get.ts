export default defineEventHandler(async (event) => {
  await requireOwner(event)
  return { used: await usedBytes(), quota: Number(useRuntimeConfig().storageQuotaBytes) }
})
