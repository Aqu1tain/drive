<script setup lang="ts" generic="T extends string">
import type { Component } from 'vue'

const model = defineModel<T>({ required: true })
defineProps<{ options: Array<{ value: T, label: string, icon: Component }>, label: string }>()
</script>

<template>
  <div role="radiogroup" :aria-label="label" class="inline-flex rounded-md border border-line p-0.5">
    <UiTooltip v-for="option in options" :key="option.value" :label="option.label">
      <button
        type="button"
        role="radio"
        :aria-checked="model === option.value"
        :aria-label="option.label"
        class="inline-flex h-7 w-8 items-center justify-center rounded-[5px] transition-colors duration-150"
        :class="model === option.value ? 'bg-selected text-accent-ink' : 'text-ink-weak hover:bg-hover hover:text-ink'"
        @click="model = option.value"
      >
        <component :is="option.icon" class="size-4" aria-hidden="true" />
      </button>
    </UiTooltip>
  </div>
</template>
