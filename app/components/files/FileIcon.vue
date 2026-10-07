<script setup lang="ts">
import { BookOpen, File, FileArchive, FileCode, FileImage, FileMusic, FileSpreadsheet, FileText, FileVideoCamera, Folder, Globe, Presentation } from '@lucide/vue'
import type { FileKind } from '#shared/utils/search'

const props = withDefaults(defineProps<{ kind: FileKind, size?: 'sm' | 'md' | 'lg' | 'xl' }>(), { size: 'md' })

const ICONS = {
  folder: Folder, pdf: FileText, image: FileImage, video: FileVideoCamera, audio: FileMusic, document: FileText,
  spreadsheet: FileSpreadsheet, presentation: Presentation, ebook: BookOpen, text: FileCode, html: Globe, archive: FileArchive, other: File,
}

/** One hue per family, tuned to stay readable on both themes. */
const COLORS: Record<FileKind, string> = {
  folder: 'text-accent',
  pdf: 'text-[oklch(0.58_0.2_25)] dark:text-[oklch(0.7_0.17_25)]',
  image: 'text-[oklch(0.58_0.14_155)] dark:text-[oklch(0.72_0.14_155)]',
  video: 'text-[oklch(0.56_0.19_330)] dark:text-[oklch(0.72_0.15_330)]',
  audio: 'text-[oklch(0.62_0.16_55)] dark:text-[oklch(0.75_0.14_55)]',
  document: 'text-[oklch(0.55_0.16_250)] dark:text-[oklch(0.72_0.13_250)]',
  spreadsheet: 'text-[oklch(0.55_0.13_150)] dark:text-[oklch(0.72_0.13_150)]',
  presentation: 'text-[oklch(0.62_0.17_45)] dark:text-[oklch(0.75_0.14_45)]',
  ebook: 'text-[oklch(0.52_0.12_200)] dark:text-[oklch(0.72_0.11_200)]',
  text: 'text-ink-weak',
  html: 'text-[oklch(0.55_0.17_285)] dark:text-[oklch(0.74_0.13_285)]',
  archive: 'text-[oklch(0.55_0.06_60)] dark:text-[oklch(0.72_0.06_60)]',
  other: 'text-ink-hint',
}

const SIZES = { sm: 'size-4', md: 'size-5', lg: 'size-8', xl: 'size-12' }
const icon = computed(() => ICONS[props.kind] ?? File)
</script>

<template>
  <component
    :is="icon"
    :class="[SIZES[size], COLORS[kind]]"
    :fill="kind === 'folder' ? 'currentColor' : 'none'"
    :fill-opacity="kind === 'folder' ? 0.18 : undefined"
    :stroke-width="size === 'xl' ? 1.25 : 1.75"
    aria-hidden="true"
  />
</template>
