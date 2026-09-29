import { z } from 'zod'

const bodySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(300),
  size: z.number().int().positive(),
  conflict: z.enum(['fail', 'keep', 'replace']).default('fail'),
})

/** Starts a multipart upload: every check runs now, before any byte is sent. */
export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const session = await openSession(await planUpload(body))
  setResponseStatus(event, 201)
  return { id: session.id, partSize: PART_SIZE, name: session.plan.fields.name }
})
