import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  email: emailSchema,
  name: personNameSchema.optional(),
  mode: z.enum(['account', 'link']).default('account'),
  allowDownload: z.boolean().default(true),
  expiresAt: z.string().datetime().nullable().optional(),
  notify: z.boolean().default(true),
})

export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const { resource, chain } = await requireAccess(viewer, getRouterParam(event, 'id')!, 'manage')
  if (chain.some(node => node.deletedAt)) throw createError({ statusCode: 409, statusMessage: tr('errors.itemInTrash') })
  if (body.email === viewer.user!.email.toLowerCase()) throw createError({ statusCode: 400, statusMessage: tr('errors.alreadyFullAccess') })

  const { accessRules } = tables
  const db = useDB()
  const settings = { allowDownload: body.allowDownload, expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }
  const existingUser = await findUserByEmail(body.email)
  if (existingUser?.role === 'owner') throw createError({ statusCode: 400, statusMessage: tr('errors.ownerAddress') })

  let ruleId: string
  let url: string
  let inviteUrl: string | null = null
  let notifyKind: 'user' | 'account' | 'link' = 'user'
  let label = body.name || body.email

  if (existingUser) {
    label = existingUser.name || existingUser.email
    const [existing] = await db.select().from(accessRules).where(and(eq(accessRules.resourceId, resource.id), eq(accessRules.userId, existingUser.id), eq(accessRules.kind, 'user'))).limit(1)
    const [rule] = existing
      ? await db.update(accessRules).set(settings).where(eq(accessRules.id, existing.id)).returning()
      : await db.insert(accessRules).values({ resourceId: resource.id, kind: 'user', userId: existingUser.id, ...settings }).returning()
    ruleId = rule!.id
    url = appUrl(`/open/${resource.id}`)
  }
  else {
    const invitation = await findOrCreateInvitation(body.email, body.name || null, body.mode)
    const [existing] = await db.select().from(accessRules).where(and(eq(accessRules.resourceId, resource.id), eq(accessRules.invitationId, invitation.id), eq(accessRules.kind, 'invitation'))).limit(1)
    const [rule] = existing
      ? await db.update(accessRules).set(settings).where(eq(accessRules.id, existing.id)).returning()
      : await db.insert(accessRules).values({ resourceId: resource.id, kind: 'invitation', invitationId: invitation.id, ...settings }).returning()
    ruleId = rule!.id
    inviteUrl = url = invitationUrl(invitation)
    notifyKind = body.mode
  }

  await logOwnerAction(event, viewer, resource.id, 'share_added', label)
  const emailed = body.notify ? await notifyShare(body.email, resource, url, notifyKind) : false
  setResponseStatus(event, 201)
  return { ruleId, inviteUrl, emailed }
})
