<script setup lang="ts">
defineProps<{ title: string, description?: string }>()
</script>

<template>
  <section class="border-b border-line-weak py-7 last:border-0 md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
    <div class="mb-4 md:mb-0">
      <h2 class="text-md font-semibold text-ink">{{ title }}</h2>
      <p v-if="description" class="mt-1 text-sm text-ink-weak text-pretty">{{ description }}</p>
    </div>
    <div class="flex flex-col gap-5">
      <slot />
    </div>
  </section>
</template>
