<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { Share2 } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

useHead({ title: 'Partagés' })
const { data, isPending } = useQuery({
  queryKey: ['list', 'shared'],
  queryFn: () => api<{ items: ResourceItem[] }>('/api/shared'),
})
</script>

<template>
  <FilesDriveView :items="data?.items ?? []" :loading="isPending" mode="owner" label="Éléments partagés" title="Partagés" show-location :folder-to="id => `/drive/folder/${id}`">
    <template #empty>
      <UiEmptyState :icon="Share2" title="Aucun fichier partagé" description="Les fichiers que vous partagerez apparaîtront ici, avec les personnes qui y ont accès." />
    </template>
  </FilesDriveView>
</template>
