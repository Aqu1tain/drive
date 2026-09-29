import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

export const passwordSchema = z.string().min(10, 'Au moins 10 caractères').max(256)
export const emailSchema = z.string().trim().toLowerCase().email('Adresse email invalide').max(254)
export const personNameSchema = z.string().trim().max(120)

export async function ownerExists() {
  const [row] = await useDB().select({ count: sql<number>`count(*)::int` }).from(tables.user).where(eq(tables.user.role, 'owner'))
  return (row?.count ?? 0) > 0
}

export async function findUserByEmail(email: string) {
  const [row] = await useDB().select().from(tables.user).where(eq(tables.user.email, email.toLowerCase())).limit(1)
  return row ?? null
}

/** Accounts are only ever created by the server (setup, invitation acceptance, owner action): public sign-up is disabled. */
export async function createUser(input: { email: string, name: string, role: 'owner' | 'reader', password?: string, emailVerified: boolean }) {
  const ctx = await useAuth().$context
  const created = await ctx.internalAdapter.createUser({
    email: input.email.toLowerCase(),
    name: input.name,
    emailVerified: input.emailVerified,
    role: input.role,
    status: 'active',
  }, { method: 'admin' })
  if (!input.password) return created
  try {
    await setPassword(created.id, input.password)
  }
  catch (error) {
    await ctx.internalAdapter.deleteUser(created.id)
    throw error
  }
  return created
}

export async function setPassword(userId: string, password: string) {
  const ctx = await useAuth().$context
  const hash = await ctx.password.hash(password)
  const accounts = await ctx.internalAdapter.findAccounts(userId)
  if (accounts.some(account => account.providerId === 'credential')) {
    await ctx.internalAdapter.updatePassword(userId, hash)
    return
  }
  await ctx.internalAdapter.linkAccount({ userId, providerId: 'credential', accountId: userId, password: hash })
}

/** Signs a person out everywhere, AI apps included. */
export async function revokeSessions(userId: string) {
  const ctx = await useAuth().$context
  await ctx.internalAdapter.deleteUserSessions(userId)
  await revokeApps(userId)
}
