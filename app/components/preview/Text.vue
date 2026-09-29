<script setup lang="ts">
import MarkdownIt from 'markdown-it'

const props = defineProps<{ src: string, markdown: boolean, size: number }>()
const emit = defineEmits<{ error: [] }>()
const { t } = useI18n()

const LIMIT = 512 * 1024
const text = ref<string | null>(null)
const truncated = computed(() => props.size > LIMIT)

const md = new MarkdownIt({ html: false, linkify: true, typographer: true })
const defaultLinkOpen = md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx]!.attrSet('target', '_blank')
  tokens[idx]!.attrSet('rel', 'noopener noreferrer nofollow')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

const html = computed(() => props.markdown && text.value !== null ? md.render(text.value) : '')

watch(() => props.src, async (src) => {
  text.value = null
  try {
    const response = await fetch(src, { headers: { Range: `bytes=0-${LIMIT - 1}` } })
    if (!response.ok) throw new Error(String(response.status))
    text.value = new TextDecoder('utf-8', { fatal: false }).decode(await response.arrayBuffer())
  }
  catch {
    emit('error')
  }
}, { immediate: true })
</script>

<template>
  <div class="size-full overflow-auto">
    <div class="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <div v-if="text === null" class="flex flex-col gap-2.5 rounded-lg bg-canvas p-6 shadow-norm">
        <UiSkeleton v-for="n in 8" :key="n" :width="`${50 + (n * 23) % 45}%`" />
      </div>
      <!-- markdown-it runs with html disabled: every tag in the source is escaped, links are validated -->
      <article v-else-if="markdown" class="markdown rounded-lg bg-canvas p-6 shadow-norm sm:p-8" v-html="html" />
      <pre v-else class="rounded-lg bg-canvas p-5 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words text-ink shadow-norm">{{ text }}</pre>
      <p v-if="truncated && text !== null" class="mt-3 text-center text-sm text-ink-weak">{{ t('preview.truncated') }}</p>
    </div>
  </div>
</template>

<style scoped>
.markdown { color: var(--ink); font-size: 0.9375rem; line-height: 1.65; }
.markdown :deep(h1) { font-size: 1.6rem; font-weight: 650; margin: 0 0 1rem; line-height: 1.25; }
.markdown :deep(h2) { font-size: 1.3rem; font-weight: 650; margin: 1.75rem 0 0.75rem; }
.markdown :deep(h3) { font-size: 1.1rem; font-weight: 650; margin: 1.5rem 0 0.5rem; }
.markdown :deep(p), .markdown :deep(ul), .markdown :deep(ol), .markdown :deep(blockquote), .markdown :deep(pre), .markdown :deep(table) { margin: 0 0 1rem; }
.markdown :deep(ul) { list-style: disc; padding-left: 1.5rem; }
.markdown :deep(ol) { list-style: decimal; padding-left: 1.5rem; }
.markdown :deep(a) { color: var(--accent-ink); text-decoration: underline; text-underline-offset: 2px; }
.markdown :deep(code) { font-family: var(--font-mono); font-size: 0.85em; background: var(--subtle); padding: 0.1em 0.35em; border-radius: 4px; }
.markdown :deep(pre) { background: var(--subtle); padding: 1rem; border-radius: 8px; overflow-x: auto; }
.markdown :deep(pre code) { background: none; padding: 0; }
.markdown :deep(blockquote) { border-left: 3px solid var(--line); padding-left: 1rem; color: var(--ink-weak); }
.markdown :deep(table) { border-collapse: collapse; width: 100%; font-size: 0.875rem; }
.markdown :deep(th), .markdown :deep(td) { border: 1px solid var(--line-weak); padding: 0.4rem 0.6rem; text-align: left; }
.markdown :deep(hr) { border: 0; border-top: 1px solid var(--line-weak); margin: 1.5rem 0; }
.markdown :deep(img) { max-width: 100%; }
</style>
