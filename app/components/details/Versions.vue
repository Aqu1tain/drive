<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { Download, Ellipsis, Eye, Pencil, Pin, PinOff, RotateCcw, Trash2, Upload } from '@lucide/vue'
import { toast } from 'vue-sonner'
import type { Crumb, FileVersionItem, ResourceItem, VersionHistory } from '#shared/types/api'

const props = defineProps<{ item: ResourceItem, path: Crumb[] }>()
const { t } = useI18n()
const dialogs = useDialogs()
const uploads = useUploads()
const actions = useFileActions()
const queryClient = useQueryClient()

const { data: history } = useQuery({
  queryKey: computed(() => ['versions', props.item.id]),
  queryFn: () => api<VersionHistory>(`/api/resources/${props.item.id}/versions`),
})

const folder = computed(() => props.path.at(-1) ?? { id: null, name: t('common.myDrive') })
const groups = computed(() => {
  const byDay = Map.groupBy(history.value?.versions ?? [], version => formatDay(version.savedAt))
  return [...byDay].map(([day, versions]) => ({ day, versions }))
})

function refresh() {
  queryClient.invalidateQueries({ queryKey: ['versions', props.item.id] })
  queryClient.invalidateQueries({ queryKey: ['open'] })
  actions.refresh()
}

async function attempt(task: () => Promise<unknown>, success: string) {
  try {
    await task()
    toast(success)
  }
  catch (error) {
    toast.error(errorMessage(error, t('versions.failed')))
  }
  refresh()
}

const turnOn = () => attempt(
  () => api(`/api/resources/${folder.value.id}`, { method: 'PATCH', body: { versioning: true } }),
  t('versions.turnedOn', { folder: folder.value.name }),
)

async function restore(version: FileVersionItem) {
  previewing.value = null
  const confirmed = await dialogs.confirm({ title: t('versions.restoreTitle'), message: t('versions.restoreMessage'), confirmLabel: t('versions.restore') })
  if (!confirmed) return
  await attempt(() => api(`/api/resources/${props.item.id}/versions/${version.id}/restore`, { method: 'POST' }), t('versions.restored'))
}

async function remove(version: FileVersionItem) {
  const confirmed = await dialogs.confirm({ title: t('versions.deleteTitle'), message: t('versions.deleteMessage'), confirmLabel: t('common.delete'), danger: true })
  if (!confirmed) return
  await attempt(() => api(`/api/resources/${props.item.id}/versions/${version.id}`, { method: 'DELETE' }), t('versions.deleted'))
}

const naming = ref<string | null>(null)
const draft = ref('')
const nameInput = useTemplateRef<HTMLInputElement[]>('nameInput')

function startNaming(version: FileVersionItem) {
  naming.value = version.id
  draft.value = version.label ?? ''
  nextTick(() => nameInput.value?.[0]?.focus())
}

async function saveName(version: FileVersionItem, label: string | null = draft.value.trim() || null) {
  if (naming.value !== version.id && label !== null) return
  naming.value = null
  if (label === version.label) return
  try {
    await api(`/api/resources/${props.item.id}/versions/${version.id}`, { method: 'PATCH', body: { label } })
  }
  catch (error) {
    toast.error(errorMessage(error, t('versions.failed')))
  }
  queryClient.invalidateQueries({ queryKey: ['versions', props.item.id] })
}

const previewing = ref<FileVersionItem | null>(null)
const footnote = computed(() => [history.value?.totalSize ? t('versions.total', { size: formatSize(history.value.totalSize) }) : '', t('versions.retention')].filter(Boolean).join(' '))

const picker = useTemplateRef<HTMLInputElement>('picker')
function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) uploads.uploadVersion(file, props.item, folder.value)
  input.value = ''
}

const menuFor = (version: FileVersionItem): MenuEntry[] => tidyMenu([
  { id: 'preview', label: t('versions.preview'), icon: Eye, onSelect: () => (previewing.value = version) },
  { id: 'download', label: t('common.download'), icon: Download, onSelect: () => window.location.assign(version.downloadUrl) },
  { id: 'restore', label: t('versions.restore'), icon: RotateCcw, onSelect: () => restore(version) },
  { kind: 'separator' },
  { id: 'name', label: t(version.label ? 'versions.rename' : 'versions.name'), icon: Pencil, onSelect: () => startNaming(version) },
  version.label && { id: 'unname', label: t('versions.unname'), icon: PinOff, onSelect: () => saveName(version, null) },
  { kind: 'separator' },
  { id: 'delete', label: t('common.delete'), icon: Trash2, danger: true, onSelect: () => remove(version) },
])
</script>

