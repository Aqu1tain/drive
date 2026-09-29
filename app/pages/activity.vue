<script setup lang="ts">
import { useInfiniteQuery } from '@tanstack/vue-query'
import { History } from '@lucide/vue'
import type { ActivityEvent } from '#shared/types/api'

const { t } = useI18n()
useHead({ title: t('activity.title') })
const filter = ref<'all' | 'views' | 'downloads' | 'sharing'>('all')
const FILTERS = ['all', 'views', 'downloads', 'sharing'] as const

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
      <h1 class="mb-1 text-xl font-semibold text-ink">{{ t('activity.title') }}</h1>
      <p class="mb-5 text-base text-ink-weak">{{ t('activity.intro') }}</p>
      <div class="mb-6 flex flex-wrap gap-2" role="tablist" :aria-label="t('activity.filter')">
        <button
          v-for="value in FILTERS"
          :key="value"
          type="button"
          role="tab"
          :aria-selected="filter === value"
          class="h-8 rounded-full px-3.5 text-sm font-medium transition-colors"
          :class="filter === value ? 'bg-inverse text-ink-inverse' : 'border border-line text-ink hover:bg-hover'"
          @click="filter = value"
        >
          {{ t(`activity.filters.${value}`) }}
        </button>
      </div>
      <div v-if="isPending" class="flex flex-col gap-4"><UiSkeleton v-for="n in 6" :key="n" height="2.5rem" /></div>
      <UiEmptyState v-else-if="!events.length" :icon="History" :title="t('activity.empty')" :description="t('activity.emptyHint')" />
      <template v-else>
        <ActivityList :events="events" />
        <div class="mt-6 flex justify-center">
          <UiButton v-if="hasNextPage" :loading="isFetchingNextPage" @click="fetchNextPage()">{{ t('activity.showMore') }}</UiButton>
        </div>
      </template>
    </div>
  </div>
</template>
