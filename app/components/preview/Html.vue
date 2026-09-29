<script setup lang="ts">
import { ExternalLink, Maximize, ShieldCheck } from '@lucide/vue'

const props = defineProps<{ src: string, scripts: boolean, title: string, converted?: boolean }>()
const { t } = useI18n()
const notice = computed(() => {
  if (props.converted) return t('preview.converted')
  return t(props.scripts ? 'preview.interactive' : 'preview.safe')
})
const frame = useTemplateRef<HTMLIFrameElement>('frame')

/** The isolated frame itself takes the whole screen; Escape gives the app back. */
const fullscreen = () => frame.value?.requestFullscreen?.()
defineExpose({ fullscreen })
</script>

<template>
  <div class="flex size-full flex-col">
    <div class="flex h-10 shrink-0 items-center gap-1 border-b border-line-weak bg-canvas pr-1.5 pl-3 text-sm text-ink-weak">
      <ShieldCheck class="mr-1 size-4 shrink-0 text-success" aria-hidden="true" />
      <span class="min-w-0 flex-1 truncate">{{ notice }}</span>
      <slot name="actions" />
      <button type="button" class="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-ink hover:bg-hover" @click="fullscreen">
        <Maximize class="size-4" aria-hidden="true" />
        <span class="max-sm:sr-only">{{ t('preview.fullScreen') }}</span>
      </button>
      <a :href="src" target="_blank" rel="noopener noreferrer" class="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-ink hover:bg-hover">
        <ExternalLink class="size-4" aria-hidden="true" />
        <span class="max-sm:sr-only">{{ t('preview.newTab') }}</span>
      </a>
    </div>
    <iframe
      ref="frame"
      :src="src"
      :title="title"
      :sandbox="scripts ? 'allow-scripts allow-popups allow-forms allow-modals' : 'allow-popups allow-popups-to-escape-sandbox'"
      allow="fullscreen"
      referrerpolicy="no-referrer"
      class="min-h-0 flex-1 bg-white"
    />
  </div>
</template>
