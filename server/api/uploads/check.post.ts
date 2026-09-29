import { z } from 'zod'

const bodySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  names: z.array(z.string().min(1).max(300)).max(5000),
})

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const parent = await requireFolder(body.parentId)
  const siblings = await childrenOf(parent?.id ?? null)
  const byName = new Map(siblings.map(s => [s.nameLower, s]))
  const conflicts = body.names.flatMap((name) => {
    const existing = byName.get(nameFields(name).nameLower)
    return existing ? [{ name, existingId: existing.id, existingType: existing.type }] : []
  })
  const versioning = parent ? (await versioningOf(parent)).enabled : false
  return { conflicts, versioning }
})
