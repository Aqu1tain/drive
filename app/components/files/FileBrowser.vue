<script setup lang="ts">
import { useVirtualizer } from '@tanstack/vue-virtual'
import { ArrowDown, ArrowUp, EllipsisVertical, FolderPlus, Star, Upload } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

const props = withDefaults(defineProps<{
  items: ResourceItem[]
  label: string
  mode: BrowserMode
  loading?: boolean
  folder?: { id: string | null, name: string } | null
  trash?: boolean
  showLocation?: boolean
  sortable?: boolean
  apiBase?: string
  previewId?: string | null
}>(), { sortable: true, apiBase: '/api', folder: null, previewId: null })

const emit = defineEmits<{
  open: [item: ResourceItem]
  preview: [item: ResourceItem]
  follow: [item: ResourceItem]
  closePreview: []
  dropFiles: [target: { id: string | null, name: string }, transfer: DataTransfer]
  fileDrag: [target: { id: string | null, name: string } | null]
}>()

const selection = defineModel<string[]>('selection', { default: () => [] })

const preferences = usePreferences()
const breakpoints = useBreakpoints()
const actions = useFileActions()
const dialogs = useDialogs()

const isOwner = computed(() => props.mode === 'owner')
const isGrid = computed(() => preferences.view === 'grid')
const width = ref(0)

/** Columns follow the list's own width, not the window: the preview panel can halve it. */
const room = computed(() => {
  const w = width.value || 1200
  return { wide: w >= 520, size: w >= 600, access: w >= 700, location: w >= 860, viewed: w >= 980 }
})
const rowHeight = computed(() => !room.value.wide ? 56 : preferences.density === 'compact' ? 36 : 44)

