<script setup lang="ts">
import { CircleCheck, CircleAlert } from '@lucide/vue'
import type { FileKind } from '#shared/utils/search'

definePageMeta({ layout: 'auth' })

interface InvitationInfo {
  email: string
  name: string | null
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  sharedBy: string
  accountExists: boolean
  items: Array<{ name: string, type: 'file' | 'folder', kind: FileKind }>
}

const route = useRoute()
const { t } = useI18n()
const token = String(route.params.token)
const { data: invitation, error: loadError } = await useFetch<InvitationInfo>(`/api/invite/${token}`)
useHead({ title: computed(() => invitation.value ? t('invite.titleFrom', { name: invitation.value.sharedBy }) : t('invite.title')) })

const name = ref(invitation.value?.name ?? '')
const password = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

async function accept() {
  busy.value = true
  error.value = null
  try {
    const result = await api<{ email: string, existing: boolean }>(`/api/invite/${token}/accept`, { method: 'POST', body: { name: name.value, password: password.value } })
    if (result.existing) return navigateTo({ path: '/login', query: { email: result.email, redirect: '/shared-with-me' } })
    const { error: failure } = await authClient.signIn.email({ email: result.email, password: password.value })
    if (failure) return navigateTo({ path: '/login', query: { email: result.email } })
    await navigateTo('/shared-with-me', { replace: true })
  }
  catch (e) {
    error.value = errorMessage(e, t('invite.failed'))
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="loadError || !invitation" class="text-center">
    <CircleAlert class="mx-auto mb-4 size-10 text-ink-hint" aria-hidden="true" />
    <h1 class="text-xl font-semibold text-ink">{{ t('invite.notFound') }}</h1>
    <p class="mt-2 text-base text-ink-weak">{{ t('invite.notFoundText') }}</p>
  </div>

  <div v-else-if="invitation.status !== 'pending'" class="text-center">
    <component :is="invitation.status === 'accepted' ? CircleCheck : CircleAlert" class="mx-auto mb-4 size-10" :class="invitation.status === 'accepted' ? 'text-success' : 'text-ink-hint'" aria-hidden="true" />
    <h1 class="text-xl font-semibold text-ink">{{ t(invitation.status === 'accepted' ? 'invite.accepted' : 'invite.expired') }}</h1>
    <p class="mt-2 mb-6 text-base text-ink-weak">
      {{ invitation.status === 'accepted' ? t('invite.acceptedText') : t('invite.expiredText', { name: invitation.sharedBy }) }}
    </p>
    <UiButton v-if="invitation.status === 'accepted'" variant="primary" block @click="navigateTo({ path: '/login', query: { email: invitation.email } })">{{ t('invite.signIn') }}</UiButton>
  </div>

  <div v-else>
    <h1 class="text-xl font-semibold text-balance text-ink">{{ t('invite.sharedItems', { name: invitation.sharedBy, count: invitation.items.length }) }}</h1>
    <ul class="my-5 flex flex-col gap-1 rounded-lg bg-subtle p-2">
      <li v-for="item in invitation.items.slice(0, 5)" :key="item.name" class="flex items-center gap-3 rounded-md px-2 py-1.5">
        <FilesFileIcon :kind="item.kind" />
        <span class="truncate text-base text-ink">{{ item.name }}</span>
      </li>
      <li v-if="invitation.items.length > 5" class="px-2 py-1 text-sm text-ink-weak">{{ t('invite.more', { count: invitation.items.length - 5 }) }}</li>
    </ul>

    <template v-if="invitation.accountExists">
      <p class="mb-5 text-base text-ink-weak">
        <UiTranslate message="invite.accountExists">
          <template #email><strong class="font-semibold text-ink">{{ invitation.email }}</strong></template>
        </UiTranslate>
      </p>
      <p v-if="error" class="mb-3 text-sm text-danger" role="alert">{{ error }}</p>
      <UiButton variant="primary" size="lg" block :loading="busy" @click="accept">{{ t('invite.acceptAndSignIn') }}</UiButton>
    </template>
    <form v-else class="flex flex-col gap-4" @submit.prevent="accept">
      <p class="text-base text-ink-weak">
        <UiTranslate message="invite.createAccess">
          <template #email><strong class="font-semibold text-ink">{{ invitation.email }}</strong></template>
        </UiTranslate>
      </p>
      <UiInput v-model="name" :label="t('invite.name')" autocomplete="name" required />
      <UiInput v-model="password" :label="t('invite.password')" type="password" autocomplete="new-password" required :hint="t('invite.passwordHint')" />
      <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
      <UiButton type="submit" variant="primary" size="lg" block :loading="busy">{{ t('invite.submit') }}</UiButton>
    </form>
  </div>
</template>
