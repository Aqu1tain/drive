<script setup lang="ts">
import type { PreviewInfo } from '#shared/types/api'

const props = defineProps<{ info: PreviewInfo, dark?: boolean }>()
const failed = ref(false)
watch(() => props.info.contentUrl, () => (failed.value = false))

const isMarkdown = computed(() => props.info.item.mimeType === 'text/markdown' || /\.(md|markdown)$/i.test(props.info.item.name))
const viewer = computed(() => {
  if (failed.value) return 'none'
  const kind = props.info.kind
  if (kind === 'image' || kind === 'pdf' || kind === 'audio' || kind === 'video' || kind === 'html') return kind
  if (props.info.frameUrl) return 'document'
  if (kind === 'text' || kind === 'spreadsheet' && props.info.item.mimeType === 'text/csv') return isMarkdown.value ? 'markdown' : 'text'
  return 'none'
})
</script>

<template>
  <div class="flex size-full min-h-0 items-stretch justify-center">
    <PreviewImage v-if="viewer === 'image'" :src="info.contentUrl" :alt="info.item.name" @error="failed = true" />
    <PreviewPdf v-else-if="viewer === 'pdf'" :src="info.contentUrl" :dark="dark" @error="failed = true" />
    <PreviewText v-else-if="viewer === 'text' || viewer === 'markdown'" :src="info.contentUrl" :markdown="viewer === 'markdown'" :size="info.item.size" @error="failed = true" />
    <div v-else-if="viewer === 'audio'" class="flex w-full items-center justify-center p-6">
      <div class="w-full max-w-md rounded-xl bg-canvas p-6 text-center shadow-raised">
        <FilesFileIcon kind="audio" size="xl" class="mx-auto mb-4" />
        <p class="mb-4 truncate font-semibold text-ink">{{ info.item.name }}</p>
        <audio :src="info.contentUrl" controls preload="metadata" class="w-full" @error="failed = true" />
      </div>
    </div>
    <div v-else-if="viewer === 'video'" class="flex size-full items-center justify-center p-4">
      <video :src="info.contentUrl" controls playsinline preload="metadata" class="max-h-full max-w-full rounded-lg bg-black" @error="failed = true" />
    </div>
    <PreviewHtml v-else-if="viewer === 'html' && info.frameUrl" :src="info.frameUrl" :scripts="info.scripts" :title="info.item.name" />
    <PreviewHtml v-else-if="viewer === 'document' && info.frameUrl" :src="info.frameUrl" :scripts="false" :title="info.item.name" converted />
    <PreviewNone v-else :info="info" :dark="dark" />
  </div>
</template>
