import { lt } from 'drizzle-orm'

export default defineTask({
  meta: { name: 'activity:prune', description: 'Delete activity events older than the retention period' },
  async run() {
    const { retentionDays } = useRuntimeConfig().activity
    const cutoff = new Date(Date.now() - Number(retentionDays) * 24 * 60 * 60 * 1000)
    const deleted = await useDB().delete(tables.accessEvents).where(lt(tables.accessEvents.createdAt, cutoff)).returning({ id: tables.accessEvents.id })
    return { result: { deleted: deleted.length } }
  },
})
