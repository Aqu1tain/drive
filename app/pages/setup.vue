<script setup lang="ts">
definePageMeta({ layout: 'auth' })
const { t } = useI18n()
useHead({ title: t('auth.setup.title') })

const { data: setup } = await useFetch<{ needed: boolean, tokenRequired: boolean }>('/api/setup')
if (setup.value && !setup.value.needed) await navigateTo('/login', { replace: true })

const name = ref('')
const email = ref('')
const password = ref('')
const token = ref(typeof useRoute().query.token === 'string' ? String(useRoute().query.token) : '')
const error = ref<string | null>(null)
const busy = ref(false)

async function submit() {
  busy.value = true
  error.value = null
  try {
    await api('/api/setup', { method: 'POST', body: { name: name.value, email: email.value, password: password.value, token: token.value || undefined } })
    const { error: failure } = await authClient.signIn.email({ email: email.value.trim(), password: password.value })
    if (failure) throw failure
    useNuxtApp().$queryClient.invalidateQueries({ queryKey: ['me'] })
    await navigateTo('/home', { replace: true })
  }
  catch (e) {
    error.value = errorMessage(e, t('auth.setup.failed'))
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold text-ink">{{ t('auth.setup.heading') }}</h1>
    <p class="mt-1 mb-6 text-base text-ink-weak">{{ t('auth.setup.intro') }}</p>
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <UiInput v-model="name" :label="t('auth.setup.name')" autocomplete="name" required autofocus :hint="t('auth.setup.nameHint')" />
      <UiInput v-model="email" :label="t('auth.setup.email')" type="email" autocomplete="email" inputmode="email" required />
      <UiInput v-model="password" :label="t('auth.setup.password')" type="password" autocomplete="new-password" required :hint="t('auth.setup.passwordHint')" />
      <UiInput v-if="setup?.tokenRequired" v-model="token" :label="t('auth.setup.token')" required :hint="t('auth.setup.tokenHint')" />
      <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
      <UiButton type="submit" variant="primary" size="lg" block :loading="busy">{{ t('auth.setup.submit') }}</UiButton>
    </form>
  </div>
</template>
