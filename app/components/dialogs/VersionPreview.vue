<script setup lang="ts">
import { Download, RotateCcw } from '@lucide/vue'
import { kindOf } from '#shared/utils/search'
import type { FileVersionItem, PreviewInfo, ResourceItem } from '#shared/types/api'

const props = defineProps<{ item: ResourceItem, version: FileVersionItem }>()
const emit = defineEmits<{ close: [], restore: [] }>()
const { t } = useI18n()

const open = ref(true)
watch(open, value => !value && emit('close'))

/** The same preview as for the file, pointed at this version's content. */
const info = computed<PreviewInfo>(() => {
  const kind = kindOf('file', props.version.mimeType)
  return {
    item: { ...props.item, size: props.version.size, mimeType: props.version.mimeType, kind, thumbnailUrl: null },
    kind,
    scripts: false,
    contentUrl: props.version.contentUrl,
    downloadUrl: props.version.downloadUrl,
    frameUrl: null,
  }
})
const title = computed(() => t('versions.previewTitle', { name: props.item.name, date: midSentence(formatDateTime(props.version.savedAt)) }))
</script>

<template>
  <UiDialog v-model:open="open" :title="title" :description="version.label ?? undefined" size="lg">
    <div class="h-[min(60vh,560px)] overflow-hidden rounded-lg bg-subtle">
      <PreviewContent :info="info" />
    </div>
    <template #footer>
      <UiButton :icon="Download" :href="version.downloadUrl" download>{{ t('common.download') }}</UiButton>
      <UiButton variant="primary" :icon="RotateCcw" @click="emit('restore')">{{ t('versions.restore') }}</UiButton>
    </template>
  </UiDialog>
</template>
