import { desc, ne, sql } from 'drizzle-orm'
import type { Person } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<{ people: Person[] }> => {
  const viewer = await requireOwner(event)
  const { user, invitations, accessRules, accessEvents } = tables
  const db = useDB()
  const [users, pending] = await Promise.all([
    db.select({
      user,
      shareCount: sql<number>`(select count(*)::int from ${accessRules} as rule where rule.user_id = "user".id)`,
      lastEventAt: sql<string | null>`(select max(event.created_at) from ${accessEvents} as event where event.user_id = "user".id)`,
    }).from(user).where(ne(user.id, viewer.user!.id)).orderBy(desc(user.createdAt)),
    db.select({
      invitation: invitations,
      shareCount: sql<number>`(select count(*)::int from ${accessRules} as rule where rule.invitation_id = "invitations".id)`,
    }).from(invitations).where(ne(invitations.status, 'accepted')).orderBy(desc(invitations.createdAt)),
  ])

  const latest = (...dates: Array<Date | string | null | undefined>) => {
    const times = dates.filter(Boolean).map(d => new Date(d!).getTime())
    return times.length ? new Date(Math.max(...times)).toISOString() : null
  }

  return {
    people: [
      ...users.map(({ user: u, shareCount, lastEventAt }): Person => ({
        id: u.id,
        kind: 'user',
        role: userRole(u.role),
        name: u.name,
        email: u.email,
        status: u.status === 'active' ? 'active' : 'disabled',
        shareCount,
        lastSeenAt: latest(u.lastLoginAt, lastEventAt),
        createdAt: u.createdAt.toISOString(),
      })),
      ...pending.map(({ invitation: i, shareCount }): Person => ({
        id: i.id,
        kind: 'invitation',
        role: 'reader',
        name: i.name,
        email: i.email,
        status: invitationState(i) === 'pending' ? 'pending' : 'revoked',
        invitationMode: i.mode,
        shareCount,
        lastSeenAt: i.lastUsedAt?.toISOString() ?? null,
        createdAt: i.createdAt.toISOString(),
      })),
    ],
  }
})
