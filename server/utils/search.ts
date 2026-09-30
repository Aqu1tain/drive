import { and, desc, gte, lt, or, sql, type SQL } from 'drizzle-orm'
import { searchKeyOf, searchWordsOf } from '#shared/utils/names'
import { mimeRulesFor, type SearchQuery } from '#shared/utils/search'
import type { ResourceItem } from '#shared/types/api'
import type { Resource } from '../database/schema'

const CANDIDATES = 300

const likePattern = (term: string) => `%${searchKeyOf(term).replace(/[\\%_]/g, '\\$&')}%`

function kindCondition(kind: SearchQuery['type']): SQL | undefined {
  const { resources } = tables
  if (!kind) return undefined
  if (kind === 'folder') return sql`${resources.type} = 'folder'`
  const rules = mimeRulesFor(kind)
  if (!rules) return undefined
  return and(
    sql`${resources.type} = 'file'`,
    sql`${resources.mimeType} ~ ${rules.include}`,
    ...rules.exclude.map(pattern => sql`${resources.mimeType} !~ ${pattern}`),
  )
}

/** Every word of the term starts a word of the file text: "factur" finds "factures". */
function contentCondition(term: string) {
  const { resources, resourceTexts } = tables
  const words = searchWordsOf(term)
  if (words.length === 0) return undefined
  const query = words.map(word => `${word}:*`).join(' & ')
  return sql`${resources.id} in (select ${resourceTexts.resourceId} from ${resourceTexts} where ${resourceTexts.words} @@ to_tsquery('simple', ${query}))`
}

/** A term matches the name, the name of an enclosing folder, the file text, or, for the owner, a person who has access. */
function termCondition(term: string, includePeople: boolean) {
  const { resources, accessRules, user, invitations } = tables
  const like = likePattern(term)
  const lowerLike = `%${term.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`
  return or(
    sql`${resources.searchKey} like ${like}`,
    sql`exists (select 1 from ${resources} as folder where folder.id = any(${resources.ancestorIds}) and folder.search_key like ${like})`,
    contentCondition(term),
    includePeople
      ? sql`${resources.id} in (
          select ar.resource_id from ${accessRules} ar
          left join ${user} u on u.id = ar.user_id
          left join ${invitations} i on i.id = ar.invitation_id
          where lower(u.email) like ${lowerLike} or lower(u.name) like ${lowerLike}
             or lower(i.email) like ${lowerLike} or lower(coalesce(i.name, '')) like ${lowerLike}
        )`
      : undefined,
  )
}

function readerScope(userId: string) {
  const { resources, accessRules } = tables
  const shared = sql`select ${accessRules.resourceId} from ${accessRules} where ${accessRules.userId} = ${userId}`
  return sql`(${resources.id} in (${shared}) or ${resources.ancestorIds} && array(${shared}))`
}

export async function searchResources(viewer: Viewer, query: SearchQuery, limit = 50): Promise<ResourceItem[]> {
  const { resources, tags } = tables
  const isOwner = viewer.ctx.isOwner
  if (query.tag && !isOwner) return []
  const nameKey = searchKeyOf(query.terms.join(' '))

  const candidates = await useDB().select().from(resources).where(and(
    notInTrash,
    ...query.terms.map(term => termCondition(term, isOwner)),
    kindCondition(query.type),
    query.after ? gte(resources.updatedAt, new Date(query.after)) : undefined,
    query.before ? lt(resources.updatedAt, new Date(query.before)) : undefined,
    query.folderId ? sql`${resources.ancestorIds} @> array[${query.folderId}::uuid]` : undefined,
    query.tag ? sql`${resources.tagIds} && array(select ${tags.id} from ${tags} where ${tags.nameLower} = ${query.tag})` : undefined,
    isOwner ? undefined : readerScope(viewer.user!.id),
  )).orderBy(
    desc(sql`${resources.searchKey} like ${`%${nameKey}%`}`),
    desc(sql`similarity(${resources.searchKey}, ${nameKey})`),
    desc(resources.updatedAt),
  ).limit(CANDIDATES)

  if (!isOwner) return readableItems(viewer, candidates, limit)

  const [summaries, locations] = await Promise.all([summarizeMany(candidates), locationsOf(candidates)])
  return withFavorites(viewer, candidates
    .map(item => toItem(item, { viewer, summary: summaries.get(item.id), location: locations.get(item.id) }))
    .filter(item => matchesAccess(item, query))
    .slice(0, limit))
}

function matchesAccess(item: ResourceItem, query: SearchQuery) {
  const access = item.access
  if (!access) return true
  if (query.access === 'private' && access.level !== 'private') return false
  if (query.access === 'shared' && access.level === 'private') return false
  if (query.access === 'public' && !access.hasLink) return false
  if (query.sharedWith && !access.people.some(p => p.email.includes(query.sharedWith!) || p.label.toLowerCase().includes(query.sharedWith!))) return false
  return true
}

async function readableItems(viewer: Viewer, candidates: Resource[], limit: number) {
  const items: ResourceItem[] = []
  for (const candidate of candidates) {
    const { access } = await accessOf(viewer, candidate)
    if (access.read) items.push(toItem(candidate, { viewer, access }))
    if (items.length >= limit) break
  }
  return withFavorites(viewer, items)
}
