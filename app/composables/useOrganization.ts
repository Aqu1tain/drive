import { useQuery } from '@tanstack/vue-query'
import type { OrganizationStatus } from '#shared/types/api'

/** The Drive for Organizations license, for the owners: seats, expiry, whether members can be added. */
export function useOrganization() {
  const { isOwner } = useRole()
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ organization: OrganizationStatus }>('/api/settings'),
    enabled: isOwner,
  })
  return computed(() => data.value?.organization ?? null)
}
