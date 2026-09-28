<script setup lang="ts">
defineProps<{ src: string, alt: string }>()
defineEmits<{ error: [] }>()
const loaded = ref(false)
</script>

<template>
  <div class="relative flex size-full items-center justify-center p-4">
    <UiSkeleton v-if="!loaded" class="absolute inset-8 rounded-lg!" height="auto" />
    <img
      :src="src"
      :alt="alt"
      decoding="async"
      class="max-h-full max-w-full rounded-md object-contain shadow-raised transition-opacity duration-200"
      :class="loaded ? 'opacity-100' : 'opacity-0'"
      @load="loaded = true"
      @error="$emit('error')"
    >
  </div>
</template>
