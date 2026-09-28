<script setup lang="ts">
import { Download, Maximize2, Share2, X } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

const props = defineProps<{ id: string, item: ResourceItem | null, apiBase: string, mode: BrowserMode }>()
defineEmits<{ close: [], expand: [] }>()

const dialogs = useDialogs()
const actions = useFileActions()
const { data: info, isError, error } = usePreview(toRef(props, 'id'), toRef(props, 'apiBase'))
const current = computed(() => info.value?.item ?? props.item)
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <header class="flex h-14 shrink-0 items-center gap-2.5 border-b border-line-weak pr-2 pl-4">
      <FilesFileIcon v-if="current" :kind="current.kind" />
      <h2 class="min-w-0 flex-1 truncate font-semibold text-ink">{{ current?.name ?? 'Aperçu' }}</h2>
      <UiIconButton :icon="Maximize2" label="Plein écran" size="sm" @click="$emit('expand')" />
      <UiIconButton v-if="info?.downloadUrl && current" :icon="Download" label="Télécharger" size="sm" @click="actions.download([current], apiBase)" />
      <UiIconButton v-if="mode === 'owner' && current" :icon="Share2" label="Partager" size="sm" @click="dialogs.share(current)" />
      <UiIconButton :icon="X" label="Fermer l’aperçu" shortcut="Échap" size="sm" @click="$emit('close')" />
    </header>
    <div class="min-h-0 flex-1 bg-subtle">
      <PreviewContent v-if="info" :info="info" />
      <div v-else-if="isError" class="flex h-full items-center justify-center p-8 text-center text-base text-ink-weak">{{ errorMessage(error, 'Aperçu indisponible') }}</div>
      <div v-else class="flex h-full items-center justify-center"><UiSpinner class="size-6 text-ink-hint" /></div>
    </div>
    <footer v-if="current" class="flex h-11 shrink-0 items-center gap-3 border-t border-line-weak px-4 text-sm text-ink-weak tabular">
      <span>{{ formatSize(current.size) }}</span>
      <span aria-hidden="true">·</span>
      <span class="truncate">Modifié {{ formatDateTime(current.updatedAt).toLowerCase() }}</span>
    </footer>
  </div>
</template>
