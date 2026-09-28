<script setup lang="ts">
import { DropdownMenuContent, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'

withDefaults(defineProps<{ entries: MenuEntry[], align?: 'start' | 'center' | 'end', side?: 'top' | 'bottom' | 'left' | 'right' }>(), { align: 'start', side: 'bottom' })
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <DropdownMenuRoot v-model:open="open" :modal="false">
    <DropdownMenuTrigger as-child>
      <slot />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent :align="align" :side="side" :side-offset="4" :collision-padding="8" :class="MENU_CONTENT">
        <slot name="header" />
        <UiMenuItems :entries="entries" variant="dropdown" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
