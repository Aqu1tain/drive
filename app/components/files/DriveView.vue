<script setup lang="ts">
import { CloudUpload, Download, EllipsisVertical, FolderInput, Info, LayoutGrid, List, Plus, RotateCcw, Share2, Trash2, X } from '@lucide/vue'
import type { Crumb, ResourceItem } from '#shared/types/api'

const props = withDefaults(defineProps<{
  items: ResourceItem[]
  label: string
  mode: BrowserMode
  loading?: boolean
  apiBase?: string
  folder?: { id: string | null, name: string } | null
  folderItem?: ResourceItem | null
  crumbs?: Crumb[]
  crumbTo?: (crumb: Crumb) => string
  folderTo?: (id: string) => string
  title?: string
  trash?: boolean
  showLocation?: boolean
  sortable?: boolean
  canDetails?: boolean
}>(), { apiBase: '/api', folder: null, folderItem: null, sortable: true, canDetails: true })

const route = useRoute()
const router = useRouter()
const preferences = usePreferences()
const breakpoints = useBreakpoints()
const actions = useFileActions()
const dialogs = useDialogs()
const details = useDetailsPanel()
const uploads = useUploads()
const context = useSelectionContext()

const selection = ref<string[]>([])
const selectedItems = computed(() => {
  const ids = new Set(selection.value)
  return props.items.filter(item => ids.has(item.id))
})
const isOwner = computed(() => props.mode === 'owner')

const previewId = computed(() => typeof route.query.preview === 'string' ? route.query.preview : null)
const fullPreview = computed(() => !!previewId.value && (route.query.full === '1' || !breakpoints.lg))
const previewItem = computed(() => props.items.find(item => item.id === previewId.value) ?? null)
const previewSiblings = computed(() => props.items.filter(item => item.type === 'file'))

function withoutPreview() {
  const { preview: _preview, full: _full, ...query } = route.query
  return { path: route.path, query }
}

function openItem(item: ResourceItem) {
  if (item.type === 'folder') {
    if (props.trash) {
      dialogs.confirm({ title: 'Ce dossier est dans la corbeille', message: 'Restaurez-le pour parcourir son contenu.', confirmLabel: 'Restaurer' })
        .then((confirmed) => {
          if (confirmed) actions.restore([item])
        })
      return
    }
    navigateTo(props.folderTo ? props.folderTo(item.id) : `/open/${item.id}`)
    return
  }
  router.push({ query: { ...route.query, preview: item.id, full: '1' } })
}

function previewItemInPanel(item: ResourceItem) {
  if (previewId.value === item.id && !fullPreview.value) return closePreview()
  const target = { query: { ...route.query, preview: item.id, full: undefined } }
  if (previewId.value) router.replace(target)
  else router.push(target)
}

function switchPreview(item: ResourceItem) {
  router.replace({ query: { ...route.query, preview: item.id } })
}

function closePreview() {
  const target = withoutPreview()
  const back = window.history.state?.back as string | undefined
  if (back && router.resolve(back).fullPath === router.resolve(target).fullPath) router.back()
  else router.replace(target)
}

function setFull(full: boolean) {
  router.replace({ query: { ...route.query, full: full ? '1' : undefined } })
}

watch([selectedItems, () => props.mode, () => props.folder], () => {
  context.state.items = selectedItems.value
  context.state.mode = props.mode
  context.state.folder = props.folder
  context.state.open = openItem
}, { immediate: true })

onBeforeUnmount(() => {
  context.state.items = []
  context.state.folder = null
})

const detailsItem = computed(() => {
  if (details.state.pinned && props.items.some(i => i.id === details.state.pinned!.id) && selectedItems.value.length === 0) return details.state.pinned
  if (selectedItems.value.length === 1) return selectedItems.value[0]!
  if (selectedItems.value.length === 0) return props.folderItem
  return null
})

watch(selection, () => {
  if (selection.value.length) details.state.pinned = null
})

const selectionMenu = computed(() => actions.menuFor(selectedItems.value, { mode: props.mode, trash: props.trash, apiBase: props.apiBase, open: openItem }))
const canDownloadSelection = computed(() => selectedItems.value.some(item => item.canDownload))

