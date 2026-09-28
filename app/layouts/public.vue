<script setup lang="ts">
const { public: config } = useRuntimeConfig()
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-subtle">
    <header class="sticky top-0 z-(--z-sticky) flex h-14 shrink-0 items-center gap-3 border-b border-line-weak bg-canvas/95 px-4 sm:px-6">
      <span class="flex items-center gap-2.5 font-semibold text-ink">
        <AppLogo class="size-7" />
        {{ config.appName }}
      </span>
      <NuxtLink to="/login" class="ml-auto rounded-md px-3 py-1.5 text-base font-medium text-ink-weak transition-colors hover:bg-hover hover:text-ink">Se connecter</NuxtLink>
    </header>
    <main class="flex min-h-0 flex-1 flex-col">
      <slot />
    </main>
  </div>
</template>
