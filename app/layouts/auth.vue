<script setup lang="ts">
const { public: config } = useRuntimeConfig()
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-subtle">
    <header class="flex h-16 items-center px-6">
      <NuxtLink to="/" class="flex items-center gap-2.5 font-semibold text-ink">
        <AppLogo class="size-7" />
        {{ config.appName }}
      </NuxtLink>
    </header>
    <main class="flex flex-1 items-start justify-center px-4 pt-[8vh] pb-16">
      <div class="w-full max-w-[400px] rounded-xl bg-canvas p-7 shadow-raised sm:p-8">
        <slot />
      </div>
    </main>
    <ClientOnly><AppConfirmDialog /></ClientOnly>
  </div>
</template>
