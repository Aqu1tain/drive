<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { ArrowRight, FolderPlus, Sparkles, Upload } from '@lucide/vue'
import type { ActivityEvent, ResourceItem } from '#shared/types/api'

const { t } = useI18n()
useHead({ title: t('home.title') })
const { data: me } = useMe()
const dialogs = useDialogs()
const { data, isPending } = useQuery({
  queryKey: ['list', 'home'],
  queryFn: () => api<{ folders: ResourceItem[], files: ResourceItem[], activity: ActivityEvent[] }>('/api/home'),
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  const first = me.value?.user?.name?.split(' ')[0] ?? ''
  return `${t(hour >= 18 || hour < 5 ? 'home.evening' : 'home.hello')}${first ? `, ${first}` : ''}`
})
const empty = computed(() => !isPending.value && !data.value?.folders.length && !data.value?.files.length)
const upload = () => document.dispatchEvent(new CustomEvent('drive:upload'))
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-8">
      <h1 class="mb-8 text-2xl font-semibold tracking-tight text-ink">{{ greeting }}</h1>

      <UiEmptyState v-if="empty" :icon="Sparkles" :title="t('home.ready')" :description="t('home.readyHint')">
        <UiButton variant="primary" :icon="Upload" @click="upload">{{ t('files.upload') }}</UiButton>
        <UiButton :icon="FolderPlus" @click="dialogs.newFolder(null)">{{ t('files.newFolder') }}</UiButton>
      </UiEmptyState>

      <template v-else>
        <section class="mb-10" aria-labelledby="home-folders">
          <div class="mb-3 flex items-baseline justify-between">
            <h2 id="home-folders" class="text-md font-semibold text-ink">{{ t('home.recentFolders') }}</h2>
            <NuxtLink to="/drive" class="text-sm text-accent-ink hover:underline">{{ t('common.myDrive') }}</NuxtLink>
          </div>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <template v-if="isPending">
              <UiSkeleton v-for="n in 4" :key="n" height="4.25rem" class="rounded-lg!" />
            </template>
            <NuxtLink
              v-for="folder in data?.folders"
              :key="folder.id"
              :to="`/drive/folder/${folder.id}`"
              class="group flex min-w-0 items-center gap-3 rounded-lg border border-line-weak bg-canvas p-3.5 transition-colors hover:border-line hover:bg-hover"
            >
              <FilesFileIcon kind="folder" size="lg" class="shrink-0" />
              <div class="min-w-0">
                <p class="truncate text-base font-medium text-ink">{{ folder.name }}</p>
                <p class="truncate text-sm text-ink-weak">{{ folder.location }}</p>
              </div>
            </NuxtLink>
          </div>
        </section>

        <div class="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-labelledby="home-files">
            <div class="mb-3 flex items-baseline justify-between">
              <h2 id="home-files" class="text-md font-semibold text-ink">{{ t('home.recentFiles') }}</h2>
              <NuxtLink to="/recent" class="text-sm text-accent-ink hover:underline">{{ t('home.seeAll') }}</NuxtLink>
            </div>
            <ul class="flex flex-col">
              <template v-if="isPending">
                <li v-for="n in 6" :key="n" class="flex h-14 items-center gap-3"><UiSkeleton width="2rem" height="2rem" /><UiSkeleton width="50%" /></li>
              </template>
              <li v-for="file in data?.files" :key="file.id">
                <NuxtLink :to="`/open/${file.id}`" class="-mx-2 flex h-14 items-center gap-3 rounded-md px-2 transition-colors hover:bg-hover">
                  <span class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-subtle">
                    <img v-if="file.thumbnailUrl" :src="file.thumbnailUrl" alt="" loading="lazy" class="size-full object-cover" :class="{ 'object-top': file.kind === 'pdf' || file.kind === 'ebook' }">
                    <FilesFileIcon v-else :kind="file.kind" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-base text-ink">{{ file.name }}</p>
                    <p class="truncate text-sm text-ink-weak">{{ file.location }}</p>
                  </div>
                  <FilesAccessCell :access="file.access" compact class="max-sm:hidden" />
                  <span class="w-20 shrink-0 text-right text-sm text-ink-weak tabular">{{ formatShortDate(file.openedAt && file.openedAt > file.updatedAt ? file.openedAt : file.updatedAt) }}</span>
                </NuxtLink>
              </li>
            </ul>
          </section>

          <section aria-labelledby="home-activity">
            <div class="mb-3 flex items-baseline justify-between">
              <h2 id="home-activity" class="text-md font-semibold text-ink">{{ t('home.viewedByOthers') }}</h2>
              <NuxtLink to="/activity" class="inline-flex items-center gap-1 text-sm text-accent-ink hover:underline">{{ t('activity.title') }} <ArrowRight class="size-3.5" aria-hidden="true" /></NuxtLink>
            </div>
            <ActivityList v-if="data?.activity.length" :events="data.activity" dense />
            <p v-else-if="!isPending" class="rounded-lg bg-subtle p-4 text-sm text-ink-weak">{{ t('home.noViews') }}</p>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>
