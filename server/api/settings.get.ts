export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const config = useRuntimeConfig()
  return {
    retentionDays: Number(config.activity.retentionDays),
    ipMode: config.activity.ipMode as 'hash' | 'none',
    emailEnabled: canSendEmail(),
    usercontentUrl: config.public.usercontentUrl,
    quota: Number(config.storageQuotaBytes),
    uploadMax: Number(config.uploadMaxBytes),
    storageDriver: config.storage.driver,
    organization: await organizationStatus(),
  }
})
