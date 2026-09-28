<script setup lang="ts">
import { Link2Off } from '@lucide/vue'

const props = defineProps<{ status?: number }>()
const title = computed(() => props.status === 410 ? 'Ce lien n’est plus actif' : 'Lien introuvable')
const description = computed(() => props.status === 410
  ? 'Il a expiré ou a été désactivé par la personne qui l’a partagé. Demandez-lui un nouveau lien.'
  : 'Vérifiez l’adresse, ou demandez un nouveau lien à la personne qui vous l’a envoyé.')
useHead({ title })
</script>

<template>
  <div class="flex flex-1 items-center justify-center p-6">
    <UiEmptyState :icon="Link2Off" :title="title" :description="description" />
  </div>
</template>
