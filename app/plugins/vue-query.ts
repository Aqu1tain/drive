import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

export default defineNuxtPlugin((nuxtApp) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: (count, error) => count < 2 && (error as { statusCode?: number }).statusCode === undefined },
    },
  })
  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })
  return { provide: { queryClient } }
})
