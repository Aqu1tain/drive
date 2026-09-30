import { z } from 'zod'

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
  targetId: z.string().uuid().nullable(),
  conflict: z.enum(['fail', 'keep']).default('fail'),
})

export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  return moveResources(viewer, body.ids, body.targetId, body.conflict)
})
