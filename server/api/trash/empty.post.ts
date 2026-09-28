import { isNotNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const { resources } = tables
  const db = useDB()
  const trashed = await db.select({ id: resources.id }).from(resources).where(isNotNull(resources.deletedAt))
  const ids = trashed.map(row => row.id)
  const keys = await subtreeKeys(ids)
  if (ids.length > 0) await db.delete(resources).where(isNotNull(resources.deletedAt))
  await deleteBlobs(keys)
  return { deleted: ids.length }
})
