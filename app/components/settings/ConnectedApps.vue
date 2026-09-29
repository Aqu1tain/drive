<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { ExternalLink, Sparkles, Unplug } from '@lucide/vue'
import { toast } from 'vue-sonner'

interface ConnectedApp {
  clientId: string
  name: string | null
  uri: string | null
  connectedAt: string
}

const { t, locale } = useI18n()
const { public: config } = useRuntimeConfig()
const queryClient = useQueryClient()
const { data: apps } = useQuery({
  queryKey: ['connected-apps'],
  queryFn: () => api<{ apps: ConnectedApp[] }>('/api/connected-apps').then(response => response.apps),
})

const mcpUrl = `${config.appUrl}/mcp`
const guide = computed(() => `https://github.com/Aqu1tain/drive/blob/main/docs/${locale.value === 'fr' ? 'mcp.fr.md' : 'mcp.md'}`)
const nameOf = (app: ConnectedApp) => app.name?.trim() || t('oauth.apps.unnamed')

async function revoke(app: ConnectedApp) {
  try {
    await api(`/api/connected-apps/${encodeURIComponent(app.clientId)}`, { method: 'DELETE' })
    toast(t('oauth.apps.revoked', { name: nameOf(app) }))
  }
  catch (error) {
    toast.error(errorMessage(error))
  }
  queryClient.invalidateQueries({ queryKey: ['connected-apps'] })
}
</script>

<template>
  <div>
    <ul v-if="apps?.length" class="mb-3 divide-y divide-line-weak rounded-lg border border-line-weak">
      <li v-for="app in apps" :key="app.clientId" class="flex items-center gap-3 px-3.5 py-2.5">
        <Sparkles class="size-4 text-ink-weak" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-base text-ink">{{ nameOf(app) }}</p>
          <p class="text-sm text-ink-weak">{{ t('oauth.apps.connectedOn', { date: formatLongDate(app.connectedAt) }) }}</p>
        </div>
        <UiButton size="sm" :icon="Unplug" :aria-label="t('oauth.apps.revokeLabel', { name: nameOf(app) })" @click="revoke(app)">{{ t('oauth.apps.revoke') }}</UiButton>
      </li>
    </ul>
    <p v-else-if="apps" class="mb-3 text-sm text-ink-weak">
      <UiTranslate message="oauth.apps.empty"><template #url><code class="rounded bg-subtle px-1 py-0.5 text-ink break-all">{{ mcpUrl }}</code></template></UiTranslate>
    </p>
    <a :href="guide" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-sm font-medium text-accent-ink hover:underline">
      {{ t('oauth.apps.guide') }}
      <ExternalLink class="size-3.5" aria-hidden="true" />
    </a>
  </div>
</template>
