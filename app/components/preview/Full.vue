<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Info, Minimize2, Share2 } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

const props = defineProps<{ id: string, item: ResourceItem | null, siblings: ResourceItem[], apiBase: string, mode: BrowserMode }>()
const emit = defineEmits<{ close: [], navigate: [item: ResourceItem], shrink: [] }>()

const dialogs = useDialogs()
const actions = useFileActions()
const breakpoints = useBreakpoints()
const { t } = useI18n()
const { data: info, isError, error } = usePreview(toRef(props, 'id'), toRef(props, 'apiBase'))
const current = computed(() => info.value?.item ?? props.item)

const isHtml = computed(() => info.value?.kind === 'html')
const index = computed(() => props.siblings.findIndex(s => s.id === props.id))
const previous = computed(() => index.value > 0 ? props.siblings[index.value - 1] : null)
const next = computed(() => index.value >= 0 && index.value < props.siblings.length - 1 ? props.siblings[index.value + 1] : null)

function onKeydown(event: KeyboardEvent) {
  if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|VIDEO|AUDIO)$/.test(event.target.tagName)) return
  if (event.key === 'ArrowLeft' && previous.value) emit('navigate', previous.value)
  if (event.key === 'ArrowRight' && next.value) emit('navigate', next.value)
}

const open = computed({ get: () => true, set: value => !value && emit('close') })

const content = useTemplateRef<{ $el: HTMLElement }>('content')
const focusSelf = () => content.value?.$el.focus()
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-(--z-preview) bg-[#0c0c14] animate-fade-in" />
      <DialogContent
        ref="content"
        :aria-describedby="undefined"
        class="fixed inset-0 z-(--z-preview) flex flex-col bg-[#0c0c14] text-white focus:outline-none"
        @keydown="onKeydown"
        @open-auto-focus.prevent="focusSelf"
      >
        <header class="flex h-14 shrink-0 items-center gap-2 px-2 sm:px-3">
          <UiIconButton :icon="ArrowLeft" :label="t('preview.close')" :shortcut="t('actions.keys.escape')" tone="inverse" @click="emit('close')" />
          <FilesFileIcon v-if="current" :kind="current.kind" class="ml-1 shrink-0" />
          <DialogTitle class="min-w-0 flex-1 truncate text-base font-semibold">{{ current?.name ?? t('preview.title') }}</DialogTitle>
          <span v-if="siblings.length > 1 && index >= 0" class="mr-2 text-sm text-white/60 tabular max-sm:hidden">{{ index + 1 }} / {{ siblings.length }}</span>
          <UiIconButton v-if="info?.downloadUrl && current" :icon="Download" :label="t('common.download')" tone="inverse" @click="actions.download([current], apiBase)" />
          <UiIconButton v-if="mode === 'owner' && current" :icon="Share2" :label="t('common.share')" tone="inverse" @click="dialogs.share(current)" />
          <UiIconButton v-if="mode === 'owner' && current && breakpoints.lg" :icon="Info" :label="t('common.details')" tone="inverse" @click="actions.showDetails(current); emit('shrink')" />
          <UiIconButton v-if="breakpoints.lg && mode !== 'share'" :icon="Minimize2" :label="t('preview.toPanel')" tone="inverse" @click="emit('shrink')" />
        </header>

        <div class="relative flex min-h-0 flex-1">
          <button
            v-if="previous && !isHtml"
            type="button"
            class="absolute top-1/2 left-3 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:flex"
            :aria-label="t('preview.previousItem', { name: previous.name })"
            @click="emit('navigate', previous)"
          >
            <ChevronLeft class="size-6" aria-hidden="true" />
          </button>
          <div class="min-h-0 flex-1" :class="!isHtml && 'sm:px-16'">
            <PreviewContent v-if="info" :key="info.item.id" :info="info" dark />
            <div v-else-if="isError" class="flex h-full items-center justify-center p-8 text-center text-white/70">{{ errorMessage(error, t('preview.unavailable')) }}</div>
            <div v-else class="flex h-full items-center justify-center"><UiSpinner class="size-7 text-white/50" /></div>
          </div>
          <button
            v-if="next && !isHtml"
            type="button"
            class="absolute top-1/2 right-3 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:flex"
            :aria-label="t('preview.nextItem', { name: next.name })"
            @click="emit('navigate', next)"
          >
            <ChevronRight class="size-6" aria-hidden="true" />
          </button>
        </div>

        <footer v-if="siblings.length > 1 && !breakpoints.sm" class="flex h-14 shrink-0 items-center justify-between px-3 safe-bottom">
          <UiIconButton :icon="ChevronLeft" :label="t('preview.previous')" tone="inverse" :disabled="!previous" @click="previous && emit('navigate', previous)" />
          <span class="text-sm text-white/60 tabular">{{ index + 1 }} / {{ siblings.length }}</span>
          <UiIconButton :icon="ChevronRight" :label="t('preview.next')" tone="inverse" :disabled="!next" @click="next && emit('navigate', next)" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
