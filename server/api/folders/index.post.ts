import { z } from 'zod'

const bodySchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(300),
})

export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const folder = await createFolder(viewer, body.parentId, body.name)
  setResponseStatus(event, 201)
  return folder
})
