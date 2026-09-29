<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { FolderOpen, FolderPlus, HardDrive, RotateCcw, Upload } from '@lucide/vue'
import type { Crumb, FolderListing } from '#shared/types/api'

const props = defineProps<{ folderId: string | null, mode: 'owner' | 'reader' }>()
const dialogs = useDialogs()
const actions = useFileActions()
const { t } = useI18n()

const base = computed(() => props.mode === 'owner' ? '/drive' : '/shared-with-me')
const folderTo = (id: string) => `${base.value}/folder/${id}`
const crumbTo = (crumb: Crumb) => crumb.id ? folderTo(crumb.id) : base.value

const { data, isPending, error } = useQuery({
  queryKey: computed(() => ['folder', props.folderId ?? 'root']),
  queryFn: () => api<FolderListing>(`/api/folders/${props.folderId ?? 'root'}`),
  retry: false,
})

const name = computed(() => data.value?.folder?.name ?? (props.folderId ? '' : t('common.myDrive')))
useHead({ title: name })

watch(() => props.folderId, (id) => {
  if (id && props.mode === 'owner') api(`/api/resources/${id}/open`, { method: 'POST' }).catch(() => {})
}, { immediate: true })

const status = computed(() => errorStatus(error.value))
const failure = computed(() => {
  if (status.value === 409) return { title: t('files.trashedFolder.title'), description: t('files.trashedFolder.recover') }
  if (status.value === 403) return { title: t('views.folder.denied'), description: t('views.folder.deniedHint') }
  return { title: t('views.folder.missing'), description: t('views.folder.missingHint') }
})
</script>

<template>
  <div v-if="error" class="flex flex-1 items-center justify-center">
    <UiEmptyState
      :icon="FolderOpen"
      :title="failure.title"
      :description="failure.description"
    >
      <UiButton v-if="status === 409 && folderId" variant="primary" :icon="RotateCcw" @click="actions.restore([{ id: folderId } as never])">{{ t('actions.restore') }}</UiButton>
      <UiButton :variant="status === 409 ? 'secondary' : 'primary'" @click="navigateTo(base)">{{ t(mode === 'owner' ? 'views.folder.backToDrive' : 'views.folder.backToShared') }}</UiButton>
    </UiEmptyState>
  </div>
  <FilesDriveView
    v-else
    :items="data?.items ?? []"
    :loading="isPending"
    :mode="mode"
    :label="t('views.folder.contents', { name: name || t('views.folder.unnamed') })"
    :folder="{ id: folderId, name: name || t('views.folder.this') }"
    :folder-item="data?.folder ?? null"
    :crumbs="data?.breadcrumbs ?? [{ id: null, name: t(mode === 'owner' ? 'common.myDrive' : 'labels.sharedWithMe') }]"
    :crumb-to="crumbTo"
    :folder-to="folderTo"
  >
    <template #empty="{ pickFiles }">
      <UiEmptyState
        v-if="mode === 'owner'"
        :icon="folderId ? FolderOpen : HardDrive"
        :title="t(folderId ? 'views.folder.empty' : 'views.folder.emptyDrive')"
        :description="t('views.folder.emptyHint')"
      >
        <UiButton variant="primary" :icon="Upload" @click="pickFiles">{{ t('files.upload') }}</UiButton>
        <UiButton :icon="FolderPlus" @click="dialogs.newFolder(folderId)">{{ t('files.newFolder') }}</UiButton>
      </UiEmptyState>
      <UiEmptyState v-else :icon="FolderOpen" :title="t('views.folder.empty')" :description="t('views.folder.emptyShared')" />
    </template>
  </FilesDriveView>
</template>
