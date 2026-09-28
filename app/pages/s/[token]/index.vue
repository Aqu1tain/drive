<script setup lang="ts">
import { Download } from '@lucide/vue'
import type { PreviewInfo, ResourceItem } from '#shared/types/api'

definePageMeta({ layout: 'public' })

interface ShareRoot {
  kind: 'link' | 'invitation'
  sharedBy: string
  root: ResourceItem | null
  items: ResourceItem[]
  recipient?: { name: string | null, email: string }
  expiresAt: string | null
}

const route = useRoute()
const token = String(route.params.token)
const apiBase = `/api/s/${token}`
const { data, error } = await useFetch<ShareRoot>(apiBase)

const root = computed(() => data.value?.root ?? null)
const isFile = computed(() => root.value?.type === 'file')
const title = computed(() => root.value?.name ?? (data.value?.kind === 'invitation' ? 'Documents partagés avec vous' : 'Partage'))

useSeoMeta({
  title,
  ogTitle: computed(() => data.value ? `${title.value}, partagé par ${data.value.sharedBy}` : 'Partage'),
  description: computed(() => data.value ? `${data.value.sharedBy} vous a partagé ${isFile.value ? 'un document' : 'des documents'}.` : undefined),
})

const preview = ref<PreviewInfo | null>(null)
const previewError = ref(false)
onMounted(async () => {
  if (!root.value) return
  try {
    const info = await api<PreviewInfo>(`${apiBase}/resources/${root.value.id}/open`, { method: 'POST' })
    if (isFile.value) preview.value = info
  }
  catch {
    previewError.value = true
  }
})

const downloadAllUrl = (items: ResourceItem[]) => `/api/s/${token}/downloads?ids=${items.filter(item => item.canDownload).map(item => item.id).join(',')}`
const baseName = computed(() => root.value?.name.replace(/\.[^.]+$/, '') ?? '')
</script>

<template>
  <PublicState v-if="error || !data" :status="error?.statusCode" />

  <div v-else-if="isFile && root?.kind === 'html'" class="flex h-[calc(100dvh-3.5rem)] flex-col">
    <h1 class="sr-only">{{ root.name }}</h1>
    <PreviewHtml v-if="preview?.frameUrl" :src="preview.frameUrl" :scripts="preview.scripts" :title="root.name" class="flex-1">
      <template #actions>
        <a v-if="root.canDownload" :href="`${apiBase}/resources/${root.id}/download`" :download="root.name" class="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-ink hover:bg-hover">
          <Download class="size-4" aria-hidden="true" />
          <span class="max-sm:sr-only">Télécharger</span>
        </a>
      </template>
    </PreviewHtml>
    <div v-else-if="previewError" class="flex flex-1 items-center justify-center p-8 text-center text-ink-weak">Aperçu indisponible pour le moment.</div>
    <div v-else class="flex flex-1 items-center justify-center"><UiSpinner class="size-6 text-ink-hint" /></div>
  </div>

  <template v-else-if="isFile && root">
    <div class="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-6 pb-24 sm:px-6 sm:pt-10">
      <div class="mb-5 text-center sm:mb-7">
        <h1 class="text-xl font-semibold tracking-tight text-balance text-ink sm:text-2xl">{{ baseName }}</h1>
        <p class="mt-1 text-sm text-ink-weak">Partagé par {{ data.sharedBy }}</p>
      </div>
      <div class="flex min-h-[60vh] flex-1 overflow-hidden rounded-xl bg-canvas shadow-raised">
        <PreviewContent v-if="preview" :info="preview" />
        <div v-else-if="previewError" class="flex flex-1 items-center justify-center p-8 text-center text-ink-weak">Aperçu indisponible pour le moment.</div>
        <div v-else class="flex flex-1 items-center justify-center"><UiSpinner class="size-6 text-ink-hint" /></div>
      </div>
    </div>
    <footer class="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-line-weak bg-canvas safe-bottom">
      <div class="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4 sm:px-6">
        <FilesFileIcon :kind="root.kind" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-base font-medium text-ink">{{ root.name }}</p>
          <p class="text-sm text-ink-weak">{{ formatSize(root.size) }}</p>
        </div>
        <UiButton v-if="root.canDownload" variant="primary" :icon="Download" :href="`${apiBase}/resources/${root.id}/download`" :download="root.name">Télécharger</UiButton>
        <span v-else class="text-sm text-ink-weak">Consultation seule</span>
      </div>
    </footer>
  </template>

  <div v-else class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {{ data.kind === 'invitation' ? `Bonjour${data.recipient?.name ? ` ${data.recipient.name}` : ''}` : root?.name }}
        </h1>
        <p class="mt-1 text-base text-ink-weak">
          {{ data.kind === 'invitation' ? `${data.sharedBy} a partagé ces documents avec vous.` : `Partagé par ${data.sharedBy}` }}
        </p>
      </div>
      <UiButton v-if="data.items.some(item => item.canDownload)" :icon="Download" :href="downloadAllUrl(data.items)">Tout télécharger</UiButton>
    </div>
    <PublicListing v-if="data.items.length" :items="data.items" :token="token" />
    <p v-else class="rounded-xl bg-canvas p-8 text-center text-base text-ink-weak shadow-norm">Ce dossier est vide pour le moment.</p>
    <p v-if="data.kind === 'invitation'" class="mt-6 text-center text-xs text-ink-hint">Ce lien vous est personnel : vos consultations sont associées à votre invitation.</p>
  </div>
</template>
