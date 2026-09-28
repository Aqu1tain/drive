<script setup lang="ts">
import { ContextMenuItem, ContextMenuSeparator, DropdownMenuItem, DropdownMenuSeparator } from 'reka-ui'

const props = defineProps<{ entries: MenuEntry[], variant: 'dropdown' | 'context' }>()
const Item = computed(() => props.variant === 'dropdown' ? DropdownMenuItem : ContextMenuItem)
const Separator = computed(() => props.variant === 'dropdown' ? DropdownMenuSeparator : ContextMenuSeparator)
</script>

<template>
  <template v-for="(entry, index) in entries" :key="isAction(entry) ? entry.id : `sep-${index}`">
    <component :is="Separator" v-if="!isAction(entry)" class="mx-2 my-1 h-px bg-line-weak" />
    <component
      :is="Item"
      v-else
      :disabled="entry.disabled"
      :class="[MENU_ITEM, entry.danger && 'text-danger']"
      @select="entry.onSelect()"
    >
      <component :is="entry.icon" v-if="entry.icon" class="size-4 shrink-0" :class="entry.danger ? 'text-danger' : 'text-ink-weak'" aria-hidden="true" />
      <span class="flex-1 truncate">{{ entry.label }}</span>
      <UiKbd v-if="entry.shortcut" :keys="entry.shortcut" class="ml-4" />
    </component>
  </template>
</template>
