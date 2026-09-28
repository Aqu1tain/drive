<script setup lang="ts">
const props = withDefaults(defineProps<{ keys: string, tone?: 'default' | 'inverse' }>(), { tone: 'default' })

const isMac = import.meta.client && /Mac|iPhone|iPad/.test(navigator.platform)
const MAC: Record<string, string> = { Mod: '⌘', Alt: '⌥', Maj: '⇧', Shift: '⇧' }
const OTHER: Record<string, string> = { Mod: 'Ctrl' }
const parts = computed(() => props.keys.split('+').map(key => (isMac ? MAC : OTHER)[key] ?? key))
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
