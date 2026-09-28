<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { Trash2 } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

useHead({ title: 'Corbeille' })
const actions = useFileActions()
const { data, isPending } = useQuery({
  queryKey: ['list', 'trash'],
  queryFn: () => api<{ items: ResourceItem[] }>('/api/trash'),
})
</script>

<template>
  <FilesDriveView :items="data?.items ?? []" :loading="isPending" mode="owner" label="Corbeille" title="Corbeille" trash show-location :can-details="false">
    <template #actions>
      <UiButton v-if="data?.items.length" size="sm" variant="ghost" class="text-danger" @click="actions.emptyTrash()">Vider la corbeille</UiButton>
    </template>
    <template #above>
      <p v-if="data?.items.length" class="mx-4 mb-2 rounded-lg bg-subtle px-4 py-2.5 text-sm text-ink-weak">
        Les éléments restent ici jusqu’à leur suppression définitive. Ils ne sont plus accessibles aux personnes avec qui vous les aviez partagés.
      </p>
    </template>
    <template #empty>
      <UiEmptyState :icon="Trash2" title="La corbeille est vide" description="Les éléments supprimés restent ici, restaurables, jusqu’à ce que vous les supprimiez définitivement." />
    </template>
  </FilesDriveView>
</template>
