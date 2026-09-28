<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, ListboxContent, ListboxFilter, ListboxGroup, ListboxGroupLabel, ListboxItem, ListboxRoot } from 'reka-ui'
import { useQuery } from '@tanstack/vue-query'
import { refDebounced } from '@vueuse/core'
import type { Component } from 'vue'
import { Activity, ArrowRight, Clock, FolderPlus, FolderUp, HardDrive, House, Inbox, Keyboard, LayoutGrid, List, Moon, Search, Settings, Share2, Star, Sun, Trash2, Upload, Users } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'
import { searchKeyOf } from '#shared/utils/names'

const props = defineProps<{ owner: boolean }>()
const dialogs = useDialogs()
const actions = useFileActions()
const selection = useSelectionContext()
const preferences = usePreferences()
const colorMode = useColorMode()

const open = computed({ get: () => dialogs.state.palette, set: value => dialogs.palette(value) })
const query = ref('')
const debounced = refDebounced(query, 120)
watch(open, value => !value && (query.value = ''))

interface Command {
  id: string
  label: string
  hint?: string
  icon: Component
  shortcut?: string
  run: () => void
}

const { data: recent } = useQuery({
  queryKey: ['list', 'recent'],
  queryFn: () => api<{ items: ResourceItem[] }>('/api/recent'),
  enabled: open,
})
const { data: found, isFetching } = useQuery({
  queryKey: computed(() => ['search', 'palette', debounced.value.trim()]),
  queryFn: () => api<{ items: ResourceItem[] }>('/api/search', { query: { q: debounced.value.trim(), limit: 8 } }),
  enabled: computed(() => open.value && debounced.value.trim().length > 0),
  placeholderData: previous => previous,
})

const files = computed(() => query.value.trim() ? found.value?.items ?? [] : (recent.value?.items ?? []).slice(0, 6))

const selectionCommands = computed<Command[]>(() => {
  const items = selection.state.items
  if (!items.length) return []
  const name = items.length === 1 ? items[0]!.name : plural(items.length, 'élément')
  return actions.menuFor(items, { mode: selection.state.mode, open: selection.state.open ?? undefined })
    .filter(isAction)
    .map(entry => ({ id: `sel-${entry.id}`, label: `${entry.label}`, hint: name, icon: entry.icon!, shortcut: entry.shortcut, run: entry.onSelect }))
})

const go = (path: string) => () => navigateTo(path)
const navigation = computed<Command[]>(() => props.owner
  ? [
      { id: 'nav-home', label: 'Accueil', icon: House, run: go('/home') },
      { id: 'nav-drive', label: 'Mon Drive', icon: HardDrive, run: go('/drive') },
      { id: 'nav-recent', label: 'Récents', icon: Clock, run: go('/recent') },
      { id: 'nav-starred', label: 'Favoris', icon: Star, run: go('/starred') },
      { id: 'nav-shared', label: 'Partagés', icon: Share2, run: go('/shared') },
      { id: 'nav-activity', label: 'Activité', icon: Activity, run: go('/activity') },
      { id: 'nav-people', label: 'Personnes', icon: Users, run: go('/people') },
      { id: 'nav-trash', label: 'Corbeille', icon: Trash2, run: go('/trash') },
      { id: 'nav-settings', label: 'Paramètres', icon: Settings, run: go('/settings') },
    ]
  : [
      { id: 'nav-shared-with-me', label: 'Partagé avec moi', icon: Inbox, run: go('/shared-with-me') },
      { id: 'nav-recent', label: 'Récents', icon: Clock, run: go('/recent') },
      { id: 'nav-settings', label: 'Paramètres', icon: Settings, run: go('/settings') },
    ])

const general = computed<Command[]>(() => [
  ...(props.owner
    ? [
        { id: 'upload', label: 'Importer des fichiers', icon: Upload, run: () => document.dispatchEvent(new CustomEvent('drive:upload')) },
        { id: 'upload-folder', label: 'Importer un dossier', icon: FolderUp, run: () => document.dispatchEvent(new CustomEvent('drive:upload-folder')) },
        { id: 'new-folder', label: 'Nouveau dossier', icon: FolderPlus, run: () => dialogs.newFolder(selection.state.folder?.id ?? null) },
      ]
    : []),
  { id: 'view', label: preferences.view === 'list' ? 'Afficher en grille' : 'Afficher en liste', icon: preferences.view === 'list' ? LayoutGrid : List, run: () => (preferences.view = preferences.view === 'list' ? 'grid' : 'list') },
  { id: 'theme', label: colorMode.value === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre', icon: colorMode.value === 'dark' ? Sun : Moon, run: () => (colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark') },
  { id: 'shortcuts', label: 'Raccourcis clavier', icon: Keyboard, shortcut: 'Mod+/', run: () => dialogs.shortcuts() },
])

