import { and, eq, ilike, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const q = String(getQuery(event).q ?? '').trim().toLowerCase().slice(0, 100)
  const { user, invitations } = tables
  const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`
  const db = useDB()
  const [users, pending] = await Promise.all([
    db.select({ name: user.name, email: user.email }).from(user)
      .where(and(eq(user.role, 'reader'), eq(user.status, 'active'), q ? or(ilike(user.email, like), ilike(user.name, like)) : undefined)).limit(8),
    db.select({ name: invitations.name, email: invitations.email }).from(invitations)
      .where(and(eq(invitations.status, 'pending'), q ? or(ilike(invitations.email, like), ilike(invitations.name, like)) : undefined)).limit(8),
  ])
  const seen = new Set<string>()
  return {
    people: [...users.map(u => ({ ...u, kind: 'user' as const })), ...pending.map(i => ({ ...i, kind: 'invitation' as const }))]
      .filter(p => !seen.has(p.email) && seen.add(p.email))
      .slice(0, 8),
  }
})
