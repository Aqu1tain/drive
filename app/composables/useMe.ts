import { useQuery } from '@tanstack/vue-query'
import type { SessionUser } from '#shared/types/api'

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ user: SessionUser | null, emailEnabled: boolean }>('/api/me'),
    staleTime: 60_000,
  })
}
