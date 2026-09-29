<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { Star } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

const { t } = useI18n()
useHead({ title: t('views.starred.title') })
const { data: me } = useMe()
const mode = computed(() => me.value?.user?.role === 'owner' ? 'owner' as const : 'reader' as const)
const { data, isPending } = useQuery({
  queryKey: ['list', 'starred'],
  queryFn: () => api<{ items: ResourceItem[] }>('/api/starred'),
})
</script>

<template>
  <FilesDriveView
    :items="data?.items ?? []"
    :loading="isPending"
    :mode="mode"
    :label="t('views.starred.title')"
    :title="t('views.starred.title')"
    show-location
    :folder-to="id => mode === 'owner' ? `/drive/folder/${id}` : `/shared-with-me/folder/${id}`"
  >
    <template #empty>
      <UiEmptyState :icon="Star" :title="t('views.starred.empty')" :description="t('views.starred.emptyHint')" />
    </template>
  </FilesDriveView>
</template>
