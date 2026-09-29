<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { Clock } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

const { t } = useI18n()
useHead({ title: t('views.recent.title') })
const { data: me } = useMe()
const mode = computed(() => me.value?.user?.role === 'owner' ? 'owner' as const : 'reader' as const)
const { data, isPending } = useQuery({
  queryKey: ['list', 'recent'],
  queryFn: () => api<{ items: ResourceItem[] }>('/api/recent'),
})
</script>

<template>
  <FilesDriveView
    :items="data?.items ?? []"
    :loading="isPending"
    :mode="mode"
    :label="t('views.recent.label')"
    :title="t('views.recent.title')"
    show-location
    :sortable="false"
    :folder-to="id => mode === 'owner' ? `/drive/folder/${id}` : `/shared-with-me/folder/${id}`"
  >
    <template #empty>
      <UiEmptyState :icon="Clock" :title="t('views.recent.empty')" :description="t(mode === 'owner' ? 'views.recent.emptyOwner' : 'views.recent.emptyReader')" />
    </template>
  </FilesDriveView>
</template>
