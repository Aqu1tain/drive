<script setup lang="ts">
const { data: me } = useMe()
const isOwner = computed(() => me.value?.user?.role === 'owner')
const drawerOpen = ref(false)
const preferences = usePreferences()
const route = useRoute()
watch(() => route.fullPath, () => (drawerOpen.value = false))
useShortcuts()
</script>

<template>
  <div class="flex h-dvh overflow-hidden bg-nav">
    <AppSidebar class="max-md:hidden" :owner="isOwner" :collapsed="preferences.sidebarCollapsed" />

    <Transition enter-from-class="opacity-0" leave-to-class="opacity-0" enter-active-class="transition-opacity duration-200" leave-active-class="transition-opacity duration-200">
      <div v-if="drawerOpen" class="fixed inset-0 z-(--z-drawer) bg-backdrop md:hidden" @click="drawerOpen = false" />
    </Transition>
    <Transition enter-from-class="-translate-x-full" leave-to-class="-translate-x-full" enter-active-class="transition-transform duration-250 ease-out-quint" leave-active-class="transition-transform duration-200">
      <AppSidebar v-if="drawerOpen" :owner="isOwner" class="fixed inset-y-0 left-0 z-(--z-drawer) w-[272px] shadow-lifted md:hidden" @navigate="drawerOpen = false" />
    </Transition>

    <div class="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas md:my-2 md:mr-2 md:rounded-xl md:shadow-norm">
      <AppHeader :owner="isOwner" @menu="drawerOpen = true" @toggle-sidebar="preferences.sidebarCollapsed = !preferences.sidebarCollapsed" />
      <main class="flex min-h-0 flex-1">
        <slot />
      </main>
    </div>

    <ClientOnly>
      <AppDialogs v-if="isOwner" />
      <AppConfirmDialog />
      <AppShortcutsDialog :owner="isOwner" />
      <AppCommandPalette :owner="isOwner" />
      <UploadsQueue v-if="isOwner" />
      <AppDropZone :owner="isOwner" />
    </ClientOnly>
  </div>
</template>
