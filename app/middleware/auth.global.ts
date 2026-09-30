import type { SessionUser } from '#shared/types/api'

const PUBLIC = [/^\/login/, /^\/setup/, /^\/invite\//, /^\/s\//]
const OWNER_ROUTES = [/^\/shared$/, /^\/activity/, /^\/people/]
const READER_ROUTES = [/^\/shared-with-me/, /^\/recent/, /^\/starred/, /^\/open\//, /^\/search/, /^\/settings/, /^\/oauth\//]

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

  if (to.path === '/') return navigateTo(user.role === 'reader' ? '/shared-with-me' : '/home')
  if (user.role === 'reader' && !READER_ROUTES.some(pattern => pattern.test(to.path))) return navigateTo('/shared-with-me')
  if (user.role === 'member' && OWNER_ROUTES.some(pattern => pattern.test(to.path))) return navigateTo('/drive')
  if (user.role !== 'reader' && to.path.startsWith('/shared-with-me')) return navigateTo('/drive')
})
