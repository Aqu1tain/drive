import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createAuth } from '../server/lib/auth'

export const auth = createAuth({
  db: drizzle(postgres('postgres://drive:drive@localhost:5442/drive')),
  secret: 'cli-only-secret-cli-only-secret-00',
  appUrl: 'http://localhost:3000',
  appName: 'Drive',
  sendSignInCode: async () => {},
})
