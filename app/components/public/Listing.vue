<script setup lang="ts">
import { ChevronRight, Download } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

const props = defineProps<{ items: ResourceItem[], token: string }>()
const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()

const sorted = computed(() => props.items.toSorted((a, b) => a.type !== b.type ? (a.type === 'folder' ? -1 : 1) : a.name.localeCompare(b.name, locale.value, { numeric: true })))
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


</script>

<template>
  <ul class="divide-y divide-line-weak overflow-hidden rounded-xl bg-canvas shadow-norm">
    <li v-for="item in sorted" :key="item.id" class="group flex items-center">
      <button type="button" class="flex min-w-0 flex-1 items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none" @click="open(item)">
        <span class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-subtle">
          <img v-if="item.thumbnailUrl" :src="item.thumbnailUrl" alt="" loading="lazy" class="size-full object-cover" :class="{ 'object-top': item.kind === 'pdf' || item.kind === 'ebook' }">
          <FilesFileIcon v-else :kind="item.kind" :size="item.type === 'folder' ? 'md' : 'md'" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-base font-medium text-ink">{{ item.name }}</span>
          <span class="block truncate text-sm text-ink-weak">{{ item.type === 'folder' ? t('publicPage.folder') : `${formatSize(item.size)} · ${formatShortDate(item.updatedAt)}` }}</span>
        </span>
        <ChevronRight v-if="item.type === 'folder'" class="size-4 shrink-0 text-ink-hint" aria-hidden="true" />
      </button>
      <a
        v-if="item.type === 'file' && item.canDownload"
        :href="`${apiBase}/resources/${item.id}/download`"
        :download="item.name"
        :aria-label="t('publicPage.downloadFile', { name: item.name })"
        class="mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink-weak transition-colors hover:bg-hover hover:text-ink"
      >
        <Download class="size-[18px]" aria-hidden="true" />
      </a>
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
