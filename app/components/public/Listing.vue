<script setup lang="ts">
import { ChevronRight, Download } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

const props = defineProps<{ items: ResourceItem[], token: string }>()
const route = useRoute()
const router = useRouter()

const sorted = computed(() => props.items.toSorted((a, b) => a.type !== b.type ? (a.type === 'folder' ? -1 : 1) : a.name.localeCompare(b.name, 'fr', { numeric: true })))
const files = computed(() => sorted.value.filter(item => item.type === 'file'))
const previewId = computed(() => typeof route.query.file === 'string' ? route.query.file : null)
const previewItem = computed(() => files.value.find(item => item.id === previewId.value) ?? null)
const apiBase = computed(() => `/api/s/${props.token}`)

function open(item: ResourceItem) {
  if (item.type === 'folder') return navigateTo(`/s/${props.token}/folder/${item.id}`)
  router.push({ query: { ...route.query, file: item.id } })
}

function close() {
  const { file: _file, ...query } = route.query
  const back = window.history.state?.back as string | undefined
  if (back && !back.includes('file=')) router.back()
  else router.replace({ query })
}

function download(item: ResourceItem) {
  const anchor = document.createElement('a')
  anchor.href = `${apiBase.value}/resources/${item.id}/download`
  anchor.download = item.name
  anchor.click()
}
</script>

<template>
  <ul class="divide-y divide-line-weak overflow-hidden rounded-xl bg-canvas shadow-norm">
    <li v-for="item in sorted" :key="item.id" class="group flex items-center">
      <button type="button" class="flex min-w-0 flex-1 items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none" @click="open(item)">
        <span class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-subtle">
          <img v-if="item.thumbnailUrl" :src="item.thumbnailUrl" alt="" loading="lazy" class="size-full object-cover">
          <FilesFileIcon v-else :kind="item.kind" :size="item.type === 'folder' ? 'md' : 'md'" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-base font-medium text-ink">{{ item.name }}</span>
          <span class="block truncate text-sm text-ink-weak">{{ item.type === 'folder' ? 'Dossier' : `${formatSize(item.size)} · ${formatShortDate(item.updatedAt)}` }}</span>
        </span>
        <ChevronRight v-if="item.type === 'folder'" class="size-4 shrink-0 text-ink-hint" aria-hidden="true" />
      </button>
      <UiIconButton v-if="item.type === 'file' && item.canDownload" :icon="Download" :label="`Télécharger ${item.name}`" class="mr-2 shrink-0" @click="download(item)" />
    </li>
  </ul>
  <PreviewFull
    v-if="previewId"
    :id="previewId"
    :item="previewItem"
    :siblings="files"
    :api-base="apiBase"
    mode="share"
    @close="close"
    @navigate="item => router.replace({ query: { ...route.query, file: item.id } })"
    @shrink="close"
  />
</template>
