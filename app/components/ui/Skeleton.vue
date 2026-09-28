<script setup lang="ts">
defineProps<{ width?: string, height?: string }>()
</script>

<template>
  <span class="skeleton block" :style="{ width: width ?? '100%', height: height ?? '0.75rem' }" aria-hidden="true" />
</template>
