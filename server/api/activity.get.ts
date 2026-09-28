import { and, desc, inArray, lt, type SQL } from 'drizzle-orm'
import { z } from 'zod'

const FILTERS = {
  all: undefined,
  views: ['view'],
  downloads: ['download'],
  sharing: ['share_added', 'share_removed', 'share_updated', 'link_created', 'link_updated', 'link_removed', 'invite_accepted'],
} as const

const querySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  resourceId: z.string().uuid().optional(),
  filter: z.enum(['all', 'views', 'downloads', 'sharing']).default('all'),
})

export default defineEventHandler(async (event) => {
  await requireOwner(event)
  const query = await getValidatedQuery(event, querySchema.parse)
  const { accessEvents } = tables
  const types = FILTERS[query.filter]
  let scope: SQL | undefined
  if (query.resourceId) scope = activityScope(await requireOwned(query.resourceId))

  const events = await useDB().select().from(accessEvents).where(and(
    scope,
    types ? inArray(accessEvents.type, [...types]) : undefined,
    query.before ? lt(accessEvents.id, query.before) : undefined,
  )).orderBy(desc(accessEvents.id)).limit(query.limit + 1)

  const page = events.slice(0, query.limit)
  return { events: await toActivityEvents(page), next: events.length > query.limit ? page.at(-1)!.id : null }
})
