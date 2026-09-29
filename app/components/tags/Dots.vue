<script setup lang="ts">
const props = withDefaults(defineProps<{ ids?: string[] }>(), { ids: () => [] })
const { tags } = useTags()
const known = computed(() => tags.value.filter(tag => props.ids.includes(tag.id)))
</script>

<template>
  <span v-if="known.length" class="flex shrink-0 -space-x-0.5" :title="known.map(tag => tag.name).join(', ')" :aria-label="`Étiquettes : ${known.map(tag => tag.name).join(', ')}`" role="img">
    <span v-for="tag in known.slice(0, 3)" :key="tag.id" class="size-2.5 rounded-full ring-2 ring-canvas" :style="{ background: tag.color }" />
  </span>
</template>
