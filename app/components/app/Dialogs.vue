<script setup lang="ts">
const dialogs = useDialogs()
const uploads = useUploads()
const context = useSelectionContext()
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const folderInput = useTemplateRef<HTMLInputElement>('folderInput')

const target = () => context.state.folder ?? { id: null, name: 'Mon Drive' }

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) uploads.uploadTree(filesFromInput(input.files), target())
  input.value = ''
}

const pickFiles = () => fileInput.value?.click()
const pickFolder = () => folderInput.value?.click()

onMounted(() => {
  document.addEventListener('drive:upload', pickFiles)
  document.addEventListener('drive:upload-folder', pickFolder)
})
onBeforeUnmount(() => {
  document.removeEventListener('drive:upload', pickFiles)
  document.removeEventListener('drive:upload-folder', pickFolder)
})
</script>

<template>
  <ShareDialog v-if="dialogs.state.share" :item="dialogs.state.share" @close="dialogs.state.share = null" />
  <DialogsRename v-if="dialogs.state.rename" :item="dialogs.state.rename" @close="dialogs.state.rename = null" />
  <DialogsNewFolder v-if="dialogs.state.newFolder" :parent-id="dialogs.state.newFolder.parentId" @close="dialogs.state.newFolder = null" />
  <DialogsMove v-if="dialogs.state.move" :items="dialogs.state.move" @close="dialogs.state.move = null" />
  <DialogsConflict v-if="dialogs.state.conflict" :request="dialogs.state.conflict" @close="dialogs.state.conflict = null" />
  <input ref="fileInput" type="file" multiple class="hidden" aria-hidden="true" tabindex="-1" @change="onPick">
  <input ref="folderInput" type="file" webkitdirectory class="hidden" aria-hidden="true" tabindex="-1" @change="onPick">
</template>
