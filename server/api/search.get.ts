import { z } from 'zod'
import { parseSearchQuery } from '#shared/utils/search'

const querySchema = z.object({
  q: z.string().max(500).default(''),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  const { q, limit } = await getValidatedQuery(event, querySchema.parse)
  const query = parseSearchQuery(q)
  const empty = query.terms.length === 0 && !query.type && !query.access && !query.sharedWith && !query.after && !query.before
  if (empty) return { items: [], query }
  return { items: await searchResources(viewer, query, limit), query }
})
