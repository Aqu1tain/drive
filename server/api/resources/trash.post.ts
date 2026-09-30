import { z } from 'zod'

const bodySchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(1000) })

export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  const { ids } = await readValidatedBody(event, bodySchema.parse)
  return trashResources(viewer, ids)
})
