import { z } from 'zod'

const querySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  resourceId: z.string().uuid().optional(),
  filter: z.enum(['all', 'views', 'downloads', 'sharing']).default('all'),
})

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  return listActivity(await getValidatedQuery(event, querySchema.parse))
})
