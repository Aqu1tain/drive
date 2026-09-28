import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { and, eq, isNull } from 'drizzle-orm'

let ready: Promise<void> | undefined

/**
 * Nitro 2 does not await async plugins, so requests wait on this instead.
 * Production migrations run before the server starts (scripts/migrate.mjs); dev applies them here.
 */
export function whenReady() {
  ready ??= prepare()
  return ready
}

async function prepare() {
  if (import.meta.dev) await migrate(useDB(), { migrationsFolder: resolve('server/database/migrations') })
  const { resources } = tables
  const pending = await useDB().select({ id: resources.id }).from(resources)
    .where(and(eq(resources.thumbnailStatus, 'pending'), isNull(resources.deletedAt)))
  for (const { id } of pending) enqueueThumbnail(id)
}
