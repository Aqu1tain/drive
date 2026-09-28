import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../database/schema'

export const tables = schema

let instance: PostgresJsDatabase<typeof schema> | undefined

export function useDB() {
  if (instance) return instance
  const client = postgres(useRuntimeConfig().databaseUrl, { max: 10 })
  instance = drizzle(client, { schema })
  return instance
}

export type Database = ReturnType<typeof useDB>
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
