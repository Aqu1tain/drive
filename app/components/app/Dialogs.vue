<script setup lang="ts">
const dialogs = useDialogs()
const uploads = useUploads()
const context = useSelectionContext()
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const folderInput = useTemplateRef<HTMLInputElement>('folderInput')
const pageInput = useTemplateRef<HTMLInputElement>('pageInput')
const { t } = useI18n()

const target = () => context.state.folder ?? { id: null, name: t('common.myDrive') }

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) uploads.uploadTree(filesFromInput(input.files), target())
  input.value = ''
}

const pickFiles = () => fileInput.value?.click()
const pickFolder = () => folderInput.value?.click()
const pickPage = () => pageInput.value?.click()

onMounted(() => {
  document.addEventListener('drive:upload', pickFiles)
  document.addEventListener('drive:upload-folder', pickFolder)
  document.addEventListener('drive:upload-page', pickPage)
})
onBeforeUnmount(() => {
  document.removeEventListener('drive:upload', pickFiles)
  document.removeEventListener('drive:upload-folder', pickFolder)
  document.removeEventListener('drive:upload-page', pickPage)
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
</template>
