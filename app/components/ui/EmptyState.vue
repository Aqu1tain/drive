<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{ icon: Component, title: string, description?: string }>()
</script>

<template>
  <div class="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center animate-fade-in">
    <div class="mb-5 flex size-16 items-center justify-center rounded-2xl bg-accent-softer text-accent-ink">
      <component :is="icon" class="size-7" stroke-width="1.6" aria-hidden="true" />
    </div>
    <h2 class="text-lg font-semibold text-ink">{{ title }}</h2>
    <p v-if="description" class="mt-1.5 text-base text-ink-weak text-pretty">{{ description }}</p>
    <div v-if="$slots.default" class="mt-6 flex flex-wrap justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
