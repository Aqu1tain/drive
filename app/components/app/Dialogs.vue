<script setup lang="ts">
import type { ResourceItem } from '#shared/types/api'

const dialogs = useDialogs()
const uploads = useUploads()
const context = useSelectionContext()
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const folderInput = useTemplateRef<HTMLInputElement>('folderInput')
const pageInput = useTemplateRef<HTMLInputElement>('pageInput')
const versionInput = useTemplateRef<HTMLInputElement>('versionInput')
const { t } = useI18n()
let versionOf: ResourceItem | null = null

const target = () => context.state.folder ?? { id: null, name: t('common.myDrive') }

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) uploads.uploadTree(filesFromInput(input.files), target())
  input.value = ''
}

/** The folder of the file whose new version is picked, named for the upload queue. */
function versionTarget(item: ResourceItem) {
  const current = context.state.folder
  if (current?.id === item.parentId) return current
  return { id: item.parentId, name: item.location?.split(' / ').at(-1) ?? t('common.myDrive') }
}

function onPickVersion(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file && versionOf) uploads.uploadVersion(file, versionOf, versionTarget(versionOf))
  input.value = ''
}

function pickVersion(event: Event) {
  versionOf = (event as CustomEvent<ResourceItem>).detail
  versionInput.value?.click()
}

const pickFiles = () => fileInput.value?.click()
const pickFolder = () => folderInput.value?.click()
const pickPage = () => pageInput.value?.click()

onMounted(() => {
  document.addEventListener('drive:upload', pickFiles)
  document.addEventListener('drive:upload-folder', pickFolder)
  document.addEventListener('drive:upload-page', pickPage)
  document.addEventListener('drive:upload-version', pickVersion)
})
onBeforeUnmount(() => {
  document.removeEventListener('drive:upload', pickFiles)
  document.removeEventListener('drive:upload-folder', pickFolder)
  document.removeEventListener('drive:upload-page', pickPage)
  document.removeEventListener('drive:upload-version', pickVersion)
})
</script>

<template>
  <ShareDialog v-if="dialogs.state.share" :item="dialogs.state.share" @close="dialogs.state.share = null" />
  <DialogsRename v-if="dialogs.state.rename" :item="dialogs.state.rename" @close="dialogs.state.rename = null" />
  <DialogsNewFolder v-if="dialogs.state.newFolder" :parent-id="dialogs.state.newFolder.parentId" @close="dialogs.state.newFolder = null" />
  <DialogsMove v-if="dialogs.state.move" :items="dialogs.state.move" @close="dialogs.state.move = null" />
  <DialogsTags v-if="dialogs.state.tags" :items="dialogs.state.tags" @close="dialogs.state.tags = null" />
  <DialogsTagEdit v-if="dialogs.state.tagEdit" :tag="dialogs.state.tagEdit" @close="dialogs.state.tagEdit = null" />
  <DialogsConflict v-if="dialogs.state.conflict" :request="dialogs.state.conflict" @close="dialogs.state.conflict = null" />
  <input ref="fileInput" type="file" multiple class="hidden" aria-hidden="true" tabindex="-1" @change="onPick">
  <input ref="folderInput" type="file" webkitdirectory class="hidden" aria-hidden="true" tabindex="-1" @change="onPick">
  <input ref="pageInput" type="file" accept=".html,.htm,text/html,.zip,application/zip" class="hidden" aria-hidden="true" tabindex="-1" @change="onPick">
  <input ref="versionInput" type="file" class="hidden" aria-hidden="true" tabindex="-1" @change="onPickVersion">
</template>
