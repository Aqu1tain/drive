<script setup lang="ts">
import type { Component } from 'vue'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  icon: Component
  label: string
  shortcut?: string
  size?: 'sm' | 'md'
  active?: boolean
  tone?: 'default' | 'nav' | 'inverse'
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'
}>(), { size: 'md', tone: 'default', tooltipSide: 'bottom' })
</script>

<template>
  <UiTooltip :label="label" :shortcut="shortcut" :side="tooltipSide">
    <button
      v-bind="$attrs"
      type="button"
      :aria-label="label"
      :aria-pressed="active === undefined ? undefined : active"
      class="inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:opacity-40"
      :class="[
        size === 'sm' ? 'size-7' : 'size-9',
        tone === 'nav' && 'text-nav-ink-weak hover:bg-nav-hover hover:text-nav-ink',
        tone === 'inverse' && 'text-white/80 hover:bg-white/10 hover:text-white',
        tone === 'default' && (active ? 'bg-selected text-accent-ink' : 'text-ink-weak hover:bg-hover hover:text-ink'),
      ]"
    >
      <component :is="icon" :class="size === 'sm' ? 'size-4' : 'size-[18px]'" aria-hidden="true" />
    </button>
  </UiTooltip>
</template>
