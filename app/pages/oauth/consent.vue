<script setup lang="ts">
import { Ban, CircleAlert, Eye, FolderInput, Sparkles } from '@lucide/vue'

definePageMeta({ layout: 'auth' })
const { t } = useI18n()
useHead({ title: t('oauth.consent.pageTitle') })

/** The authorization server signed these parameters; they go back untouched with the answer. */
const oauthQuery = useRoute().fullPath.split('?')[1] ?? ''
const params = new URLSearchParams(oauthQuery)
const clientId = params.get('client_id')
const expired = !params.get('sig') || Number(params.get('exp')) * 1000 < Date.now()

const { public: config } = useRuntimeConfig()
const { data: me } = useMe()
const { data: client, error: unknownClient } = await useFetch<{ client_name?: string }>('/api/auth/oauth2/public-client', {
  query: { client_id: clientId },
  immediate: !!clientId && !expired,
})

const appName = computed(() => client.value?.client_name?.trim() || t('oauth.consent.unknownApp'))
const destination = computed(() => {
  try {
    return new URL(params.get('redirect_uri') ?? '').host
  }
  catch {
    return null
  }
})
const owner = computed(() => me.value?.user?.role === 'owner')

const busy = ref<'allow' | 'deny' | null>(null)
const failed = ref(false)

async function answer(accept: boolean) {
  busy.value = accept ? 'allow' : 'deny'
  failed.value = false
  try {
    const { url } = await api<{ url: string }>('/api/auth/oauth2/consent', { method: 'POST', body: { accept, oauth_query: oauthQuery } })
    window.location.assign(url)
  }
  catch {
    failed.value = true
    busy.value = null
  }
}
</script>

<template>
  <div v-if="expired || !clientId || unknownClient" class="text-center">
    <CircleAlert class="mx-auto mb-4 size-10 text-ink-hint" aria-hidden="true" />
    <h1 class="text-xl font-semibold text-ink">{{ t('oauth.consent.invalidTitle') }}</h1>
    <p class="mt-2 text-base text-ink-weak">{{ t('oauth.consent.invalidHint') }}</p>
  </div>

  <div v-else>
    <span class="mb-5 flex size-11 items-center justify-center rounded-xl bg-accent-softer text-accent-ink">
      <Sparkles class="size-5" aria-hidden="true" />
    </span>
    <h1 class="text-xl font-semibold text-balance break-words text-ink">{{ t('oauth.consent.heading', { app: appName, drive: config.appName }) }}</h1>
    <p v-if="me?.user" class="mt-1 text-base text-ink-weak">
      <UiTranslate message="oauth.consent.signedInAs"><template #email><strong class="font-semibold text-ink">{{ me.user.email }}</strong></template></UiTranslate>
    </p>

    <ul class="my-5 flex flex-col gap-3 rounded-lg bg-subtle p-4 text-base text-ink">
      <template v-if="owner">
        <li class="flex gap-3"><Eye class="mt-0.5 size-4 shrink-0 text-ink-weak" aria-hidden="true" />{{ t('oauth.consent.ownerRead') }}</li>
        <li class="flex gap-3"><FolderInput class="mt-0.5 size-4 shrink-0 text-ink-weak" aria-hidden="true" />{{ t('oauth.consent.ownerOrganize') }}</li>
        <li class="flex gap-3"><Ban class="mt-0.5 size-4 shrink-0 text-ink-weak" aria-hidden="true" />{{ t('oauth.consent.ownerLimits') }}</li>
      </template>
      <template v-else>
        <li class="flex gap-3"><Eye class="mt-0.5 size-4 shrink-0 text-ink-weak" aria-hidden="true" />{{ t('oauth.consent.readerRead') }}</li>
        <li class="flex gap-3"><Ban class="mt-0.5 size-4 shrink-0 text-ink-weak" aria-hidden="true" />{{ t('oauth.consent.readerLimits') }}</li>
      </template>
    </ul>

    <p class="mb-6 text-sm text-ink-weak">
      <template v-if="destination">
        <UiTranslate message="oauth.consent.returnsTo"><template #host><strong class="font-semibold text-ink">{{ destination }}</strong></template></UiTranslate>
      </template>
      {{ t('oauth.consent.revokeAnytime') }}
    </p>
    <p v-if="failed" class="mb-3 text-sm text-danger" role="alert">{{ t('oauth.consent.failed') }}</p>
    <div class="grid grid-cols-2 gap-2">
      <UiButton size="lg" block :loading="busy === 'deny'" :disabled="!!busy" @click="answer(false)">{{ t('oauth.consent.deny') }}</UiButton>
      <UiButton variant="primary" size="lg" block :loading="busy === 'allow'" :disabled="!!busy" @click="answer(true)">{{ t('oauth.consent.allow') }}</UiButton>
    </div>
  </div>
</template>
