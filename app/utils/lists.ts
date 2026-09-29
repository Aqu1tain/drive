import type { ResourceItem } from '#shared/types/api'

const LIST_FIELDS = ['items', 'folders', 'files'] as const

/** Cached payloads differ (a folder, the home page, search results): every list of items they hold changes, the rest stays. */
export function mapCachedLists(data: unknown, change: (items: ResourceItem[]) => ResourceItem[]) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  const lists = LIST_FIELDS.filter(field => Array.isArray((data as Record<string, unknown>)[field]))
  if (lists.length === 0) return data
  const next: Record<string, unknown> = { ...data }
  for (const field of lists) next[field] = change(next[field] as ResourceItem[])
  return next
}
