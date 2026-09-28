import { and, eq, isNull } from 'drizzle-orm'
import { kindOf } from '#shared/utils/search'

export default defineEventHandler(async (event) => {
  const invitation = await findAccountInvitation(getRouterParam(event, 'token')!)
  if (!invitation) throw createError({ statusCode: 404, statusMessage: 'Invitation introuvable' })
  const { accessRules, resources } = tables
  const shared = await useDB().select({ name: resources.name, type: resources.type, mimeType: resources.mimeType })
    .from(accessRules).innerJoin(resources, eq(accessRules.resourceId, resources.id))
    .where(and(eq(accessRules.invitationId, invitation.id), isNull(resources.deletedAt)))
  return {
    email: invitation.email,
    name: invitation.name,
    status: invitationState(invitation),
    sharedBy: await ownerName(),
    accountExists: !!(await findUserByEmail(invitation.email)),
    items: shared.map(r => ({ name: r.name, type: r.type, kind: kindOf(r.type, r.mimeType) })),
  }
})
