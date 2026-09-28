<script setup lang="ts">
import { EllipsisVertical, Star } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

defineProps<{
  item: ResourceItem
  index: number
  height: number
  selected: boolean
  focused: boolean
  dropTarget: boolean
  dragging: boolean
  draggable: boolean
  trash?: boolean
  showAccess: boolean
  menu: MenuEntry[]
}>()
const emit = defineEmits<{ menuOpen: [] }>()
const failed = ref(false)
</script>

<template>
  <div
    role="gridcell"
    :aria-selected="selected"
    :data-index="index"
    :data-folder-id="item.type === 'folder' && !trash ? item.id : undefined"
    :data-folder-name="item.type === 'folder' ? item.name : undefined"
    :draggable="draggable"
    class="group flex flex-col overflow-hidden rounded-lg border p-1.5 select-none transition-colors duration-100"
    :class="[
      selected ? 'border-accent/40 bg-selected' : 'border-line-weak bg-canvas hover:bg-hover',
      dropTarget && 'ring-2 ring-accent',
      focused && 'outline-2 outline-offset-1 outline-focus',
      dragging && 'opacity-50',
    ]"
    :style="{ height: `${height}px` }"
  >
    <div class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md bg-subtle">
      <img
        v-if="item.thumbnailUrl && !failed"
        :src="item.thumbnailUrl"
        alt=""
        loading="lazy"
        decoding="async"
        draggable="false"
        class="size-full object-cover"
        @error="failed = true"
      >
      <FilesFileIcon v-else :kind="item.kind" size="xl" />
    </div>
    <div class="flex h-10 items-center gap-2 pr-0.5 pl-1.5">
      <FilesFileIcon :kind="item.kind" size="sm" class="shrink-0" />
      <span class="min-w-0 flex-1 truncate text-base text-ink" :title="item.name">{{ item.name }}</span>
      <Star v-if="item.starred" class="size-3.5 shrink-0 fill-current text-[#f0a500]" aria-label="Favori" />
      <FilesAccessCell v-if="showAccess && item.access?.level !== 'private'" :access="item.access" compact />
      <UiDropdownMenu :entries="menu" align="end" @update:open="(open: boolean) => open && emit('menuOpen')" @click.stop>
        <button
          type="button"
          tabindex="-1"
          :aria-label="`Actions pour ${item.name}`"
          class="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-ink-weak hover:bg-hover hover:text-ink data-[state=open]:bg-hover"
          @click.stop
          @dblclick.stop
        >
          <EllipsisVertical class="size-4" aria-hidden="true" />
        </button>
      </UiDropdownMenu>
    </div>
  </div>
</template>
