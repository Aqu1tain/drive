import { useQuery } from '@tanstack/vue-query'
import { stringifySearchQuery } from '#shared/utils/search'
import type { TagInfo } from '#shared/types/api'

export function useTags(enabled: MaybeRef<boolean> = true) {
  const query = useQuery({
    queryKey: ['tags'],
    queryFn: () => api<{ tags: TagInfo[] }>('/api/tags').then(response => response.tags),
    enabled,
    staleTime: 60_000,
  })
  const tags = computed(() => (query.data.value ?? []).toSorted((a, b) => a.name.localeCompare(b.name, currentLocale())))
  return { tags }
}

export const tagSearchUrl = (name: string) => `/search?q=${encodeURIComponent(stringifySearchQuery({ terms: [], tag: name.toLowerCase() }))}`