const pickFiles = () => document.dispatchEvent(new CustomEvent('drive:upload'))

const dragDepth = ref(0)
const dropTarget = ref<{ id: string | null, name: string } | null>(null)
const acceptsFiles = computed(() => isOwner.value && !props.trash && !!props.folder)

function hasFiles(event: DragEvent) {
  return !!event.dataTransfer?.types.includes('Files')
}

function onWindowDragEnter(event: DragEvent) {
  if (!acceptsFiles.value || !hasFiles(event)) return
  dragDepth.value++
  dropTarget.value ??= props.folder
}

function onWindowDragLeave(event: DragEvent) {
  if (!acceptsFiles.value || !hasFiles(event)) return
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}

function onWindowDrop() {
  dragDepth.value = 0
}

async function onDropFiles(target: { id: string | null, name: string }, transfer: DataTransfer) {
  dragDepth.value = 0
  const files = await filesFromDataTransfer(transfer)
  uploads.uploadTree(files, target)
}

function onEmptyAreaDrop(event: DragEvent) {
  if (!acceptsFiles.value || !hasFiles(event)) return
  event.preventDefault()
  onDropFiles(props.folder!, event.dataTransfer!)
}

onMounted(() => {
  window.addEventListener('dragenter', onWindowDragEnter)
  window.addEventListener('dragleave', onWindowDragLeave)
  window.addEventListener('drop', onWindowDrop)
  window.addEventListener('dragend', onWindowDrop)
})

onBeforeUnmount(() => {
  window.removeEventListener('dragenter', onWindowDragEnter)
  window.removeEventListener('dragleave', onWindowDragLeave)
  window.removeEventListener('drop', onWindowDrop)
  window.removeEventListener('dragend', onWindowDrop)
})

function onMoveToCrumb(crumb: Crumb, event: DragEvent) {
  const ids = new Set<string>(JSON.parse(event.dataTransfer!.getData('application/x-drive-ids')))
  actions.moveTo(props.items.filter(item => ids.has(item.id)), { id: crumb.id, name: crumb.name })
}

const viewOptions = [
  { value: 'list' as const, label: 'Liste', icon: List },
  { value: 'grid' as const, label: 'Grille', icon: LayoutGrid },
]

const browser = useTemplateRef<{ focus: () => void }>('browser')
</script>

