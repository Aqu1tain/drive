<script setup lang="ts">
import { Link2Off } from '@lucide/vue'

const props = defineProps<{ status?: number }>()
const { t } = useI18n()
const gone = computed(() => props.status === 410)
const title = computed(() => t(gone.value ? 'publicPage.gone' : 'publicPage.notFound'))
const description = computed(() => t(gone.value ? 'publicPage.goneText' : 'publicPage.notFoundText'))
useHead({ title })
</script>

<template>
  <div class="flex flex-1 items-center justify-center p-6">
    <UiEmptyState :icon="Link2Off" :title="title" :description="description" />
  </div>
</template>
