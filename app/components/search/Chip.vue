<script setup lang="ts">
import type { Component } from 'vue'
import { ChevronDown, X } from '@lucide/vue'

defineProps<{ icon: Component, label: string, value?: string | null, entries: MenuEntry[] }>()
defineEmits<{ clear: [] }>()
const { t } = useI18n()
</script>

<template>
  <span v-if="value" class="inline-flex h-8 items-center gap-1.5 rounded-full bg-selected pr-1 pl-3 text-sm font-medium text-accent-ink">
    <component :is="icon" class="size-3.5" aria-hidden="true" />
    {{ value }}
    <button type="button" class="rounded-full p-1 hover:bg-hover" :aria-label="t('search.removeFilter', { name: label })" @click="$emit('clear')"><X class="size-3.5" aria-hidden="true" /></button>
  </span>
  <UiDropdownMenu v-else :entries="entries">
    <button type="button" class="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-medium text-ink transition-colors hover:bg-hover data-[state=open]:bg-hover">
      <component :is="icon" class="size-3.5 text-ink-weak" aria-hidden="true" />
      {{ label }}
      <ChevronDown class="size-3.5 text-ink-weak" aria-hidden="true" />
    </button>
  </UiDropdownMenu>
</template>
