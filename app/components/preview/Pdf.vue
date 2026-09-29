<script setup lang="ts">
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'

const props = defineProps<{ src: string, dark?: boolean }>()
const emit = defineEmits<{ error: [] }>()
const { t } = useI18n()

const container = useTemplateRef<HTMLElement>('container')
const pages = ref<Array<{ number: number, ratio: number }>>([])
const width = ref(0)
let task: PDFDocumentLoadingTask | null = null
let pdf: PDFDocumentProxy | null = null
let observer: IntersectionObserver | null = null
const rendered = new Map<number, { width: number, cancel?: () => void }>()

async function load(src: string) {
  cleanup()
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  task = pdfjs.getDocument({ url: src, cMapUrl: '/pdfjs/cmaps/', standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/', iccUrl: '/pdfjs/iccs/' })
  try {
    pdf = await task.promise
    const first = await pdf.getPage(1)
    const viewport = first.getViewport({ scale: 1 })
    pages.value = Array.from({ length: pdf.numPages }, (_, i) => ({ number: i + 1, ratio: viewport.height / viewport.width }))
    await nextTick()
    observe()
  }
  catch (error) {
    if ((error as Error)?.name !== 'AbortException') emit('error')
  }
}

function observe() {
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) render(Number((entry.target as HTMLElement).dataset.page))
    }
  }, { root: container.value, rootMargin: '600px 0px' })
  container.value?.querySelectorAll('[data-page]').forEach(el => observer!.observe(el))
}

async function render(number: number) {
  if (!pdf || !container.value) return
  const target = Math.min(width.value, 1100)
  if (rendered.get(number)?.width === target) return
  rendered.get(number)?.cancel?.()
  const page = await pdf.getPage(number)
  const base = page.getViewport({ scale: 1 })
  const dpr = window.devicePixelRatio || 1
  const viewport = page.getViewport({ scale: target / base.width })
  const canvas = container.value.querySelector<HTMLCanvasElement>(`[data-page="${number}"] canvas`)
  if (!canvas) return
  canvas.width = Math.floor(viewport.width * dpr)
  canvas.height = Math.floor(viewport.height * dpr)
  const slot = pages.value[number - 1]
  if (slot) slot.ratio = viewport.height / viewport.width
  const job = page.render({ canvas, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined })
  rendered.set(number, { width: target, cancel: () => job.cancel() })
  await job.promise.catch(() => rendered.delete(number))
}

function cleanup() {
  observer?.disconnect()
  for (const entry of rendered.values()) entry.cancel?.()
  rendered.clear()
  task?.destroy()
  task = null
  pdf = null
  pages.value = []
}

onMounted(() => {
  const resize = new ResizeObserver(([entry]) => {
    const next = Math.floor(entry!.contentRect.width - 32)
    if (Math.abs(next - width.value) < 24) return
    width.value = next
    for (const number of [...rendered.keys()]) {
      rendered.delete(number)
      render(number)
    }
  })
  resize.observe(container.value!)
  onBeforeUnmount(() => resize.disconnect())
})

watch(() => props.src, src => load(src), { immediate: true })
onBeforeUnmount(cleanup)
</script>

<template>
  <div ref="container" class="size-full overflow-auto">
    <div class="mx-auto flex flex-col items-center gap-4 p-4" :style="{ maxWidth: '1132px' }">
      <template v-if="pages.length">
        <div
          v-for="page in pages"
          :key="page.number"
          :data-page="page.number"
          class="w-full overflow-hidden rounded-sm bg-white shadow-raised"
          :style="{ aspectRatio: `1 / ${page.ratio}`, maxWidth: `${Math.min(width, 1100)}px` }"
        >
          <canvas class="block size-full" :aria-label="t('preview.page', { number: String(page.number) })" />
        </div>
        <p class="pb-4 text-sm" :class="dark ? 'text-white/60' : 'text-ink-weak'">{{ t('preview.pages', { count: pages.length }) }}</p>
      </template>
      <div v-else class="aspect-[1/1.414] w-full max-w-[720px] rounded-sm bg-white/90 p-10 shadow-raised">
        <div class="flex flex-col gap-3">
          <UiSkeleton width="60%" height="1.25rem" />
          <UiSkeleton v-for="n in 10" :key="n" :width="`${70 + (n * 13) % 30}%`" />
        </div>
      </div>
    </div>
  </div>
</template>
