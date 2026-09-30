<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { SearchX } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'
import { parseSearchQuery, stringifySearchQuery, type SearchQuery } from '#shared/utils/search'

const route = useRoute()
const { t } = useI18n()
const { isOwner, isMember } = useRole()
const mode = computed(() => isMember.value ? 'member' as const : 'reader' as const)
const q = computed(() => String(route.query.q ?? ''))
const parsed = computed(() => parseSearchQuery(q.value))
const { tags } = useTags(isMember)
const tagName = computed(() => parsed.value.tag && (tags.value.find(tag => tag.name.toLowerCase() === parsed.value.tag)?.name ?? parsed.value.tag))
useHead({ title: computed(() => q.value ? t('search.quoted', { query: parsed.value.terms.join(' ') || tagName.value || q.value }) : t('search.title')) })

const { data, isPending } = useQuery({
  queryKey: computed(() => ['search', 'page', q.value]),
  queryFn: () => api<{ items: ResourceItem[] }>('/api/search', { query: { q: q.value, limit: 200 } }),
  enabled: computed(() => !!q.value.trim()),
})

function update(patch: Partial<SearchQuery>) {
  navigateTo({ path: '/search', query: { q: stringifySearchQuery({ ...parsed.value, ...patch }) } }, { replace: true })
}

const title = computed(() => {
  if (parsed.value.terms.length) return t('search.resultsFor', { query: parsed.value.terms.join(' ') })
  return tagName.value ? t('search.tagged', { name: tagName.value }) : t('search.results')
})
</script>

<template>
  <FilesDriveView
    :items="q ? data?.items ?? [] : []"
    :loading="!!q && isPending"
    :mode="mode"
    :label="t('search.label')"
    :title="title"
    show-location
    :sortable="false"
    :folder-to="id => mode === 'member' ? `/drive/folder/${id}` : `/shared-with-me/folder/${id}`"
  >
    <template #above>
      <SearchChips :query="parsed" :owner="isOwner" class="px-4 pb-2" @update="update" />
    </template>
    <template #empty>
      <UiEmptyState
        :icon="SearchX"
        :title="q ? t('search.noResults', { query: parsed.terms.join(' ') || q }) : t('search.prompt')"
        :description="t(q ? 'search.noResultsHint' : 'search.promptHint')"
      >
        <UiButton v-if="q && (parsed.type || parsed.access || parsed.after || parsed.sharedWith)" @click="update({ type: undefined, access: undefined, after: undefined, before: undefined, sharedWith: undefined })">{{ t('search.clearFilters') }}</UiButton>
      </UiEmptyState>
    </template>
  </FilesDriveView>
</template>
