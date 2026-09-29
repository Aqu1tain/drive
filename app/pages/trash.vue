<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { Trash2 } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

const { t } = useI18n()
useHead({ title: t('views.trash.title') })
const actions = useFileActions()
const { data, isPending } = useQuery({
  queryKey: ['list', 'trash'],
  queryFn: () => api<{ items: ResourceItem[] }>('/api/trash'),
})
</script>

<template>
  <FilesDriveView :items="data?.items ?? []" :loading="isPending" mode="owner" :label="t('views.trash.title')" :title="t('views.trash.title')" trash show-location :can-details="false">
    <template #actions>
      <UiButton v-if="data?.items.length" size="sm" variant="ghost" class="text-danger" @click="actions.emptyTrash()">{{ t('actions.confirm.emptyTrash') }}</UiButton>
    </template>
    <template #above>
      <p v-if="data?.items.length" class="mx-4 mb-2 rounded-lg bg-subtle px-4 py-2.5 text-sm text-ink-weak">
        {{ t('views.trash.notice') }}
      </p>
    </template>
    <template #empty>
      <UiEmptyState :icon="Trash2" :title="t('views.trash.empty')" :description="t('views.trash.emptyHint')" />
    </template>
  </FilesDriveView>
</template>
