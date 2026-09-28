<script setup lang="ts">
import { Activity, Clock, FolderUp, FolderPlus, HardDrive, House, Plus, Share2, Star, Trash2, Upload, Users, Inbox } from '@lucide/vue'
import { useQuery } from '@tanstack/vue-query'
import type { Component } from 'vue'

const props = defineProps<{ owner: boolean }>()
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
]
const nav = computed(() => props.owner ? ownerNav : readerNav)
const isActive = (item: { to: string, match?: RegExp }) => item.match ? item.match.test(route.path) : route.path === item.to

const currentFolder = computed(() => route.path.startsWith('/drive/folder/') ? String(route.params.id) : null)
const newEntries = computed<MenuEntry[]>(() => [
  { id: 'folder', label: 'Nouveau dossier', icon: FolderPlus, onSelect: () => dialogs.newFolder(currentFolder.value) },
  { kind: 'separator' },
  { id: 'files', label: 'Importer des fichiers', icon: Upload, onSelect: () => document.dispatchEvent(new CustomEvent('drive:upload')) },
  { id: 'folder-upload', label: 'Importer un dossier', icon: FolderUp, onSelect: () => document.dispatchEvent(new CustomEvent('drive:upload-folder')) },
])

const { data: storage } = useQuery({
  queryKey: ['storage'],
  queryFn: () => api<{ used: number, quota: number }>('/api/storage'),
  enabled: computed(() => props.owner),
})
const usage = computed(() => storage.value ? Math.min(1, storage.value.used / storage.value.quota) : 0)

const dropTarget = ref<string | null>(null)
function onDrop(event: DragEvent) {
  dropTarget.value = null
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
  <aside class="flex w-[248px] shrink-0 flex-col bg-nav text-nav-ink" aria-label="Navigation principale">
    <div class="flex h-15 shrink-0 items-center gap-2.5 px-5">
      <AppLogo class="size-7" />
      <span class="text-md font-semibold tracking-tight">{{ config.appName }}</span>
    </div>

    <div v-if="owner" class="px-4 pt-1 pb-4">
      <UiDropdownMenu :entries="newEntries">
        <UiButton variant="primary" size="lg" :icon="Plus" block class="justify-start! shadow-none">Nouveau</UiButton>
      </UiDropdownMenu>
    </div>
    <div v-else class="h-3" />

    <nav class="flex-1 overflow-y-auto px-3">
      <ul class="flex flex-col gap-0.5">
        <li v-for="item in nav" :key="item.to">
          <NuxtLink
            :to="item.to"
            :aria-current="isActive(item) ? 'page' : undefined"
            class="flex h-9 items-center gap-3 rounded-md px-3 text-base transition-colors duration-150"
            :class="[
              isActive(item) ? 'bg-nav-active font-semibold text-nav-ink' : 'text-nav-ink-weak hover:bg-nav-hover hover:text-nav-ink',
              dropTarget === item.to && 'ring-2 ring-accent',
            ]"
            @click="emit('navigate')"
            @dragover="item.drop && $event.dataTransfer?.types.includes('application/x-drive-ids') && ($event.preventDefault(), dropTarget = item.to)"
            @dragleave="dropTarget = null"
            @drop="item.drop && onDrop($event)"
          >
            <component :is="item.icon" class="size-[18px] shrink-0" aria-hidden="true" />
            {{ item.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>

    <div v-if="owner && storage" class="border-t border-nav-line px-5 py-4">
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
