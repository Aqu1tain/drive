import { useQuery } from '@tanstack/vue-query'
import type { SessionUser } from '#shared/types/api'

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ user: SessionUser | null, emailEnabled: boolean }>('/api/me'),
    staleTime: 60_000,
  })
}

/** Owners run the drive; members work in what is shared with them. Both get the workspace, readers only what they were given. */
export function useRole() {
  const { data } = useMe()
  const role = computed(() => data.value?.user?.role ?? null)
  return {
    role,
    isOwner: computed(() => role.value === 'owner'),
    isMember: computed(() => role.value === 'owner' || role.value === 'member'),
  }
}
