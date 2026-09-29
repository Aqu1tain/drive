<script setup lang="ts">
import { Download, Maximize2, Share2, X } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

const props = defineProps<{ id: string, item: ResourceItem | null, apiBase: string, mode: BrowserMode }>()
defineEmits<{ close: [], expand: [] }>()

const dialogs = useDialogs()
const actions = useFileActions()
const { t } = useI18n()
const { data: info, isError, error } = usePreview(toRef(props, 'id'), toRef(props, 'apiBase'))
const current = computed(() => info.value?.item ?? props.item)

/** Inside a sentence "Today" loses its capital, month names keep theirs. */
function midSentence(date: string) {
  const day = [t('format.today'), t('format.yesterday')].find(word => date.startsWith(word))
  return day ? day.toLowerCase() + date.slice(day.length) : date
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <header class="flex h-14 shrink-0 items-center gap-2.5 border-b border-line-weak pr-2 pl-4">
      <FilesFileIcon v-if="current" :kind="current.kind" />
      <h2 class="min-w-0 flex-1 truncate font-semibold text-ink">{{ current?.name ?? t('preview.title') }}</h2>
      <UiIconButton :icon="Maximize2" :label="t('preview.fullScreen')" size="sm" @click="$emit('expand')" />
      <UiIconButton v-if="info?.downloadUrl && current" :icon="Download" :label="t('common.download')" size="sm" @click="actions.download([current], apiBase)" />
      <UiIconButton v-if="mode === 'owner' && current" :icon="Share2" :label="t('common.share')" size="sm" @click="dialogs.share(current)" />
      <UiIconButton :icon="X" :label="t('preview.close')" :shortcut="t('actions.keys.escape')" size="sm" @click="$emit('close')" />
    </header>
    <div class="min-h-0 flex-1 bg-subtle">
      <PreviewContent v-if="info" :info="info" />
      <div v-else-if="isError" class="flex h-full items-center justify-center p-8 text-center text-base text-ink-weak">{{ errorMessage(error, t('preview.unavailable')) }}</div>
      <div v-else class="flex h-full items-center justify-center"><UiSpinner class="size-6 text-ink-hint" /></div>
    </div>
    <footer v-if="current" class="flex h-11 shrink-0 items-center gap-3 border-t border-line-weak px-4 text-sm text-ink-weak tabular">
      <span>{{ formatSize(current.size) }}</span>
      <span aria-hidden="true">·</span>
      <span class="truncate">{{ t('preview.modified', { date: midSentence(formatDateTime(current.updatedAt)) }) }}</span>
    </footer>
  </div>
</template>
