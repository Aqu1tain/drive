import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const viewer = await requireOwner(event)
  const invitation = await requireInvitation(getRouterParam(event, 'id')!)
  const { invitations, accessRules } = tables
  const removed = await useDB().transaction(async (tx) => {
    await tx.update(invitations).set({ status: 'revoked' }).where(eq(invitations.id, invitation.id))
    return tx.delete(accessRules).where(eq(accessRules.invitationId, invitation.id)).returning({ resourceId: accessRules.resourceId })
  })
  for (const { resourceId } of removed) {
    await logOwnerAction(event, viewer, resourceId, 'share_removed', invitation.name || invitation.email)
  }
  return { revoked: invitation.id }
})
