import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { and, eq, isNull } from 'drizzle-orm'

/** In production migrations run before the server starts (scripts/migrate.mjs); in dev this keeps the loop short. */
export default defineNitroPlugin(async () => {
  if (import.meta.prerender) return
  if (import.meta.dev) await migrate(useDB(), { migrationsFolder: resolve('server/database/migrations') })

  const { resources } = tables
  const pending = await useDB().select({ id: resources.id }).from(resources)
    .where(and(eq(resources.thumbnailStatus, 'pending'), isNull(resources.deletedAt)))
  for (const { id } of pending) enqueueThumbnail(id)
})
