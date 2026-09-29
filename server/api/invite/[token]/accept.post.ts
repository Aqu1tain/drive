import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  name: personNameSchema.min(1, 'Indiquez votre nom'),
  password: passwordSchema,
})

/** The invitation link reached this person's inbox (or was handed over by the owner): it vouches for the address. */
export default defineEventHandler(async (event) => {
  const invitation = await findAccountInvitation(getRouterParam(event, 'token')!)
  if (!invitation) throw createError({ statusCode: 404, statusMessage: tr('errors.invitationNotFound') })
  const state = invitationState(invitation)
  if (state !== 'pending') throw createError({ statusCode: 410, statusMessage: tr(state === 'accepted' ? 'errors.invitationAccepted' : 'errors.invitationExpired') })

  let user = await findUserByEmail(invitation.email)
  if (user?.role === 'owner') throw createError({ statusCode: 400, statusMessage: tr('errors.ownerAddress') })
  const existing = !!user
  if (!existing) {
    const body = await readValidatedBody(event, bodySchema.parse)
    user = await createUser({ email: invitation.email, name: body.name, role: 'reader', password: body.password, emailVerified: true }) as typeof user
  }

  const { accessRules, invitations } = tables
  const resourceIds = await useDB().transaction(async (tx) => {
    const rules = await tx.select().from(accessRules).where(eq(accessRules.invitationId, invitation.id))
    for (const rule of rules) {
      const [duplicate] = await tx.select({ id: accessRules.id }).from(accessRules)
        .where(and(eq(accessRules.resourceId, rule.resourceId), eq(accessRules.userId, user!.id), eq(accessRules.kind, 'user'))).limit(1)
      if (duplicate) await tx.delete(accessRules).where(eq(accessRules.id, rule.id))
      else await tx.update(accessRules).set({ kind: 'user', userId: user!.id, invitationId: null }).where(eq(accessRules.id, rule.id))
    }
    await tx.update(invitations).set({ status: 'accepted', acceptedByUserId: user!.id, acceptedAt: new Date() }).where(eq(invitations.id, invitation.id))
    return rules.map(rule => rule.resourceId)
  })

  await logInvitationAccepted(event, resourceIds, user!.name || user!.email, user!.id)
  return { email: invitation.email, existing }
})
