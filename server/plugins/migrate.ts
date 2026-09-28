import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { and, eq, isNull } from 'drizzle-orm'

export default defineNitroPlugin(async () => {
  if (import.meta.prerender) return
  const migrationsFolder = process.env.MIGRATIONS_DIR ?? resolve('server/database/migrations')
  await migrate(useDB(), { migrationsFolder })

  const { resources } = tables
  const pending = await useDB().select({ id: resources.id }).from(resources)
    .where(and(eq(resources.thumbnailStatus, 'pending'), isNull(resources.deletedAt)))
  for (const { id } of pending) enqueueThumbnail(id)
})
