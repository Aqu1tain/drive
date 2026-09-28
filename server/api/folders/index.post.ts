import { z } from 'zod'

const bodySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(300),
})

export default defineEventHandler(async (event) => {
  const viewer = await requireOwner(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const parent = await requireFolder(body.parentId)
  const fields = nameFields(body.name)
  if (await findSibling(parent?.id ?? null, fields.nameLower)) nameTaken(fields.name)

  try {
    const [folder] = await useDB().insert(tables.resources).values({
      ...fields,
      extension: null,
      type: 'folder',
      parentId: parent?.id ?? null,
      ancestorIds: childAncestors(parent),
    }).returning()
    const summaries = await summarizeMany([folder!])
    setResponseStatus(event, 201)
    return toItem(folder!, { viewer, summary: summaries.get(folder!.id) })
  }
  catch (error) {
    if (isUniqueViolation(error)) nameTaken(fields.name)
    throw error
  }
})
