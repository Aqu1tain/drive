<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { Share2 } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

const { t } = useI18n()
useHead({ title: t('views.shared.title') })
const { data, isPending } = useQuery({
  queryKey: ['list', 'shared'],
  queryFn: () => api<{ items: ResourceItem[] }>('/api/shared'),
})
</script>

<template>
  <FilesDriveView :items="data?.items ?? []" :loading="isPending" mode="member" :label="t('views.shared.label')" :title="t('views.shared.title')" show-location :folder-to="id => `/drive/folder/${id}`">
    <template #empty>
      <UiEmptyState :icon="Share2" :title="t('views.shared.empty')" :description="t('views.shared.emptyHint')" />
    </template>
  </FilesDriveView>
</template>
