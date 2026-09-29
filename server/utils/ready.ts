import { resolve } from 'node:path'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'

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
  const pending = await useDB().select({ id: resources.id }).from(resources).where(and(
    eq(resources.type, 'file'),
    isNotNull(resources.storageKey),
    isNull(resources.deletedAt),
    sql`${resources.processedChecksum} is distinct from ${resources.checksum}`,
  ))
  for (const { id } of pending) enqueueProcessing(id)
}
