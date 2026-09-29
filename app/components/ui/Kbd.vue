<script setup lang="ts">
import type { MessageKey } from '#shared/i18n'

const props = withDefaults(defineProps<{ keys: string, tone?: 'default' | 'inverse' }>(), { tone: 'default' })
const { t } = useI18n()

const isMac = import.meta.client && /Mac|iPhone|iPad/.test(navigator.platform)
const MAC: Record<string, string> = { Mod: '⌘', Alt: '⌥', Shift: '⇧' }
const OTHER: Record<string, string> = { Mod: 'Ctrl' }
const NAMED: Record<string, MessageKey> = { Shift: 'nav.keys.shift', Enter: 'nav.keys.enter', Space: 'nav.keys.space', Esc: 'nav.keys.escape', Delete: 'nav.keys.delete' }

function label(key: string) {
  const symbol = (isMac ? MAC : OTHER)[key]
  if (symbol) return symbol
  const name = NAMED[key]
  return name ? t(name) : key
}

const parts = computed(() => props.keys.split('+').map(label))
</script>

<template>
  <span class="inline-flex items-center gap-0.5" aria-hidden="true">
    <kbd
      v-for="part in parts"
      :key="part"
      class="inline-flex h-5 min-w-5 items-center justify-center rounded px-1 font-sans text-xs font-medium"
      :class="tone === 'inverse' ? 'bg-white/15 text-white/90 dark:bg-black/10 dark:text-ink-inverse' : 'bg-subtle text-ink-weak border border-line-weak'"
    >{{ part }}</kbd>
  </span>
</template>