function matches(command: Command, text: string) {
  const needle = searchKeyOf(text.trim())
  if (!needle) return true
  const haystack = searchKeyOf(`${command.label} ${command.hint ?? ''}`)
  return needle.split(/\s+/).every(word => haystack.includes(word))
}

const groups = computed(() => {
  const text = query.value
  return [
    { id: 'selection', label: 'Sélection', commands: selectionCommands.value.filter(c => matches(c, text)) },
    { id: 'actions', label: 'Actions', commands: general.value.filter(c => matches(c, text)) },
    { id: 'navigation', label: 'Aller à', commands: navigation.value.filter(c => matches(c, text)) },
  ].filter(group => group.commands.length)
})

const listbox = useTemplateRef<{ highlightFirstItem: () => void }>('listbox')
watch([files, groups], () => nextTick(() => listbox.value?.highlightFirstItem()), { flush: 'post' })

function run(action: () => void) {
  dialogs.palette(false)
  action()
}

const openFile = (item: ResourceItem) => run(() => navigateTo(`/open/${item.id}`))
const searchAll = () => run(() => navigateTo({ path: '/search', query: { q: query.value.trim() } }))
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-(--z-modal) bg-backdrop animate-fade-in" />
      <DialogContent :aria-describedby="undefined" class="fixed top-[12vh] left-1/2 z-(--z-modal) w-[min(640px,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-line-weak bg-raised shadow-lifted animate-pop-in focus:outline-none">
        <DialogTitle class="sr-only">Palette de commandes</DialogTitle>
        <ListboxRoot ref="listbox" highlight-on-hover class="flex flex-col">
          <div class="flex h-14 items-center gap-3 border-b border-line-weak px-4">
            <Search class="size-5 shrink-0 text-ink-weak" aria-hidden="true" />
            <ListboxFilter v-model="query" auto-focus placeholder="Rechercher un fichier ou une action…" class="h-full min-w-0 flex-1 bg-transparent text-md text-ink placeholder:text-ink-hint focus:outline-none" />
            <UiSpinner v-if="isFetching" class="size-4 text-ink-hint" />
            <UiKbd keys="Échap" />
          </div>
          <ListboxContent class="max-h-[min(460px,60vh)] overflow-y-auto p-2">
            <ListboxGroup v-if="files.length">
              <ListboxGroupLabel class="px-2.5 pt-1 pb-1.5 text-xs font-semibold text-ink-weak">{{ query.trim() ? 'Fichiers' : 'Récents' }}</ListboxGroupLabel>
              <ListboxItem v-for="item in files" :key="item.id" :value="`file-${item.id}`" class="flex h-11 cursor-pointer items-center gap-3 rounded-md px-2.5 outline-none data-highlighted:bg-hover" @select="openFile(item)">
                <FilesFileIcon :kind="item.kind" />
                <span class="min-w-0 flex-1 truncate text-base text-ink">{{ item.name }}</span>
                <span class="max-w-[40%] truncate text-sm text-ink-weak">{{ item.location }}</span>
              </ListboxItem>
              <ListboxItem v-if="query.trim()" value="search-all" class="flex h-10 cursor-pointer items-center gap-3 rounded-md px-2.5 text-accent-ink outline-none data-highlighted:bg-hover" @select="searchAll">
                <Search class="size-4" aria-hidden="true" />
                <span class="flex-1 truncate text-base">Tous les résultats pour « {{ query.trim() }} »</span>
                <ArrowRight class="size-4" aria-hidden="true" />
              </ListboxItem>
            </ListboxGroup>
            <ListboxGroup v-for="group in groups" :key="group.id" class="mt-1.5">
              <ListboxGroupLabel class="px-2.5 pt-1 pb-1.5 text-xs font-semibold text-ink-weak">{{ group.label }}</ListboxGroupLabel>
              <ListboxItem v-for="command in group.commands" :key="command.id" :value="command.id" class="flex h-10 cursor-pointer items-center gap-3 rounded-md px-2.5 outline-none data-highlighted:bg-hover" @select="run(command.run)">
                <component :is="command.icon" class="size-4 shrink-0 text-ink-weak" aria-hidden="true" />
                <span class="min-w-0 flex-1 truncate text-base text-ink">{{ command.label }}<span v-if="command.hint" class="ml-2 text-ink-weak">{{ command.hint }}</span></span>
                <UiKbd v-if="command.shortcut" :keys="command.shortcut" />
              </ListboxItem>
            </ListboxGroup>
            <p v-if="!files.length && !groups.length && !isFetching" class="px-3 py-8 text-center text-base text-ink-weak">
              Aucun résultat pour « {{ query }} ».
            </p>
          </ListboxContent>
        </ListboxRoot>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
