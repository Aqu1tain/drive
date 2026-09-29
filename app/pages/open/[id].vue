<script setup lang="ts">
import type { ResourceDetails } from '#shared/types/api'

/** Stable address of any resource: resolves where it lives for the current person, then shows it there. */
const route = useRoute()
const { data: me } = useMe()
const failed = ref<string | null>(null)
const { t } = useI18n()

onMounted(async () => {
  try {
    const { item, path } = await api<ResourceDetails>(`/api/resources/${route.params.id}`)
    const owner = me.value?.user?.role === 'owner'
    const base = owner ? '/drive' : '/shared-with-me'
    const folderPath = (id: string | null) => id ? `${base}/folder/${id}` : base
    if (item.type === 'folder') return navigateTo(folderPath(item.id), { replace: true })
    const parent = path.at(-1)?.id ?? null
    const readableParent = owner || path.length > 1 ? parent : null
    return navigateTo({ path: folderPath(readableParent), query: { preview: item.id, full: '1' } }, { replace: true })
  }
  catch (error) {
    failed.value = t(errorStatus(error) === 403 ? 'views.open.denied' : 'views.open.missing')
  }
})
</script>

<template>
  <div class="flex flex-1 items-center justify-center">
    <div v-if="failed" class="text-center">
      <p class="mb-4 text-base text-ink-weak">{{ failed }}</p>
      <UiButton variant="primary" @click="navigateTo('/')">{{ t('views.open.home') }}</UiButton>
    </div>
    <UiSpinner v-else class="size-6 text-ink-hint" />
  </div>
</template>
