<script setup lang="ts">
import { ContextMenuContent, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from 'reka-ui'

defineProps<{ entries: MenuEntry[], disabled?: boolean }>()
const emit = defineEmits<{ open: [], close: [] }>()
</script>

<template>
  <ContextMenuRoot :modal="false" @update:open="value => value ? emit('open') : emit('close')">
    <ContextMenuTrigger as-child :disabled="disabled">
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent v-if="entries.length" :collision-padding="8" :class="MENU_CONTENT">
        <UiMenuItems :entries="entries" variant="context" />
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
