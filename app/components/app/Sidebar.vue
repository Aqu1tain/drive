<script setup lang="ts">
import { Activity, Clock, Ellipsis, FolderUp, FolderPlus, Globe, HardDrive, House, Pencil, Plus, Share2, Star, Trash2, Upload, Users, Inbox } from '@lucide/vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { parseSearchQuery } from '#shared/utils/search'
import type { TagInfo } from '#shared/types/api'
import type { Component } from 'vue'

const props = defineProps<{ owner: boolean, collapsed?: boolean }>()
const emit = defineEmits<{ navigate: [] }>()
const { public: config } = useRuntimeConfig()
const dialogs = useDialogs()
const route = useRoute()
const actions = useFileActions()

interface NavItem {
  to: string
  label: string
  icon: Component
  match?: RegExp
  drop?: boolean
}

const ownerNav: NavItem[] = [
  { to: '/home', label: 'Accueil', icon: House },
  { to: '/drive', label: 'Mon Drive', icon: HardDrive, match: /^\/drive/, drop: true },
  { to: '/recent', label: 'Récents', icon: Clock },
  { to: '/starred', label: 'Favoris', icon: Star },
  { to: '/shared', label: 'Partagés', icon: Share2 },
  { to: '/activity', label: 'Activité', icon: Activity },
  { to: '/people', label: 'Personnes', icon: Users },
  { to: '/trash', label: 'Corbeille', icon: Trash2 },
]
const readerNav: NavItem[] = [
  { to: '/shared-with-me', label: 'Partagé avec moi', icon: Inbox, match: /^\/shared-with-me/ },
  { to: '/recent', label: 'Récents', icon: Clock },
  { to: '/starred', label: 'Favoris', icon: Star },
]
const nav = computed(() => props.owner ? ownerNav : readerNav)
const isActive = (item: { to: string, match?: RegExp }) => item.match ? item.match.test(route.path) : route.path === item.to

const currentFolder = computed(() => route.path.startsWith('/drive/folder/') ? String(route.params.id) : null)
const newEntries = computed<MenuEntry[]>(() => [
  { id: 'folder', label: 'Nouveau dossier', icon: FolderPlus, onSelect: () => dialogs.newFolder(currentFolder.value) },
  { kind: 'separator' },
  { id: 'files', label: 'Importer des fichiers', icon: Upload, onSelect: () => document.dispatchEvent(new CustomEvent('drive:upload')) },
  { id: 'folder-upload', label: 'Importer un dossier', icon: FolderUp, onSelect: () => document.dispatchEvent(new CustomEvent('drive:upload-folder')) },
  { kind: 'separator' },
  { id: 'page-upload', label: 'Importer une page ou un site web', icon: Globe, onSelect: () => document.dispatchEvent(new CustomEvent('drive:upload-page')) },
])

const { data: storage } = useQuery({
  queryKey: ['storage'],
  queryFn: () => api<{ used: number, quota: number }>('/api/storage'),
  enabled: computed(() => props.owner),
})
const usage = computed(() => storage.value ? Math.min(1, storage.value.used / storage.value.quota) : 0)

const { tags } = useTags(computed(() => props.owner))
const queryClient = useQueryClient()
const activeTag = computed(() => route.path === '/search' ? parseSearchQuery(String(route.query.q ?? '')).tag : undefined)

async function deleteTag(tag: TagInfo) {
  const confirmed = await dialogs.confirm({
    title: `Supprimer l’étiquette « ${tag.name} » ?`,
    message: tag.count ? `Elle sera retirée de ${plural(tag.count, 'élément', 'éléments')}. Les fichiers eux-mêmes ne changent pas.` : 'Aucun élément ne la porte.',
    confirmLabel: 'Supprimer',
    danger: true,
  })
  if (!confirmed) return
  await api(`/api/tags/${tag.id}`, { method: 'DELETE' })
  queryClient.invalidateQueries({ queryKey: ['tags'] })
  actions.refresh()
}

const tagEntries = (tag: TagInfo): MenuEntry[] => [
  { id: 'edit', label: 'Modifier', icon: Pencil, onSelect: () => dialogs.tagEdit(tag) },
  { id: 'delete', label: 'Supprimer', icon: Trash2, danger: true, onSelect: () => deleteTag(tag) },
]

const dropTarget = ref<string | null>(null)
const uploads = useUploads()
const acceptsDrop = (event: DragEvent) => ['application/x-drive-ids', 'Files'].some(type => event.dataTransfer?.types.includes(type))

async function onDrop(event: DragEvent) {
  dropTarget.value = null
  if (event.dataTransfer?.types.includes('Files')) {
    event.preventDefault()
    uploads.uploadTree(await filesFromDataTransfer(event.dataTransfer), { id: null, name: 'Mon Drive' })
    return
  }
  const raw = event.dataTransfer?.getData('application/x-drive-ids')
  if (!raw) return
  const ids = new Set<string>(JSON.parse(raw))
  const { $queryClient } = useNuxtApp()
  const cached = $queryClient.getQueriesData<{ items: import('#shared/types/api').ResourceItem[] }>({ queryKey: ['folder'] })
  const items = cached.flatMap(([, data]) => data?.items ?? []).filter((item, index, all) => ids.has(item.id) && all.findIndex(i => i.id === item.id) === index)
  actions.moveTo(items, { id: null, name: 'Mon Drive' })
}
</script>

