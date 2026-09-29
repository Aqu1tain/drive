<script setup lang="ts">
import { ChevronRight, Download } from '@lucide/vue'
import type { FolderListing, ResourceItem } from '#shared/types/api'

definePageMeta({ layout: 'public' })

const route = useRoute()
const { t } = useI18n()
const token = String(route.params.token)
const id = computed(() => String(route.params.id))
const { data, error } = await useFetch<FolderListing>(() => `/api/s/${token}/folders/${id.value}`)
useHead({ title: computed(() => data.value?.folder?.name ?? t('publicPage.folder')) })

onMounted(() => api(`/api/s/${token}/resources/${id.value}/open`, { method: 'POST' }).catch(() => {}))

const downloadAllUrl = (items: ResourceItem[]) => `/api/s/${token}/downloads?ids=${items.filter(item => item.canDownload).map(item => item.id).join(',')}`
const crumbTo = (crumbId: string | null, index: number) => index === 0 || !crumbId ? `/s/${token}` : `/s/${token}/folder/${crumbId}`
</script>

<template>
  <PublicState v-if="error || !data" :status="error?.statusCode === 403 ? 404 : error?.statusCode" />
  <div v-else class="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
    <nav :aria-label="t('publicPage.breadcrumb')" class="mb-2">
      <ol class="flex flex-wrap items-center gap-1 text-sm text-ink-weak">
        <li v-for="(crumb, index) in data.breadcrumbs.slice(0, -1)" :key="String(crumb.id)" class="flex items-center gap-1">
          <NuxtLink :to="crumbTo(crumb.id, index)" class="rounded px-1 hover:bg-hover hover:text-ink">{{ crumb.name }}</NuxtLink>
          <ChevronRight class="size-3.5" aria-hidden="true" />
        </li>
      </ol>
    </nav>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{{ data.folder?.name }}</h1>
      <UiButton v-if="data.items.some(item => item.canDownload)" :icon="Download" :href="downloadAllUrl(data.items)">{{ t('publicPage.downloadAll') }}</UiButton>
    </div>
    <PublicListing v-if="data.items.length" :items="data.items" :token="token" />
    <p v-else class="rounded-xl bg-canvas p-8 text-center text-base text-ink-weak shadow-norm">{{ t('publicPage.empty') }}</p>
  </div>
</template>