type SortKey = typeof preferences.sortBy
const COMPARE: Record<SortKey, (a: ResourceItem, b: ResourceItem) => number> = {
  name: (a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' }),
  updatedAt: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
  size: (a, b) => a.size - b.size,
  lastExternalViewAt: (a, b) => (a.lastExternalViewAt ?? '').localeCompare(b.lastExternalViewAt ?? ''),
}

const sorted = computed(() => {
  if (!props.sortable) return props.items
  const direction = preferences.sortDir === 'asc' ? 1 : -1
  const compare = COMPARE[preferences.sortBy] ?? COMPARE.name
  return props.items.toSorted((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return compare(a, b) * direction || COMPARE.name(a, b)
  })
})

const selectedSet = computed(() => new Set(selection.value))
const selectedItems = computed(() => sorted.value.filter(item => selectedSet.value.has(item.id)))
const indexById = computed(() => new Map(sorted.value.map((item, index) => [item.id, index])))

const focusIndex = ref(-1)
const anchorIndex = ref(-1)
const keyboardFocus = ref(false)
const scroller = useTemplateRef<HTMLElement>('scroller')
const grid = useTemplateRef<HTMLElement>('grid')

const columns = computed(() => isGrid.value ? Math.max(1, Math.floor((width.value - 24 + 12) / ((breakpoints.sm ? 196 : 150) + 12))) : 1)
const cardHeight = computed(() => breakpoints.sm ? 212 : 180)

const virtualizer = useVirtualizer(computed(() => ({
  count: isGrid.value ? Math.ceil(sorted.value.length / columns.value) : sorted.value.length,
  getScrollElement: () => scroller.value,
  estimateSize: () => isGrid.value ? cardHeight.value + 12 : rowHeight.value,
  overscan: isGrid.value ? 3 : 12,
  paddingStart: isGrid.value ? 4 : 0,
  paddingEnd: 96,
  getItemKey: (index: number) => isGrid.value ? `row-${index}` : sorted.value[index]?.id ?? index,
})))

watch([isGrid, rowHeight, columns], () => virtualizer.value.measure())

onMounted(() => {
  const observer = new ResizeObserver(([entry]) => (width.value = entry!.contentRect.width))
  observer.observe(scroller.value!)
  onBeforeUnmount(() => observer.disconnect())
})

const show = computed(() => ({
  location: props.showLocation && room.value.location,
  access: isOwner.value && !props.trash && room.value.access,
  size: room.value.size,
  viewed: isOwner.value && !props.trash && !props.showLocation && room.value.viewed,
}))

const gridTemplate = computed(() => {
  if (!room.value.wide) return 'minmax(0,1fr) 2.5rem'
  const cols = ['minmax(12rem,1fr)']
  if (show.value.location) cols.push('minmax(0,14rem)')
  if (show.value.access) cols.push('11rem')
  cols.push(props.trash ? '9rem' : '7rem')
  if (show.value.size) cols.push('6rem')
  if (show.value.viewed) cols.push('7rem')
  cols.push('2.5rem')
  return cols.join(' ')
})

const rowId = (item: ResourceItem) => `item-${item.id}`
const activeDescendant = computed(() => {
  const item = sorted.value[focusIndex.value]
  return keyboardFocus.value && item ? rowId(item) : undefined
})

function setSelection(ids: string[]) {
  selection.value = ids
}

function selectRange(from: number, to: number, additive: boolean) {
  const [start, end] = from < to ? [from, to] : [to, from]
  const range = sorted.value.slice(start, end + 1).map(item => item.id)
  setSelection(additive ? [...new Set([...selection.value, ...range])] : range)
}

function scrollToIndex(index: number) {
  virtualizer.value.scrollToIndex(isGrid.value ? Math.floor(index / columns.value) : index, { align: 'auto' })
}

function focusAt(index: number, mode: 'select' | 'extend' | 'move') {
  const bounded = Math.max(0, Math.min(sorted.value.length - 1, index))
  if (bounded < 0 || !sorted.value[bounded]) return
  focusIndex.value = bounded
  if (mode === 'select') {
    anchorIndex.value = bounded
    setSelection([sorted.value[bounded]!.id])
  }
  if (mode === 'extend') selectRange(anchorIndex.value < 0 ? bounded : anchorIndex.value, bounded, false)
  scrollToIndex(bounded)
  if (props.previewId && sorted.value[bounded]!.type === 'file' && mode !== 'move') emit('follow', sorted.value[bounded]!)
}

let lastPointer: string = 'mouse'

function onClick(event: MouseEvent, index: number) {
  const item = sorted.value[index]!
  keyboardFocus.value = false
  grid.value?.focus({ preventScroll: true })
  if (lastPointer === 'touch' && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
    emit('open', item)
    return
  }
  focusIndex.value = index
  if (event.shiftKey) {
    selectRange(anchorIndex.value < 0 ? index : anchorIndex.value, index, event.metaKey || event.ctrlKey)
    return
  }
  anchorIndex.value = index
  if (event.metaKey || event.ctrlKey) {
    setSelection(selectedSet.value.has(item.id) ? selection.value.filter(id => id !== item.id) : [...selection.value, item.id])
    return
  }
  setSelection([item.id])
  if (props.previewId && item.type === 'file' && item.id !== props.previewId) emit('follow', item)
}

function onBackgroundClick(event: MouseEvent) {
  if ((event.target as HTMLElement).closest('[data-index]')) return
  setSelection([])
}

const menuEntries = ref<MenuEntry[]>([])

function onContextMenu(event: MouseEvent) {
  const row = (event.target as HTMLElement).closest<HTMLElement>('[data-index]')
  if (row) {
    const index = Number(row.dataset.index)
    const item = sorted.value[index]!
    if (!selectedSet.value.has(item.id)) {
      setSelection([item.id])
      anchorIndex.value = index
    }
    focusIndex.value = index
    menuEntries.value = actions.menuFor(selectedItems.value.length ? selectedItems.value : [item], menuContext.value)
    return
  }
  setSelection([])
  menuEntries.value = isOwner.value && props.folder && !props.trash
    ? [
        { id: 'new-folder', label: 'Nouveau dossier', icon: FolderPlus, onSelect: () => dialogs.newFolder(props.folder!.id) },
        { id: 'upload', label: 'Importer des fichiers', icon: Upload, onSelect: () => document.dispatchEvent(new CustomEvent('drive:upload')) },
      ]
    : []
}

const menuContext = computed(() => ({ mode: props.mode, trash: props.trash, apiBase: props.apiBase, open: (item: ResourceItem) => emit('open', item) }))
const rowMenu = (item: ResourceItem) => actions.menuFor(selectedSet.value.has(item.id) ? selectedItems.value : [item], menuContext.value)

function onRowMenuOpen(item: ResourceItem, index: number) {
  if (selectedSet.value.has(item.id)) return
  setSelection([item.id])
  anchorIndex.value = index
  focusIndex.value = index
}

function onKeydown(event: KeyboardEvent) {
  const mod = event.metaKey || event.ctrlKey
  const count = sorted.value.length
  if (count === 0) return
  keyboardFocus.value = true
  const step = isGrid.value ? columns.value : 1
  const current = focusIndex.value < 0 ? -1 : focusIndex.value
  const moveMode = event.shiftKey ? 'extend' : mod ? 'move' : 'select'
  const focused = sorted.value[current]

  switch (event.key) {
    case 'ArrowDown':
      focusAt(current < 0 ? 0 : current + step, moveMode)
      break
    case 'ArrowUp':
      focusAt(current < 0 ? 0 : current - step, moveMode)
      break
    case 'ArrowRight':
      if (!isGrid.value) return
      focusAt(current + 1, moveMode)
      break
    case 'ArrowLeft':
      if (!isGrid.value) return
      focusAt(current - 1, moveMode)
      break
    case 'Home':
      focusAt(0, moveMode)
      break
    case 'End':
      focusAt(count - 1, moveMode)
      break
    case 'PageDown':
      focusAt(current + Math.floor((scroller.value?.clientHeight ?? 400) / rowHeight.value) * step, moveMode)
      break
    case 'PageUp':
      focusAt(current - Math.floor((scroller.value?.clientHeight ?? 400) / rowHeight.value) * step, moveMode)
      break
    case 'Enter':
      if (focused) emit('open', focused)
      break
    case ' ':
      if (event.shiftKey && focused) {
        setSelection(selectedSet.value.has(focused.id) ? selection.value.filter(id => id !== focused.id) : [...selection.value, focused.id])
        break
      }
      if (focused?.type === 'file') emit('preview', focused)
      break
    case 'a':
      if (!mod) return
      setSelection(sorted.value.map(item => item.id))
      break
    case 'Escape':
      if (props.previewId) {
        emit('closePreview')
        break
      }
      if (!selection.value.length) return
      setSelection([])
      break
    case 'Delete':
    case 'Backspace':
      if (!isOwner.value || !selectedItems.value.length) return
      if (props.trash) actions.deleteForever(selectedItems.value)
      else actions.trash(selectedItems.value)
      break
    case 'F2':
      if (!isOwner.value || props.trash || selectedItems.value.length !== 1) return
      dialogs.rename(selectedItems.value[0]!)
      break
    case 's':
    case 'S':
      if (mod || !isOwner.value || props.trash || !selectedItems.value.length) return
      actions.star(selectedItems.value, !selectedItems.value.every(item => item.starred))
      break
    case 'F10':
    case 'ContextMenu': {
      if (event.key === 'F10' && !event.shiftKey) return
      const row = activeDescendant.value ? document.getElementById(activeDescendant.value) : null
      row?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: row.getBoundingClientRect().left + 48, clientY: row.getBoundingClientRect().bottom }))
      break
    }
    default:
      return
  }
  event.preventDefault()
}

