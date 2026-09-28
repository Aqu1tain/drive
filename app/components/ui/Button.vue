<script setup lang="ts">
import type { Component } from 'vue'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
  size?: 'sm' | 'md' | 'lg'
  icon?: Component
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
  block?: boolean
  href?: string
  download?: string | boolean
}>(), { variant: 'secondary', size: 'md', type: 'button' })

const VARIANTS = {
  primary: 'bg-accent text-white hover:bg-accent-hover active:bg-accent-active shadow-norm',
  secondary: 'bg-canvas text-ink border border-line hover:bg-hover active:bg-pressed',
  ghost: 'text-ink hover:bg-hover active:bg-pressed',
  subtle: 'bg-subtle text-ink hover:bg-muted',
  danger: 'bg-danger text-white hover:opacity-90 active:opacity-80',
}

const SIZES = {
  sm: 'h-7 px-2.5 text-sm gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-base gap-2 rounded-md',
  lg: 'h-11 px-4 text-md gap-2 rounded-md',
}
</script>

<template>
  <component
    :is="href ? 'a' : 'button'"
    :type="href ? undefined : props.type"
    :href="href"
    :download="download === true ? '' : download || undefined"
    :disabled="href ? undefined : disabled || loading"
    :aria-busy="loading || undefined"
    class="inline-flex shrink-0 select-none items-center justify-center font-semibold whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50"
    :class="[VARIANTS[variant], SIZES[size], block && 'w-full']"
  >
    <UiSpinner v-if="loading" class="size-4" />
    <component :is="icon" v-else-if="icon" class="size-4 shrink-0" aria-hidden="true" />
    <slot />
  </component>
</template>
