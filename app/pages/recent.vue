<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { Clock } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

useHead({ title: 'Récents' })
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
    label="Fichiers récents"
    title="Récents"
    show-location
    :sortable="false"
    :folder-to="id => mode === 'owner' ? `/drive/folder/${id}` : `/shared-with-me/folder/${id}`"
  >
    <template #empty>
      <UiEmptyState :icon="Clock" title="Aucun fichier récent" :description="mode === 'owner' ? 'Les fichiers que vous importez, modifiez ou ouvrez apparaîtront ici.' : 'Les documents que vous consultez apparaîtront ici.'" />
    </template>
  </FilesDriveView>
</template>
