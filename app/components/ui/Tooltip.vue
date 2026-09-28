<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'

withDefaults(defineProps<{
  label: string
  shortcut?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}>(), { side: 'bottom' })
</script>

<template>
  <TooltipRoot>
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent
        :side="side"
        :side-offset="6"
        class="z-(--z-tooltip) flex items-center gap-2 rounded-md bg-inverse px-2 py-1 text-sm text-ink-inverse shadow-raised animate-fade-in select-none"
      >
        {{ label }}
        <UiKbd v-if="shortcut" :keys="shortcut" tone="inverse" />
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
