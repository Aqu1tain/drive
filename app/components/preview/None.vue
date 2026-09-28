<script setup lang="ts">
import { Download } from '@lucide/vue'
import type { PreviewInfo } from '#shared/types/api'

const props = defineProps<{ info: PreviewInfo, dark?: boolean }>()

function download() {
  const anchor = document.createElement('a')
  anchor.href = props.info.downloadUrl!
  anchor.download = props.info.item.name
  anchor.click()
}
</script>

<template>
  <div class="flex size-full flex-col items-center justify-center gap-4 p-8 text-center">
    <div class="flex size-20 items-center justify-center rounded-2xl" :class="dark ? 'bg-white/10' : 'bg-canvas shadow-norm'">
      <FilesFileIcon :kind="info.kind" size="xl" />
    </div>
    <div>
      <p class="font-semibold" :class="dark ? 'text-white' : 'text-ink'">Ce fichier ne peut pas être prévisualisé</p>
      <p class="mt-1 text-sm" :class="dark ? 'text-white/60' : 'text-ink-weak'">{{ info.item.name }} · {{ formatSize(info.item.size) }}</p>
    </div>
    <UiButton v-if="info.downloadUrl" variant="primary" :icon="Download" @click="download">
      Télécharger
    </UiButton>
    <p v-else class="text-sm" :class="dark ? 'text-white/60' : 'text-ink-weak'">Le téléchargement n’est pas autorisé pour ce partage.</p>
  </div>
</template>
