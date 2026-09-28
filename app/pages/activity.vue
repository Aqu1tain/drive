<script setup lang="ts">
import { useInfiniteQuery } from '@tanstack/vue-query'
import { History } from '@lucide/vue'
import type { ActivityEvent } from '#shared/types/api'

useHead({ title: 'Activité' })
const filter = ref<'all' | 'views' | 'downloads' | 'sharing'>('all')
const FILTERS = [['all', 'Tout'], ['views', 'Consultations'], ['downloads', 'Téléchargements'], ['sharing', 'Partages']] as const

const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: computed(() => ['activity', 'feed', filter.value]),
  queryFn: ({ pageParam }) => api<{ events: ActivityEvent[], next: number | null }>('/api/activity', { query: { filter: filter.value, before: pageParam ?? undefined, limit: 60 } }),
  initialPageParam: null as number | null,
  getNextPageParam: last => last.next,
})
const events = computed(() => data.value?.pages.flatMap(page => page.events) ?? [])
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
      <h1 class="mb-1 text-xl font-semibold text-ink">Activité</h1>
      <p class="mb-5 text-base text-ink-weak">Qui a consulté quoi, et quand. Les visiteurs de liens publics restent anonymes.</p>
      <div class="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Filtrer l’activité">
        <button
          v-for="[value, label] in FILTERS"
          :key="value"
          type="button"
          role="tab"
          :aria-selected="filter === value"
          class="h-8 rounded-full px-3.5 text-sm font-medium transition-colors"
          :class="filter === value ? 'bg-inverse text-ink-inverse' : 'border border-line text-ink hover:bg-hover'"
          @click="filter = value"
        >
          {{ label }}
        </button>
      </div>
      <div v-if="isPending" class="flex flex-col gap-4"><UiSkeleton v-for="n in 6" :key="n" height="2.5rem" /></div>
      <UiEmptyState v-else-if="!events.length" :icon="History" title="Aucune activité" description="Dès que quelqu’un consultera ou téléchargera un document partagé, vous le verrez ici." />
      <template v-else>
        <ActivityList :events="events" />
        <div class="mt-6 flex justify-center">
          <UiButton v-if="hasNextPage" :loading="isFetchingNextPage" @click="fetchNextPage()">Afficher plus</UiButton>
        </div>
      </template>
    </div>
  </div>
</template>
