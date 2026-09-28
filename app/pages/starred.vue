<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { Star } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

useHead({ title: 'Favoris' })
const { data, isPending } = useQuery({
  queryKey: ['list', 'starred'],
  queryFn: () => api<{ items: ResourceItem[] }>('/api/starred'),
})
</script>

<template>
  <FilesDriveView :items="data?.items ?? []" :loading="isPending" mode="owner" label="Favoris" title="Favoris" show-location :folder-to="id => `/drive/folder/${id}`">
    <template #empty>
      <UiEmptyState :icon="Star" title="Aucun favori" description="Ajoutez une étoile à un fichier ou un dossier (touche S) pour le retrouver ici en un clic." />
    </template>
  </FilesDriveView>
</template>
