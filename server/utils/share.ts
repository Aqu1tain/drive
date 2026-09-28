import type { H3Event } from 'h3'
import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { hashToken } from '../lib/crypto'
import { isExpired, isInvitationUsable } from '../domain/access'

const VISITOR_COOKIE = 'drive_vid'

function visitorIdOf(event: H3Event) {
  const existing = getCookie(event, VISITOR_COOKIE)
  if (existing && /^[\w-]{36}$/.test(existing)) return existing
  const id = randomUUID()
  setCookie(event, VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: useRuntimeConfig().public.appUrl.startsWith('https://'),
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  return id
}

const gone = (message: string) => createError({ statusCode: 410, statusMessage: message, data: { reason: 'gone' } })

/** Resolves a public link or a personal invitation link into a viewer scoped to what it grants. */
export async function requireShareViewer(event: H3Event): Promise<Viewer> {
  const token = getRouterParam(event, 'token') ?? ''
  if (!/^[\w-]{16,64}$/.test(token)) throw createError({ statusCode: 404, statusMessage: 'Lien introuvable' })
  const tokenHash = hashToken(token)
  const db = useDB()
  const { accessRules, invitations } = tables
  const now = new Date()
  const base = { kind: 'share' as const, apiBase: `/api/s/${token}`, shareToken: token }

  const [rule] = await db.select().from(accessRules).where(and(eq(accessRules.tokenHash, tokenHash), eq(accessRules.kind, 'link'))).limit(1)
  if (rule) {
    if (isExpired(rule.expiresAt, now)) throw gone('Ce lien a expiré')
    return { ...base, ctx: { isOwner: false, linkRuleId: rule.id }, linkRule: rule, visitorId: visitorIdOf(event) }
  }

  const [invitation] = await db.select().from(invitations).where(eq(invitations.tokenHash, tokenHash)).limit(1)
  if (!invitation || invitation.mode !== 'link') throw createError({ statusCode: 404, statusMessage: 'Ce lien n’existe pas ou a été désactivé' })
  if (!isInvitationUsable(invitation, now)) throw gone(invitation.status === 'revoked' ? 'Ce lien a été révoqué' : 'Ce lien a expiré')

  if (!invitation.lastUsedAt || now.getTime() - invitation.lastUsedAt.getTime() > 60_000) {
    await db.update(invitations).set({ lastUsedAt: now }).where(eq(invitations.id, invitation.id))
  }
  return { ...base, ctx: { isOwner: false, invitation }, invitation, visitorId: visitorIdOf(event) }
}
