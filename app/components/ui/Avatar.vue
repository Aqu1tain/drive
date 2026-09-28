<script setup lang="ts">
const props = withDefaults(defineProps<{ name: string, size?: 'xs' | 'sm' | 'md' | 'lg', kind?: 'user' | 'invitation' | 'link' }>(), { size: 'md', kind: 'user' })

const HUES = [262, 200, 160, 24, 330, 290, 120, 4]
const hue = computed(() => HUES[[...props.name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % HUES.length])
const SIZES = { xs: 'size-5 text-[10px]', sm: 'size-6 text-[11px]', md: 'size-8 text-xs', lg: 'size-10 text-sm' }
</script>

<template>
  <span
    class="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold"
    :class="[SIZES[size], kind === 'invitation' && 'ring-1 ring-dashed']"
    :style="{ backgroundColor: `oklch(0.9 0.06 ${hue})`, color: `oklch(0.38 0.12 ${hue})` }"
    aria-hidden="true"
  >
    {{ initials(name) }}
  </span>
</template>
