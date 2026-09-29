<script setup lang="ts">
import { Folder } from '@lucide/vue'

const props = defineProps<{ urls: string[] }>()
const tiles = computed(() => props.urls.slice(0, 4))
const LAYOUTS = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-2 grid-rows-2', 'grid-cols-2 grid-rows-2']
</script>

<template>
  <div class="relative grid size-full gap-0.5" :class="LAYOUTS[tiles.length]">
    <img
      v-for="(url, index) in tiles"
      :key="url"
      :src="url"
      alt=""
      loading="lazy"
      decoding="async"
      draggable="false"
      class="size-full min-h-0 object-cover"
      :class="tiles.length === 3 && index === 0 && 'row-span-2'"
    >
    <span class="absolute bottom-1.5 left-1.5 flex size-7 items-center justify-center rounded-md bg-canvas/90 text-accent shadow-raised" aria-hidden="true">
      <Folder class="size-4" />
    </span>
  </div>
</template>
