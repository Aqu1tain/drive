<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <ViewsFolder :folder-id="String(route.params.id)" mode="owner" />
</template>
