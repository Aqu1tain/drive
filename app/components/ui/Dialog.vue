<script setup lang="ts">
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { X } from '@lucide/vue'

const open = defineModel<boolean>('open', { default: false })
withDefaults(defineProps<{ title: string, description?: string, size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })
const emit = defineEmits<{ openAutoFocus: [Event] }>()
const { t } = useI18n()

const WIDTHS = { sm: 'sm:max-w-sm', md: 'sm:max-w-[480px]', lg: 'sm:max-w-[600px]' }
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-(--z-modal) bg-backdrop animate-fade-in" />
      <DialogContent
        v-bind="description ? {} : { 'aria-describedby': undefined }"
        class="fixed left-1/2 z-(--z-modal) flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 flex-col rounded-lg bg-raised shadow-lifted animate-pop-in focus:outline-none sm:top-[max(1rem,10vh)] sm:max-h-[min(calc(100dvh-2rem),84vh)] max-sm:bottom-0 max-sm:w-full max-sm:rounded-b-none max-sm:safe-bottom"
        :class="WIDTHS[size]"
        @open-auto-focus="emit('openAutoFocus', $event)"
      >
        <header class="flex items-start gap-3 py-5 pr-14 pl-5 pb-3">
          <div class="min-w-0 flex-1">
            <DialogTitle class="text-lg font-semibold text-ink text-balance break-words">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="mt-1 text-base text-ink-weak">{{ description }}</DialogDescription>
          </div>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="flex flex-wrap items-center justify-end gap-2 border-t border-line-weak px-5 py-3.5">
          <slot name="footer" />
        </footer>
        <DialogClose as-child>
          <UiIconButton :icon="X" :label="t('common.close')" size="sm" class="absolute top-4 right-3.5" />
        </DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
