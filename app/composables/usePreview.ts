import { useQuery } from '@tanstack/vue-query'
import type { PreviewInfo } from '#shared/types/api'

/** Opening a file is the logical "view" event: fetched once per file, then cached. */
export function usePreview(id: Ref<string>, apiBase: Ref<string>) {
  return useQuery({
    queryKey: computed(() => ['open', apiBase.value, id.value]),
    queryFn: () => api<PreviewInfo>(`${apiBase.value}/resources/${id.value}/open`, { method: 'POST' }),
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
}