watch(() => props.previewId, (id) => {
  if (!id) return
  const index = indexById.value.get(id)
  if (index === undefined) return
  focusIndex.value = index
  if (!selectedSet.value.has(id)) setSelection([id])
  scrollToIndex(index)
})

watch(() => props.items, () => {
  const ids = new Set(props.items.map(item => item.id))
  if (selection.value.some(id => !ids.has(id))) setSelection(selection.value.filter(id => ids.has(id)))
  if (focusIndex.value >= sorted.value.length) focusIndex.value = sorted.value.length - 1
})

function toggleSort(key: SortKey) {
  if (preferences.sortBy === key) preferences.sortDir = preferences.sortDir === 'asc' ? 'desc' : 'asc'
  else {
    preferences.sortBy = key
    preferences.sortDir = key === 'name' ? 'asc' : 'desc'
  }
}

const ariaSort = (key: SortKey) => !props.sortable ? undefined : preferences.sortBy === key ? (preferences.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'

const dropTargetId = ref<string | null>(null)
const draggingIds = ref<string[]>([])

function onDragStart(event: DragEvent, item: ResourceItem, index: number) {
  if (!isOwner.value || props.trash || !event.dataTransfer) return
  if (!selectedSet.value.has(item.id)) {
    setSelection([item.id])
    anchorIndex.value = index
  }
  draggingIds.value = [...selection.value]
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/x-drive-ids', JSON.stringify(draggingIds.value))
  event.dataTransfer.setData('text/plain', selectedItems.value.map(i => i.name).join('\n'))
  const ghost = document.createElement('div')
  ghost.textContent = selectedItems.value.length === 1 ? item.name : plural(selectedItems.value.length, 'élément')
  ghost.className = 'fixed -top-20 left-0 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white shadow-lifted'
  document.body.appendChild(ghost)
  event.dataTransfer.setDragImage(ghost, -12, -12)
  requestAnimationFrame(() => ghost.remove())
}

function folderUnder(event: DragEvent) {
  const element = (event.target as HTMLElement).closest<HTMLElement>('[data-folder-id]')
  if (!element) return null
  return { id: element.dataset.folderId!, name: element.dataset.folderName! }
}

function onDragOver(event: DragEvent) {
  const types = event.dataTransfer?.types ?? []
  const target = folderUnder(event)
  if (types.includes('application/x-drive-ids')) {
    const valid = target && !draggingIds.value.includes(target.id)
    dropTargetId.value = valid ? target.id : null
    if (valid) event.preventDefault()
    return
  }
  if (types.includes('Files') && isOwner.value && !props.trash && (target || props.folder)) {
    event.preventDefault()
    dropTargetId.value = target?.id ?? null
    emit('fileDrag', target ?? props.folder)
  }
}

function onDrop(event: DragEvent) {
  const types = event.dataTransfer?.types ?? []
  const target = folderUnder(event)
  dropTargetId.value = null
  if (types.includes('application/x-drive-ids')) {
    if (!target || draggingIds.value.includes(target.id)) return
    event.preventDefault()
    const ids = new Set<string>(JSON.parse(event.dataTransfer!.getData('application/x-drive-ids')))
    actions.moveTo(props.items.filter(item => ids.has(item.id)), target)
    draggingIds.value = []
    return
  }
  if (types.includes('Files') && isOwner.value && !props.trash && (target || props.folder)) {
    event.preventDefault()
    emit('dropFiles', target ?? props.folder!, event.dataTransfer!)
  }
}

function onDragEnd() {
  draggingIds.value = []
  dropTargetId.value = null
}

function onDragLeave(event: DragEvent) {
  if (!scroller.value?.contains(event.relatedTarget as Node)) {
    dropTargetId.value = null
    emit('fileDrag', null)
  }
}

const rowItems = (row: number) => sorted.value.slice(row * columns.value, (row + 1) * columns.value)
const dateOf = (item: ResourceItem) => props.trash ? item.deletedAt : item.updatedAt

defineExpose({ focus: () => grid.value?.focus(), selectAll: () => setSelection(sorted.value.map(item => item.id)) })
</script>

<template>
  <div
    ref="grid"
    role="grid"
    tabindex="0"
    :aria-label="label"
    aria-multiselectable="true"
    :aria-rowcount="sorted.length + 1"
    :aria-activedescendant="activeDescendant"
    :aria-busy="loading || undefined"
    class="flex min-h-0 flex-1 flex-col focus:outline-none"
    @keydown="onKeydown"
    @focus="keyboardFocus = focusIndex >= 0"
    @blur="keyboardFocus = false"
  >
    <div v-if="!isGrid && room.wide && (items.length || loading)" role="rowgroup" class="shrink-0 overflow-hidden border-b border-line-weak [scrollbar-gutter:stable]">
      <div
        role="row"
        aria-rowindex="1"
        class="grid h-10 items-center gap-x-4 pr-2 pl-4 text-sm font-semibold text-ink-weak"
        :style="{ gridTemplateColumns: gridTemplate }"
      >
        <FilesSortHeader label="Nom" :sort="ariaSort('name')" :disabled="!sortable" @click="toggleSort('name')" />
        <div v-if="show.location" role="columnheader">Emplacement</div>
        <div v-if="show.access" role="columnheader">Accès</div>
        <FilesSortHeader :label="trash ? 'Supprimé' : 'Modifié'" :sort="ariaSort('updatedAt')" :disabled="!sortable || trash" @click="toggleSort('updatedAt')" />
        <FilesSortHeader v-if="show.size" label="Taille" align="end" :sort="ariaSort('size')" :disabled="!sortable" @click="toggleSort('size')" />
        <FilesSortHeader v-if="show.viewed" label="Consulté" :sort="ariaSort('lastExternalViewAt')" :disabled="!sortable" @click="toggleSort('lastExternalViewAt')" />
        <div role="columnheader"><span class="sr-only">Actions</span></div>
      </div>
    </div>

    <UiContextMenu :entries="menuEntries" :disabled="mode === 'share' && !items.length">
      <div
        ref="scroller"
        role="rowgroup"
        class="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
        :class="isGrid ? 'px-3' : ''"
        @click="onBackgroundClick"
        @contextmenu="onContextMenu"
        @pointerdown="lastPointer = $event.pointerType"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
        @dragend="onDragEnd"
      >
        <div v-if="loading && !items.length" class="px-4 pt-1" aria-hidden="true">
          <div v-for="n in 8" :key="n" class="flex items-center gap-3 border-b border-line-weak" :style="{ height: `${rowHeight}px` }">
            <UiSkeleton width="1.25rem" height="1.25rem" />
            <UiSkeleton :width="`${30 + ((n * 37) % 40)}%`" />
          </div>
        </div>

        <div v-else-if="!items.length" class="flex min-h-full items-center justify-center">
          <slot name="empty" />
        </div>

        <div v-else class="relative w-full" :style="{ height: `${virtualizer.getTotalSize()}px` }">
          <template v-if="!isGrid">
            <div
              v-for="row in virtualizer.getVirtualItems()"
              :id="rowId(sorted[row.index]!)"
              :key="String(row.key)"
              role="row"
              :aria-rowindex="row.index + 2"
              :aria-selected="selectedSet.has(sorted[row.index]!.id)"
              :data-index="row.index"
              :data-folder-id="sorted[row.index]!.type === 'folder' && !trash ? sorted[row.index]!.id : undefined"
              :data-folder-name="sorted[row.index]!.type === 'folder' ? sorted[row.index]!.name : undefined"
              :draggable="isOwner && !trash"
              class="group absolute inset-x-0 top-0 grid items-center gap-x-4 border-b border-line-weak pr-2 pl-4 select-none transition-colors duration-100"
              :class="[
                selectedSet.has(sorted[row.index]!.id) ? 'bg-selected hover:bg-selected-hover' : 'hover:bg-hover',
                dropTargetId === sorted[row.index]!.id && 'bg-selected! ring-2 ring-inset ring-accent',
                keyboardFocus && focusIndex === row.index && 'outline-2 -outline-offset-2 outline-focus',
                draggingIds.includes(sorted[row.index]!.id) && 'opacity-50',
              ]"
              :style="{ transform: `translateY(${row.start}px)`, height: `${row.size}px`, gridTemplateColumns: gridTemplate }"
              @click.stop="onClick($event, row.index)"
              @dblclick="emit('open', sorted[row.index]!)"
              @dragstart="onDragStart($event, sorted[row.index]!, row.index)"
            >
              <div role="gridcell" class="flex min-w-0 items-center gap-3">
                <FilesFileIcon :kind="sorted[row.index]!.kind" />
                <div class="min-w-0">
                  <div class="flex min-w-0 items-center gap-1.5">
                    <span class="truncate text-ink" :title="sorted[row.index]!.name">{{ sorted[row.index]!.name }}</span>
                    <Star v-if="sorted[row.index]!.starred" class="size-3.5 shrink-0 fill-current text-[#f0a500]" aria-label="Favori" />
                  </div>
                  <div v-if="!room.wide" class="truncate text-sm text-ink-weak">
                    {{ formatShortDate(dateOf(sorted[row.index]!)) }}<template v-if="sorted[row.index]!.type === 'file'"> · {{ formatSize(sorted[row.index]!.size) }}</template>
                  </div>
                </div>
              </div>
              <div v-if="show.location" role="gridcell" class="truncate text-sm text-ink-weak" :title="sorted[row.index]!.location">
                {{ sorted[row.index]!.location }}
              </div>
              <div v-if="show.access" role="gridcell" class="min-w-0">
                <FilesAccessCell :access="sorted[row.index]!.access" />
              </div>
              <div v-if="room.wide" role="gridcell" class="tabular truncate text-sm text-ink-weak">
                {{ formatShortDate(dateOf(sorted[row.index]!)) }}
              </div>
              <div v-if="show.size" role="gridcell" class="tabular text-right text-sm text-ink-weak">
                {{ sorted[row.index]!.type === 'folder' ? '' : formatSize(sorted[row.index]!.size) }}
              </div>
              <div v-if="show.viewed" role="gridcell" class="tabular truncate text-sm text-ink-weak">
                {{ sorted[row.index]!.lastExternalViewAt ? formatShortDate(sorted[row.index]!.lastExternalViewAt) : '' }}
              </div>
              <div role="gridcell" class="flex justify-end" @click.stop @dblclick.stop>
                <UiDropdownMenu :entries="rowMenu(sorted[row.index]!)" align="end" @update:open="(open: boolean) => open && onRowMenuOpen(sorted[row.index]!, row.index)">
                  <button
                    type="button"
                    tabindex="-1"
                    :aria-label="`Actions pour ${sorted[row.index]!.name}`"
                    class="inline-flex size-8 items-center justify-center rounded-md text-ink-weak transition-opacity hover:bg-hover hover:text-ink data-[state=open]:bg-hover data-[state=open]:opacity-100"
                    :class="breakpoints.coarse || selectedSet.has(sorted[row.index]!.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                  >
                    <EllipsisVertical class="size-4" aria-hidden="true" />
                  </button>
                </UiDropdownMenu>
              </div>
            </div>
          </template>

          <template v-else>
            <div
              v-for="row in virtualizer.getVirtualItems()"
              :key="String(row.key)"
              role="row"
              class="absolute inset-x-0 top-0 grid gap-3"
              :style="{ transform: `translateY(${row.start}px)`, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }"
            >
              <FilesFileCard
                v-for="(item, offset) in rowItems(row.index)"
                :id="rowId(item)"
                :key="item.id"
                :item="item"
                :index="row.index * columns + offset"
                :height="cardHeight"
                :selected="selectedSet.has(item.id)"
                :focused="keyboardFocus && focusIndex === row.index * columns + offset"
                :drop-target="dropTargetId === item.id"
                :dragging="draggingIds.includes(item.id)"
                :draggable="isOwner && !trash"
                :trash="trash"
                :menu="rowMenu(item)"
                :show-access="isOwner && !trash"
                @click.stop="onClick($event, row.index * columns + offset)"
                @dblclick="emit('open', item)"
                @dragstart="onDragStart($event, item, row.index * columns + offset)"
                @menu-open="onRowMenuOpen(item, row.index * columns + offset)"
              />
            </div>
          </template>
        </div>
      </div>
    </UiContextMenu>
  </div>
</template>
