import type { SessionUser } from '#shared/types/api'

const PUBLIC = [/^\/login/, /^\/setup/, /^\/invite\//, /^\/s\//]
const READER_ROUTES = [/^\/shared-with-me/, /^\/recent/, /^\/open\//, /^\/search/, /^\/settings/]

export default defineNuxtRouteMiddleware(async (to) => {
  if (PUBLIC.some(pattern => pattern.test(to.path))) return
  if (import.meta.server) return

  const { $queryClient } = useNuxtApp()
  const me = await $queryClient.fetchQuery({
    queryKey: ['me'],
    queryFn: () => api<{ user: SessionUser | null, emailEnabled: boolean }>('/api/me'),
    staleTime: 60_000,
  }).catch(() => null)
  const user = me?.user

  if (!user) {
    const setup = await api<{ needed: boolean }>('/api/setup').catch(() => ({ needed: false }))
    if (setup.needed) return navigateTo('/setup')
    return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined })
  }

  if (to.path === '/') return navigateTo(user.role === 'owner' ? '/home' : '/shared-with-me')
  if (user.role === 'reader' && !READER_ROUTES.some(pattern => pattern.test(to.path))) return navigateTo('/shared-with-me')
  if (user.role === 'owner' && to.path.startsWith('/shared-with-me')) return navigateTo('/drive')
})
