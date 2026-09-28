import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  allowDownload: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const viewer = await requireOwner(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const rule = await requireRule(getRouterParam(event, 'ruleId')!)
  const patch = {
    ...(body.allowDownload !== undefined ? { allowDownload: body.allowDownload } : {}),
    ...(body.expiresAt !== undefined ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null } : {}),
  }
  if (Object.keys(patch).length) await useDB().update(tables.accessRules).set(patch).where(eq(tables.accessRules.id, rule.id))
  await logOwnerAction(event, viewer, rule.resourceId, rule.kind === 'link' ? 'link_updated' : 'share_updated', await ruleLabel(rule))
  return resourceAccess(await requireOwned(rule.resourceId))
})
