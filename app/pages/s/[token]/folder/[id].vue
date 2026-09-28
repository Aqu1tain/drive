<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import type { FolderListing } from '#shared/types/api'

definePageMeta({ layout: 'public' })

const route = useRoute()
const token = String(route.params.token)
const id = computed(() => String(route.params.id))
const { data, error } = await useFetch<FolderListing>(() => `/api/s/${token}/folders/${id.value}`)
useHead({ title: computed(() => data.value?.folder?.name ?? 'Dossier') })

onMounted(() => api(`/api/s/${token}/resources/${id.value}/open`, { method: 'POST' }).catch(() => {}))

const crumbTo = (crumbId: string | null, index: number) => index === 0 || !crumbId ? `/s/${token}` : `/s/${token}/folder/${crumbId}`
</script>

<template>
  <PublicState v-if="error || !data" :status="error?.statusCode === 403 ? 404 : error?.statusCode" />
  <div v-else class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
    <nav aria-label="Fil d’Ariane" class="mb-2">
      <ol class="flex flex-wrap items-center gap-1 text-sm text-ink-weak">
        <li v-for="(crumb, index) in data.breadcrumbs.slice(0, -1)" :key="String(crumb.id)" class="flex items-center gap-1">
          <NuxtLink :to="crumbTo(crumb.id, index)" class="rounded px-1 hover:bg-hover hover:text-ink">{{ crumb.name }}</NuxtLink>
          <ChevronRight class="size-3.5" aria-hidden="true" />
        </li>
      </ol>
    </nav>
    <h1 class="mb-6 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{{ data.folder?.name }}</h1>
    <PublicListing v-if="data.items.length" :items="data.items" :token="token" />
    <p v-else class="rounded-xl bg-canvas p-8 text-center text-base text-ink-weak shadow-norm">Ce dossier est vide.</p>
  </div>
</template>
