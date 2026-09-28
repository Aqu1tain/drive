import { z } from 'zod'

const bodySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  path: z.array(z.string().min(1).max(300)).min(1).max(64),
})

/** Creates the missing folders of a dropped directory tree, reusing the ones that already exist (merge). */
export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  let parent = await requireFolder(body.parentId)

  for (const segment of body.path) {
    const fields = nameFields(segment)
    const existing = await findSibling(parent?.id ?? null, fields.nameLower)
    if (existing?.type === 'file') throw createError({ statusCode: 409, statusMessage: `Un fichier « ${existing.name} » bloque la création du dossier` })
    if (existing) {
      parent = existing
      continue
    }
    const [created] = await useDB().insert(tables.resources).values({
      ...fields,
      extension: null,
      type: 'folder',
      parentId: parent?.id ?? null,
      ancestorIds: childAncestors(parent),
    }).onConflictDoNothing().returning()
    parent = created ?? await findSibling(parent?.id ?? null, fields.nameLower)
  }
  return { id: parent!.id }
})
