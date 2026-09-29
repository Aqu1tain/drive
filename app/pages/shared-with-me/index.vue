<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { Inbox } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

const { t } = useI18n()
useHead({ title: t('labels.sharedWithMe') })
const { data, isPending } = useQuery({
  queryKey: ['list', 'shared-with-me'],
  queryFn: () => api<{ items: ResourceItem[] }>('/api/shared-with-me'),
})
</script>

<template>
  <FilesDriveView
    :items="data?.items ?? []"
    :loading="isPending"
    mode="reader"
    :label="t('views.sharedWithMe.label')"
    :title="t('views.sharedWithMe.heading')"
    :folder-to="id => `/shared-with-me/folder/${id}`"
  >
    <template #empty>
      <UiEmptyState :icon="Inbox" :title="t('views.sharedWithMe.empty')" :description="t('views.sharedWithMe.emptyHint')" />
    </template>
  </FilesDriveView>
</template>
