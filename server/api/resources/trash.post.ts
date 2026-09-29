import { z } from 'zod'

const bodySchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(1000) })

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const { ids } = await readValidatedBody(event, bodySchema.parse)
  return trashResources(ids)
})
