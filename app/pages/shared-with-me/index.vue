<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { Inbox } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

useHead({ title: 'Partagé avec moi' })
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
    label="Documents partagés avec moi"
    title="Documents auxquels vous avez accès"
    :folder-to="id => `/shared-with-me/folder/${id}`"
  >
    <template #empty>
      <UiEmptyState :icon="Inbox" title="Rien pour l’instant" description="Les documents que l’on vous partage apparaîtront ici." />
    </template>
  </FilesDriveView>
</template>