<template>
  <div class="relative flex min-w-0 flex-1" @dragover.prevent="acceptsFiles && hasFiles($event)" @drop="onEmptyAreaDrop">
    <section class="flex min-w-0 flex-1 flex-col">
      <div class="flex h-14 shrink-0 items-center gap-2 px-3 md:px-4">
        <template v-if="selectedItems.length">
          <UiIconButton :icon="X" label="Effacer la sélection" shortcut="Échap" @click="selection = []; browser?.focus()" />
          <span class="mr-2 text-base font-semibold text-ink tabular" aria-live="polite">{{ plural(selectedItems.length, 'sélectionné', 'sélectionnés') }}</span>
          <div class="flex items-center gap-0.5">
            <template v-if="trash">
              <UiButton size="sm" variant="ghost" :icon="RotateCcw" @click="actions.restore(selectedItems)">Restaurer</UiButton>
              <UiButton size="sm" variant="ghost" :icon="Trash2" class="text-danger" @click="actions.deleteForever(selectedItems)">Supprimer définitivement</UiButton>
            </template>
            <template v-else>
              <UiIconButton v-if="isOwner && selectedItems.length === 1" :icon="Share2" label="Partager" shortcut="Mod+Alt+A" @click="dialogs.share(selectedItems[0]!)" />
              <UiIconButton v-if="canDownloadSelection" :icon="Download" label="Télécharger" @click="actions.download(selectedItems, apiBase)" />
              <UiIconButton v-if="isOwner" :icon="FolderInput" label="Déplacer" class="max-sm:hidden" @click="dialogs.move(selectedItems)" />
              <UiIconButton v-if="isOwner" :icon="Trash2" label="Déplacer vers la corbeille" shortcut="Suppr" @click="actions.trash(selectedItems)" />
              <UiDropdownMenu :entries="selectionMenu" align="start">
                <UiIconButton :icon="EllipsisVertical" label="Plus d’actions" />
              </UiDropdownMenu>
            </template>
          </div>
        </template>
        <template v-else>
          <FilesBreadcrumbs v-if="crumbs?.length" :crumbs="crumbs" :to="crumbTo ?? (() => '/drive')" :droppable="isOwner" class="min-w-0 flex-1" @drop="onMoveToCrumb" />
          <h1 v-else class="min-w-0 flex-1 truncate px-2 text-lg font-semibold text-ink">{{ title }}</h1>
        </template>

        <div class="ml-auto flex shrink-0 items-center gap-1.5">
          <slot name="actions" :selected="selectedItems" />
          <UiSegmented v-model="preferences.view" :options="viewOptions" label="Affichage" class="max-sm:hidden" />
          <UiIconButton v-if="canDetails && mode !== 'share'" :icon="Info" label="Détails" :active="details.open.value" class="max-lg:hidden" @click="details.toggle()" />
        </div>
      </div>

      <slot name="above" />

      <FilesFileBrowser
        ref="browser"
        v-model:selection="selection"
        :items="items"
        :label="label"
        :mode="mode"
        :loading="loading"
        :folder="folder"
        :trash="trash"
        :show-location="showLocation"
        :sortable="sortable"
        :api-base="apiBase"
        :preview-id="previewId && !fullPreview ? previewId : null"
        @open="openItem"
        @preview="previewItemInPanel"
        @follow="switchPreview"
        @close-preview="closePreview"
        @drop-files="onDropFiles"
        @file-drag="dropTarget = $event ?? folder"
      >
        <template #empty>
          <slot name="empty" :pick-files="pickFiles" />
        </template>
      </FilesFileBrowser>
    </section>

    <aside v-if="previewId && !fullPreview" class="flex w-[45%] max-w-[760px] min-w-[360px] shrink-0 flex-col border-l border-line-weak animate-slide-in-right" aria-label="Aperçu">
      <PreviewPanel
        :id="previewId"
        :item="previewItem"
        :api-base="apiBase"
        :mode="mode"
        @close="closePreview"
        @expand="setFull(true)"
      />
    </aside>
    <aside v-else-if="canDetails && mode !== 'share' && details.open.value && breakpoints.lg" class="flex w-[340px] shrink-0 flex-col border-l border-line-weak animate-slide-in-right" aria-label="Détails">
      <DetailsPanel :item="detailsItem" :count="selectedItems.length" :mode="mode" :folder-to="folderTo" @close="details.close()" />
    </aside>

    <PreviewFull
      v-if="fullPreview && previewId"
      :id="previewId"
      :item="previewItem"
      :siblings="previewSiblings"
      :api-base="apiBase"
      :mode="mode"
      @close="closePreview"
      @navigate="switchPreview"
      @shrink="setFull(false)"
    />

    <Transition enter-from-class="opacity-0" leave-to-class="opacity-0" enter-active-class="transition-opacity duration-150" leave-active-class="transition-opacity duration-150">
      <div v-if="dragDepth > 0 && acceptsFiles" class="pointer-events-none absolute inset-2 z-(--z-dropzone) flex items-end justify-center rounded-xl border-2 border-dashed border-accent bg-accent-softer/60 pb-10">
        <div class="flex items-center gap-3 rounded-lg bg-accent px-5 py-3 text-white shadow-lifted">
          <CloudUpload class="size-5" aria-hidden="true" />
          <span class="text-base">Déposer pour importer dans <strong class="font-semibold">{{ (dropTarget ?? folder)?.name }}</strong></span>
        </div>
      </div>
    </Transition>

    <UiButton
      v-if="acceptsFiles && !breakpoints.md"
      variant="primary"
      size="lg"
      :icon="Plus"
      class="fixed right-5 bottom-6 z-(--z-sticky) size-14! rounded-2xl! p-0! shadow-lifted"
      aria-label="Importer des fichiers"
      @click="pickFiles"
    />
  </div>
</template>
