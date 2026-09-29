import { z } from 'zod'
import { isEmptySearch, parseSearchQuery } from '#shared/utils/search'

const querySchema = z.object({
  q: z.string().max(500).default(''),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export default defineEventHandler(async (event) => {
  const viewer = await requireViewer(event)
  const { q, limit } = await getValidatedQuery(event, querySchema.parse)
  const query = parseSearchQuery(q)
  if (isEmptySearch(query)) return { items: [], query }
  return { items: await withFolderPreviews(viewer, await searchResources(viewer, query, limit)), query }
})
