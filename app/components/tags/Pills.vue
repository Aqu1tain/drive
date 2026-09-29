<script setup lang="ts">
const props = withDefaults(defineProps<{ ids?: string[], max?: number }>(), { ids: () => [], max: 2 })
const { tags } = useTags()
const known = computed(() => tags.value.filter(tag => props.ids.includes(tag.id)))
const hidden = computed(() => known.value.slice(props.max))
</script>

<template>
  <span v-if="known.length" class="flex min-w-0 shrink-[20] items-center gap-1">
    <span
      v-for="tag in known.slice(0, max)"
      :key="tag.id"
      class="inline-flex h-5 min-w-0 items-center gap-1 rounded-full border border-line-weak px-1.5 text-xs text-ink-weak @max-[20rem]:border-0 @max-[20rem]:px-0"
      :title="tag.name"
    >
      <span class="size-2 shrink-0 rounded-full" :style="{ background: tag.color }" aria-hidden="true" />
      <span class="truncate @max-[20rem]:sr-only">{{ tag.name }}</span>
    </span>
    <span v-if="hidden.length" class="shrink-0 text-xs text-ink-weak" :title="hidden.map(tag => tag.name).join(', ')">+{{ hidden.length }}</span>
  </span>
</template>
