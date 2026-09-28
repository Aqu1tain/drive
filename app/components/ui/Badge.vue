<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info' }>(), { tone: 'neutral' })

const TONES = {
  neutral: 'bg-subtle text-ink-weak',
  accent: 'bg-accent-softer text-accent-ink',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
}
</script>

<template>
  <span class="inline-flex h-5 items-center gap-1 rounded-sm px-1.5 text-xs font-medium whitespace-nowrap" :class="TONES[tone]">
    <slot />
  </span>
</template>
