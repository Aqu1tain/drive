import { eq } from 'drizzle-orm'
import { hashToken } from '../lib/crypto'
import { isExpired } from '../domain/access'

export async function findAccountInvitation(token: string) {
  if (!/^[\w-]{16,64}$/.test(token)) return null
  const { invitations } = tables
  const [invitation] = await useDB().select().from(invitations).where(eq(invitations.tokenHash, hashToken(token))).limit(1)
  return invitation?.mode === 'account' ? invitation : null
}

export function invitationState(invitation: { status: string, expiresAt: Date | null }) {
  if (invitation.status !== 'pending') return invitation.status as 'accepted' | 'revoked'
  return isExpired(invitation.expiresAt, new Date()) ? 'expired' : 'pending'
}

export async function requireInvitation(id: string) {
  if (!isUuid(id)) throw createError({ statusCode: 404, statusMessage: 'Invitation introuvable' })
  const [invitation] = await useDB().select().from(tables.invitations).where(eq(tables.invitations.id, id)).limit(1)
  if (!invitation) throw createError({ statusCode: 404, statusMessage: 'Invitation introuvable' })
  return invitation
}

export async function requireReader(id: string) {
  const [reader] = await useDB().select().from(tables.user).where(eq(tables.user.id, id)).limit(1)
  if (!reader || reader.role !== 'reader') throw createError({ statusCode: 404, statusMessage: 'Personne introuvable' })
  return reader
}
