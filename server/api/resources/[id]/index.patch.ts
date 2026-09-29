import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  name: z.string().min(1).max(300).optional(),
  starred: z.boolean().optional(),
  inheritAccess: z.boolean().optional(),
  allowScripts: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const viewer = await requireOwner(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const resource = await requireOwned(getRouterParam(event, 'id')!)
  const { resources } = tables
  const patch: Partial<typeof resources.$inferInsert> = {}

  if (body.name !== undefined && body.name !== resource.name) {
    const fields = nameFields(body.name)
    const sibling = await findSibling(resource.parentId, fields.nameLower)
    if (sibling && sibling.id !== resource.id) nameTaken(fields.name)
    Object.assign(patch, resource.type === 'folder' ? { ...fields, extension: null } : fields, { updatedAt: new Date() })
  }
  if (body.starred !== undefined) patch.starred = body.starred
  if (body.inheritAccess !== undefined) patch.inheritAccess = body.inheritAccess
  if (body.allowScripts !== undefined) {
    if (resourceKind(resource) !== 'html') throw createError({ statusCode: 400, statusMessage: 'Réservé aux pages HTML' })
    patch.allowScripts = body.allowScripts
  }

  let updated = resource
  if (Object.keys(patch).length > 0) {
    try {
      [updated] = await useDB().update(resources).set(patch).where(eq(resources.id, resource.id)).returning() as [typeof resource]
    }
    catch (error) {
      if (isUniqueViolation(error)) nameTaken(body.name!)
      throw error
    }
  }

  if (body.inheritAccess !== undefined && body.inheritAccess !== resource.inheritAccess) {
    await logOwnerAction(event, viewer, resource.id, 'share_updated', body.inheritAccess ? 'Accès hérités rétablis' : 'Accès hérités retirés')
  }
  const summaries = await summarizeMany([updated])
  return toItem(updated, { viewer, summary: summaries.get(updated.id) })
})
