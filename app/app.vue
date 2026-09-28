<script setup lang="ts">
import { TooltipProvider } from 'reka-ui'
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'

const { public: config } = useRuntimeConfig()
useHead({ titleTemplate: title => title ? `${title} · ${config.appName}` : config.appName })

const toastClasses = {
  toast: 'flex w-full items-center gap-3 rounded-lg bg-inverse px-4 py-3 text-ink-inverse shadow-lifted sm:w-[380px]',
  title: 'text-base font-medium',
  description: 'text-sm opacity-80',
  actionButton: 'ml-auto shrink-0 rounded-md px-2 py-1 text-base font-semibold text-accent-soft hover:bg-white/10 dark:text-accent',
  cancelButton: 'shrink-0 rounded-md px-2 py-1 text-base opacity-80 hover:bg-white/10',
  icon: 'shrink-0',
  error: 'bg-danger! text-white!',
}
</script>

<template>
  <TooltipProvider :delay-duration="500" :skip-delay-duration="200">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </TooltipProvider>
  <ClientOnly>
    <Toaster position="bottom-center" :offset="24" :gap="8" :toast-options="{ unstyled: true, classes: toastClasses, duration: 4000 }" />
  </ClientOnly>
</template>
