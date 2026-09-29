<script setup lang="ts">
import { ChevronDown, ChevronUp, CircleAlert, CircleCheck, RotateCcw, X } from '@lucide/vue'
import { kindOf } from '#shared/utils/search'

const uploads = useUploads()
const preferences = usePreferences()
const { t } = useI18n()
const tasks = computed(() => uploads.state.tasks.filter(t => t.status !== 'canceled'))
const running = computed(() => uploads.active.value.length)
const failed = computed(() => tasks.value.filter(t => t.status === 'error'))
const done = computed(() => tasks.value.filter(t => t.status === 'done'))

const title = computed(() => {
  if (running.value) return t('uploads.uploading', { count: running.value })
  if (failed.value.length) return t('uploads.failed', { count: failed.value.length })
  return t('uploads.done', { count: done.value.length })
})

const kindFor = (file: File) => kindOf('file', file.type || null)
const percent = (task: UploadTask) => task.status === 'queued' || !task.file.size ? 0 : Math.round((task.loaded / task.file.size) * 100)

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!running.value) return
  event.preventDefault()
}

onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
</script>

<template>
  <div class="sr-only" aria-live="polite">{{ uploads.state.announcement }}</div>
  <Transition enter-from-class="translate-y-4 opacity-0" leave-to-class="translate-y-4 opacity-0" enter-active-class="transition duration-250 ease-out-quint" leave-active-class="transition duration-150">
    <section
      v-if="tasks.length"
      class="fixed right-0 bottom-0 z-(--z-uploads) w-full overflow-hidden border border-line-weak bg-raised shadow-lifted sm:right-6 sm:bottom-6 sm:w-[400px] sm:rounded-lg max-sm:rounded-t-xl max-sm:safe-bottom"
      :aria-label="t('uploads.title')"
    >
      <header class="flex h-12 items-center gap-2 pr-2 pl-4">
        <UiSpinner v-if="running" class="size-4 text-accent" />
        <CircleAlert v-else-if="failed.length" class="size-4 text-danger" aria-hidden="true" />
        <CircleCheck v-else class="size-4 text-success" aria-hidden="true" />
        <h2 class="min-w-0 flex-1 truncate text-base font-semibold text-ink">{{ title }}</h2>
        <UiButton v-if="running" size="sm" variant="ghost" @click="uploads.cancelAll()">{{ t('uploads.cancelAll') }}</UiButton>
        <UiIconButton :icon="preferences.uploadsCollapsed ? ChevronUp : ChevronDown" :label="t(preferences.uploadsCollapsed ? 'uploads.expand' : 'uploads.collapse')" size="sm" @click="preferences.uploadsCollapsed = !preferences.uploadsCollapsed" />
        <UiIconButton v-if="!running" :icon="X" :label="t('common.close')" size="sm" @click="uploads.clear()" />
      </header>
      <div v-if="running" class="h-0.5 bg-subtle" role="progressbar" :aria-valuenow="Math.round(uploads.progress.value * 100)" aria-valuemin="0" aria-valuemax="100" :aria-label="t('uploads.progress')">
        <div class="h-full bg-accent transition-[width] duration-300" :style="{ width: `${uploads.progress.value * 100}%` }" />
      </div>
      <ul v-if="!preferences.uploadsCollapsed" class="max-h-72 overflow-y-auto py-1">
        <li v-for="task in tasks" :key="task.id" class="flex items-center gap-3 px-4 py-2">
          <FilesFileIcon :kind="kindFor(task.file)" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-base text-ink" :title="task.name">{{ task.name }}</p>
            <p v-if="task.status === 'error'" class="truncate text-sm text-danger">{{ task.error }}</p>
            <div v-else-if="task.status === 'uploading' || task.status === 'queued'" class="mt-1.5 flex items-center gap-2">
              <div class="h-1 flex-1 overflow-hidden rounded-full bg-subtle">
                <div class="h-full rounded-full bg-accent transition-[width] duration-200" :style="{ width: `${task.file.size ? (task.loaded / task.file.size) * 100 : 0}%` }" />
              </div>
              <span class="w-9 text-right text-xs text-ink-weak tabular">{{ t('uploads.percent', { value: percent(task) }) }}</span>
            </div>
            <p v-else class="truncate text-sm text-ink-weak">{{ formatSize(task.file.size) }} · {{ task.parentName }}</p>
          </div>
          <UiIconButton v-if="task.status === 'uploading' || task.status === 'queued'" :icon="X" :label="t('uploads.cancelFile', { name: task.name })" size="sm" @click="uploads.cancel(task)" />
          <UiIconButton v-else-if="task.status === 'error'" :icon="RotateCcw" :label="t('uploads.retryFile', { name: task.name })" size="sm" @click="uploads.retry(task)" />
          <CircleCheck v-else class="size-4 shrink-0 text-success" :aria-label="t('uploads.uploaded')" />
        </li>
      </ul>
    </section>
  </Transition>
</template>
