import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  enabled: z.boolean(),
  allowDownload: z.boolean().default(true),
  expiresAt: z.string().datetime().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const viewer = await requireOwner(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const resource = await requireOwned(getRouterParam(event, 'id')!)
  const { accessRules } = tables
  const db = useDB()
  const [existing] = await db.select().from(accessRules).where(and(eq(accessRules.resourceId, resource.id), eq(accessRules.kind, 'link'))).limit(1)

  if (!body.enabled) {
    if (existing) {
      await db.delete(accessRules).where(eq(accessRules.id, existing.id))
      await logOwnerAction(event, viewer, resource.id, 'link_removed', 'Lien public')
    }
    return resourceAccess(resource)
  }

  const settings = { allowDownload: body.allowDownload, expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }
  if (existing) {
    await db.update(accessRules).set(settings).where(eq(accessRules.id, existing.id))
    await logOwnerAction(event, viewer, resource.id, 'link_updated', 'Lien public')
  }
  else {
    const { tokenHash, tokenSealed } = newSecretToken()
    await db.insert(accessRules).values({ resourceId: resource.id, kind: 'link', tokenHash, tokenSealed, ...settings })
    await logOwnerAction(event, viewer, resource.id, 'link_created', 'Lien public')
  }
  return resourceAccess(resource)
})
