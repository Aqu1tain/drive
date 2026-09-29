<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { SearchX } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'
import { parseSearchQuery, stringifySearchQuery, type SearchQuery } from '#shared/utils/search'

const route = useRoute()
const { data: me } = useMe()
const mode = computed(() => me.value?.user?.role === 'owner' ? 'owner' as const : 'reader' as const)
const q = computed(() => String(route.query.q ?? ''))
const parsed = computed(() => parseSearchQuery(q.value))
const { tags } = useTags(computed(() => mode.value === 'owner'))
const tagName = computed(() => parsed.value.tag && (tags.value.find(tag => tag.name.toLowerCase() === parsed.value.tag)?.name ?? parsed.value.tag))
useHead({ title: computed(() => q.value ? `« ${parsed.value.terms.join(' ') || tagName.value || q.value} »` : 'Recherche') })

const { data, isPending } = useQuery({
  queryKey: computed(() => ['search', 'page', q.value]),
  queryFn: () => api<{ items: ResourceItem[] }>('/api/search', { query: { q: q.value, limit: 200 } }),
  enabled: computed(() => !!q.value.trim()),
})

function update(patch: Partial<SearchQuery>) {
  navigateTo({ path: '/search', query: { q: stringifySearchQuery({ ...parsed.value, ...patch }) } }, { replace: true })
}

const title = computed(() => {
  if (parsed.value.terms.length) return `Résultats pour « ${parsed.value.terms.join(' ')} »`
  return tagName.value ? `Étiquette « ${tagName.value} »` : 'Résultats'
})
</script>

<template>
  <FilesDriveView
    :items="q ? data?.items ?? [] : []"
    :loading="!!q && isPending"
    :mode="mode"
    label="Résultats de recherche"
    :title="title"
    show-location
    :sortable="false"
    :folder-to="id => mode === 'owner' ? `/drive/folder/${id}` : `/shared-with-me/folder/${id}`"
  >
    <template #above>
      <SearchChips :query="parsed" :owner="mode === 'owner'" class="px-4 pb-2" @update="update" />
    </template>
    <template #empty>
      <UiEmptyState
        :icon="SearchX"
        :title="q ? `Aucun résultat pour « ${parsed.terms.join(' ') || q} »` : 'Que cherchez-vous ?'"
        :description="q ? 'Essayez de modifier votre recherche ou de retirer certains filtres.' : 'Tapez un nom de fichier, de dossier ou de personne dans la barre de recherche.'"
      >
        <UiButton v-if="q && (parsed.type || parsed.access || parsed.after || parsed.sharedWith)" @click="update({ type: undefined, access: undefined, after: undefined, before: undefined, sharedWith: undefined })">Retirer les filtres</UiButton>
      </UiEmptyState>
    </template>
  </FilesDriveView>
</template>