<template>
  <div class="flex flex-col gap-5">
    <div v-if="history && !history.versioning.enabled" class="rounded-lg bg-subtle p-3.5">
      <p class="text-base font-semibold text-ink">{{ t('versions.offTitle') }}</p>
      <p class="mt-1 text-sm text-ink-weak text-pretty">{{ t(folder.id ? 'versions.offHint' : 'versions.offAtRoot') }}</p>
      <UiButton v-if="folder.id" size="sm" class="mt-3" @click="turnOn">{{ t('versions.turnOn', { folder: folder.name }) }}</UiButton>
    </div>

    <div>
      <UiButton :icon="Upload" @click="picker?.click()">{{ t('versions.uploadNew') }}</UiButton>
      <input ref="picker" type="file" class="hidden" aria-hidden="true" tabindex="-1" @change="onPick">
    </div>

    <section v-if="history" aria-labelledby="versions-current" class="rounded-lg border border-line-weak px-3.5 py-3">
      <h3 id="versions-current" class="text-base font-semibold text-ink">{{ t('versions.current') }}</h3>
      <p class="text-sm text-ink-weak">{{ t('versions.savedAt', { date: midSentence(formatDateTime(history.current.savedAt)) }) }} · {{ formatSize(history.current.size) }}</p>
    </section>

    <p v-if="history && !history.versions.length" class="text-sm text-ink-weak text-pretty">{{ t('versions.empty') }}</p>

    <section v-else-if="history" aria-labelledby="versions-previous">
      <h3 id="versions-previous" class="mb-2 text-base font-semibold text-ink">{{ t('versions.previous') }}</h3>
      <div v-for="group in groups" :key="group.day" class="mb-3">
        <h4 class="mb-1 px-2 text-xs font-semibold tracking-wide text-ink-weak uppercase">{{ group.day }}</h4>
        <ul>
          <li v-for="version in group.versions" :key="version.id" class="flex items-center gap-1 rounded-md hover:bg-hover">
            <form v-if="naming === version.id" class="min-w-0 flex-1 p-1" @submit.prevent="saveName(version)">
              <input
                ref="nameInput"
                v-model="draft"
                :aria-label="t('versions.name')"
                :placeholder="t('versions.namePlaceholder')"
                maxlength="100"
                class="h-8 w-full rounded-md border border-field bg-canvas px-2 text-base text-ink focus:border-accent focus:ring-3 focus:ring-focus-ring focus:outline-none"
                @keydown.esc.prevent="naming = null"
                @blur="saveName(version)"
              >
              <p class="mt-1 px-0.5 text-xs text-ink-weak">{{ t('versions.nameHint') }}</p>
            </form>
            <button v-else type="button" class="min-w-0 flex-1 px-2 py-1.5 text-left" @click="previewing = version">
              <span class="flex min-w-0 items-center gap-1.5">
                <Pin v-if="version.label" class="size-3.5 shrink-0 text-accent-ink" :aria-label="t('versions.named')" />
                <span class="truncate text-base text-ink">{{ version.label || formatTime(version.savedAt) }}</span>
              </span>
              <span class="block text-sm text-ink-weak">{{ version.label ? `${formatTime(version.savedAt)} · ` : '' }}{{ formatSize(version.size) }}</span>
            </button>
            <UiDropdownMenu v-if="naming !== version.id" :entries="menuFor(version)" align="end">
              <UiIconButton :icon="Ellipsis" :label="t('versions.actions')" size="sm" />
            </UiDropdownMenu>
          </li>
        </ul>
      </div>
    </section>

    <p v-if="history" class="text-xs text-ink-weak text-pretty">{{ footnote }}</p>

    <DialogsVersionPreview v-if="previewing" :item="item" :version="previewing" @close="previewing = null" @restore="restore(previewing!)" />
  </div>
</template>