<template>
  <aside class="flex shrink-0 flex-col bg-nav text-nav-ink transition-[width] duration-200" :class="collapsed ? 'w-[68px]' : 'w-[248px]'" aria-label="Navigation principale">
    <div class="flex h-15 shrink-0 items-center gap-2.5" :class="collapsed ? 'justify-center' : 'px-5'">
      <AppLogo class="size-7 shrink-0" />
      <span v-if="!collapsed" class="text-md font-semibold tracking-tight">{{ config.appName }}</span>
    </div>

    <div v-if="owner" class="pt-1 pb-4" :class="collapsed ? 'px-3' : 'px-4'">
      <UiDropdownMenu :entries="newEntries">
        <UiButton v-if="collapsed" variant="primary" size="lg" :icon="Plus" aria-label="Nouveau" class="w-full px-0! shadow-none" />
        <UiButton v-else variant="primary" size="lg" :icon="Plus" block class="justify-start! shadow-none">Nouveau</UiButton>
      </UiDropdownMenu>
    </div>
    <div v-else class="h-3" />

    <nav class="flex-1 overflow-y-auto px-3">
      <ul class="flex flex-col gap-0.5">
        <li v-for="item in nav" :key="item.to">
          <NuxtLink
            :to="item.to"
            :aria-current="isActive(item) ? 'page' : undefined"
            :aria-label="collapsed ? item.label : undefined"
            :title="collapsed ? item.label : undefined"
            class="flex h-9 items-center gap-3 rounded-md text-base transition-colors duration-150"
            :class="[
              collapsed ? 'justify-center' : 'px-3',
              isActive(item) ? 'bg-nav-active font-semibold text-nav-ink' : 'text-nav-ink-weak hover:bg-nav-hover hover:text-nav-ink',
              dropTarget === item.to && 'ring-2 ring-accent',
            ]"
            @click="emit('navigate')"
            @dragover="item.drop && owner && acceptsDrop($event) && ($event.preventDefault(), dropTarget = item.to)"
            @dragleave="dropTarget = null"
            @drop="item.drop && onDrop($event)"
          >
            <component :is="item.icon" class="size-[18px] shrink-0" aria-hidden="true" />
            <span v-if="!collapsed">{{ item.label }}</span>
          </NuxtLink>
        </li>
      </ul>

      <section v-if="owner && !collapsed && tags.length" class="mt-5" aria-labelledby="sidebar-tags">
        <h2 id="sidebar-tags" class="mb-1 px-3 text-xs font-semibold tracking-wide text-nav-ink-weak uppercase">Étiquettes</h2>
        <ul class="flex flex-col gap-0.5">
          <li v-for="tag in tags" :key="tag.id" class="group relative">
            <NuxtLink
              :to="tagSearchUrl(tag.name)"
              :aria-current="activeTag === tag.name.toLowerCase() ? 'page' : undefined"
              class="flex h-9 items-center gap-3 rounded-md pr-9 pl-3 text-base transition-colors duration-150"
              :class="activeTag === tag.name.toLowerCase() ? 'bg-nav-active font-semibold text-nav-ink' : 'text-nav-ink-weak hover:bg-nav-hover hover:text-nav-ink'"
              @click="emit('navigate')"
            >
              <span class="flex size-[18px] shrink-0 items-center justify-center" aria-hidden="true">
                <span class="size-2.5 rounded-full" :style="{ background: tag.color }" />
              </span>
              <span class="min-w-0 flex-1 truncate">{{ tag.name }}</span>
            </NuxtLink>
            <UiDropdownMenu :entries="tagEntries(tag)" align="start" side="right">
              <button
                type="button"
                :aria-label="`Actions pour l’étiquette ${tag.name}`"
                class="absolute top-1.5 right-1.5 inline-flex size-6 items-center justify-center rounded text-nav-ink-weak opacity-0 group-hover:opacity-100 hover:bg-nav-hover hover:text-nav-ink focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
              >
                <Ellipsis class="size-4" aria-hidden="true" />
              </button>
            </UiDropdownMenu>
          </li>
        </ul>
      </section>
    </nav>

    <div v-if="owner && storage && !collapsed" class="border-t border-nav-line px-5 py-4">
      <div class="mb-2 flex items-baseline justify-between text-sm">
        <span class="text-nav-ink-weak">Stockage</span>
        <span class="tabular text-nav-ink">{{ formatSize(storage.used) }}</span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-nav-hover" role="progressbar" :aria-valuenow="Math.round(usage * 100)" aria-valuemin="0" aria-valuemax="100" aria-label="Espace utilisé">
        <div class="h-full rounded-full transition-[width] duration-500" :class="usage > 0.9 ? 'bg-danger' : 'bg-accent'" :style="{ width: `${Math.max(usage * 100, 1.5)}%` }" />
      </div>
      <p class="mt-1.5 text-xs text-nav-ink-weak">sur {{ formatSize(storage.quota) }}</p>
    </div>
  </aside>
</template>
