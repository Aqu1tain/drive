<script setup lang="ts">
import { ArrowDown, ArrowUp } from '@lucide/vue'

defineProps<{ label: string, sort?: 'ascending' | 'descending' | 'none', disabled?: boolean, align?: 'start' | 'end' }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <div role="columnheader" :aria-sort="disabled ? undefined : sort" :class="align === 'end' && 'text-right'">
    <span v-if="disabled">{{ label }}</span>
    <button
      v-else
      type="button"
      tabindex="-1"
      class="-mx-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 transition-colors hover:bg-hover hover:text-ink"
      :class="sort !== 'none' && 'text-ink'"
      @click="$emit('click')"
    >
      {{ label }}
      <ArrowUp v-if="sort === 'ascending'" class="size-3.5" aria-hidden="true" />
      <ArrowDown v-else-if="sort === 'descending'" class="size-3.5" aria-hidden="true" />
    </button>
  </div>
</template>
