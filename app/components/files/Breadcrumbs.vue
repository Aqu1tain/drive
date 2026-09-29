<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import type { Crumb } from '#shared/types/api'

const props = defineProps<{ crumbs: Crumb[], to: (crumb: Crumb) => string, droppable?: boolean, loading?: boolean }>()
const emit = defineEmits<{ drop: [crumb: Crumb, event: DragEvent] }>()
const { t } = useI18n()

const MAX_VISIBLE = 4
const collapsed = computed(() => props.crumbs.length > MAX_VISIBLE)
const visible = computed(() => collapsed.value ? [props.crumbs[0]!, ...props.crumbs.slice(-2)] : props.crumbs)
const hidden = computed(() => collapsed.value ? props.crumbs.slice(1, -2) : [])
const hiddenEntries = computed<MenuEntry[]>(() => hidden.value.map(crumb => ({ id: String(crumb.id), label: crumb.name, onSelect: () => navigateTo(props.to(crumb)) })))
const dropTarget = ref<string | null>(null)

function onDragOver(event: DragEvent, crumb: Crumb) {
  if (!props.droppable || !event.dataTransfer?.types.includes('application/x-drive-ids')) return
  event.preventDefault()
  dropTarget.value = String(crumb.id)
}

function onDrop(event: DragEvent, crumb: Crumb) {
  dropTarget.value = null
  if (!props.droppable || !event.dataTransfer?.types.includes('application/x-drive-ids')) return
  event.preventDefault()
  emit('drop', crumb, event)
}
</script>

<template>
  <nav :aria-label="t('files.breadcrumb')" class="min-w-0">
    <ol class="flex min-w-0 items-center gap-0.5">
      <template v-for="(crumb, index) in visible" :key="String(crumb.id)">
        <li v-if="index === 1 && hidden.length" class="flex items-center gap-0.5">
          <UiDropdownMenu :entries="hiddenEntries">
            <button type="button" class="h-8 rounded-md px-2 text-lg text-ink-weak hover:bg-hover" :aria-label="t('files.hiddenFolders')">…</button>
          </UiDropdownMenu>
          <ChevronRight class="size-4 shrink-0 text-ink-hint" aria-hidden="true" />
        </li>
        <li class="flex min-w-0 items-center gap-0.5" :class="index === visible.length - 1 ? 'min-w-0' : 'shrink-0'">
          <span v-if="index === visible.length - 1" aria-current="page" class="truncate px-2 text-lg font-semibold text-ink">
            {{ crumb.name }}
          </span>
          <NuxtLink
            v-else
            :to="to(crumb)"
            class="max-w-48 truncate rounded-md px-2 py-1 text-lg text-ink-weak transition-colors hover:bg-hover hover:text-ink"
            :class="dropTarget === String(crumb.id) && 'bg-selected text-accent-ink ring-2 ring-accent'"
            @dragover="onDragOver($event, crumb)"
            @dragleave="dropTarget = null"
            @drop="onDrop($event, crumb)"
          >
            {{ crumb.name }}
          </NuxtLink>
          <ChevronRight v-if="index < visible.length - 1" class="size-4 shrink-0 text-ink-hint" aria-hidden="true" />
        </li>
      </template>
      <li v-if="loading" class="px-2"><UiSkeleton width="8rem" height="1.1rem" /></li>
    </ol>
  </nav>
</template>
