<script setup lang="ts">
import { CloudUpload } from '@lucide/vue'

const props = defineProps<{ owner: boolean }>()
const context = useSelectionContext()
const uploads = useUploads()
const route = useRoute()
const { t } = useI18n()

const ROOT = { id: null, name: t('common.myDrive') }
const depth = ref(0)
const accepts = computed(() => props.owner && route.path !== '/trash')
/** Folder views show their own drop zone and may aim at a subfolder; everywhere else, files land in My Drive. */
const visible = computed(() => depth.value > 0 && accepts.value && !context.state.folder)

const hasFiles = (event: DragEvent) => !!event.dataTransfer?.types.includes('Files')

function onDragEnter(event: DragEvent) {
  if (hasFiles(event)) depth.value++
}

function onDragLeave(event: DragEvent) {
  if (hasFiles(event)) depth.value = Math.max(0, depth.value - 1)
}

/** Files dropped anywhere are handled here, so the browser never leaves the app to open them. */
function onDragOver(event: DragEvent) {
  if (!hasFiles(event)) return
  event.preventDefault()
  if (!accepts.value) event.dataTransfer!.dropEffect = 'none'
}

async function onDrop(event: DragEvent) {
  depth.value = 0
  if (!hasFiles(event) || event.defaultPrevented) return
  event.preventDefault()
  if (!accepts.value) return
  const target = context.state.folder ?? ROOT
  uploads.uploadTree(await filesFromDataTransfer(event.dataTransfer!), target)
}

const reset = () => (depth.value = 0)

onMounted(() => {
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('drop', onDrop)
  window.addEventListener('dragend', reset)
})

onBeforeUnmount(() => {
  window.removeEventListener('dragenter', onDragEnter)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('drop', onDrop)
  window.removeEventListener('dragend', reset)
})
</script>

<template>
  <Transition enter-from-class="opacity-0" leave-to-class="opacity-0" enter-active-class="transition-opacity duration-150" leave-active-class="transition-opacity duration-150">
    <div v-if="visible" class="pointer-events-none fixed inset-3 z-(--z-dropzone) flex items-end justify-center rounded-xl border-2 border-dashed border-accent bg-accent-softer/60 pb-10">
      <div class="flex items-center gap-3 rounded-lg bg-accent px-5 py-3 text-white shadow-lifted">
        <CloudUpload class="size-5" aria-hidden="true" />
        <span class="text-base">
          <UiTranslate message="nav.dropToUpload">
            <template #folder><strong class="font-semibold">{{ ROOT.name }}</strong></template>
          </UiTranslate>
        </span>
      </div>
    </div>
  </Transition>
</template>
