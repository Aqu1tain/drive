<script setup lang="ts">
import { ExternalLink, ShieldCheck } from '@lucide/vue'

defineProps<{ src: string, scripts: boolean, title: string }>()
</script>

<template>
  <div class="flex size-full flex-col">
    <div class="flex items-center gap-2 border-b border-line-weak bg-canvas px-3 py-2 text-sm text-ink-weak">
      <ShieldCheck class="size-4 shrink-0 text-success" aria-hidden="true" />
      <span class="flex-1 truncate">{{ scripts ? 'Page interactive, isolée du reste de l’application' : 'Aperçu sécurisé : les scripts sont désactivés' }}</span>
      <a :href="src" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-accent-ink hover:bg-hover">
        Ouvrir <ExternalLink class="size-3.5" aria-hidden="true" />
      </a>
    </div>
    <iframe
      :src="src"
      :title="title"
      :sandbox="scripts ? 'allow-scripts allow-popups allow-forms allow-modals' : 'allow-popups allow-popups-to-escape-sandbox'"
      referrerpolicy="no-referrer"
      loading="lazy"
      class="min-h-0 flex-1 bg-white"
    />
  </div>
</template>
