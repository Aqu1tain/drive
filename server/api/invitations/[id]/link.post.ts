import { eq } from 'drizzle-orm'

/** Issues a fresh link (the previous one stops working) — also how a lost invitation gets re-sent. */
export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const invitation = await requireInvitation(getRouterParam(event, 'id')!)
  if (invitation.status !== 'pending') throw createError({ statusCode: 409, statusMessage: 'Invitation déjà utilisée ou révoquée' })
  const { tokenHash, tokenSealed } = newSecretToken()
  const expiresAt = invitation.mode === 'account' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : invitation.expiresAt
  const [updated] = await useDB().update(tables.invitations).set({ tokenHash, tokenSealed, expiresAt }).where(eq(tables.invitations.id, invitation.id)).returning()
  return { url: invitationUrl(updated!) }
})
