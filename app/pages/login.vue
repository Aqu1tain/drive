<script setup lang="ts">
import { Fingerprint, Mail } from '@lucide/vue'

definePageMeta({ layout: 'auth' })
const { t } = useI18n()
useHead({ title: t('auth.login.title') })

const route = useRoute()
const { $queryClient } = useNuxtApp()
const { data: me } = useMe()

type Step = 'password' | 'code-request' | 'code' | 'totp'
const step = ref<Step>('password')
const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const password = ref('')
const code = ref('')
const trustDevice = ref(true)
const error = ref<string | null>(null)
const busy = ref(false)

async function done() {
  await $queryClient.invalidateQueries({ queryKey: ['me'] })
  const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/'
  await navigateTo(redirect, { replace: true })
}

async function attempt(task: () => Promise<{ error?: unknown, data?: unknown } | void>) {
  busy.value = true
  error.value = null
  try {
    return await task()
  }
  finally {
    busy.value = false
  }
}

async function signInWithPassword() {
  await attempt(async () => {
    const { data, error: failure } = await authClient.signIn.email({ email: email.value.trim(), password: password.value })
    if (failure) return void (error.value = authErrorMessage(failure))
    if ((data as { twoFactorRedirect?: boolean })?.twoFactorRedirect) {
      step.value = 'totp'
      return
    }
    await done()
  })
}

async function signInWithPasskey() {
  await attempt(async () => {
    const result = await authClient.signIn.passkey()
    if (result?.error) return void (error.value = t('auth.login.passkeyFailed'))
    await done()
  })
}

async function requestCode() {
  await attempt(async () => {
    const { error: failure } = await authClient.emailOtp.sendVerificationOtp({ email: email.value.trim(), type: 'sign-in' })
    if (failure) return void (error.value = authErrorMessage(failure, t('auth.login.codeFailed')))
    step.value = 'code'
  })
}

async function signInWithCode() {
  await attempt(async () => {
    const { error: failure } = await authClient.signIn.emailOtp({ email: email.value.trim(), otp: code.value.trim() })
    if (failure) return void (error.value = authErrorMessage(failure))
    await done()
  })
}

async function verifyTotp() {
  await attempt(async () => {
    const { error: failure } = await authClient.twoFactor.verifyTotp({ code: code.value.trim(), trustDevice: trustDevice.value })
    if (failure) return void (error.value = authErrorMessage(failure))
    await done()
  })
}

watch(step, () => {
  code.value = ''
  error.value = null
})
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold text-ink">{{ t(step === 'totp' ? 'auth.login.twoFactor' : 'auth.login.title') }}</h1>
    <p class="mt-1 mb-6 text-base text-ink-weak">
      <template v-if="step === 'totp'">{{ t('auth.login.totpIntro') }}</template>
      <UiTranslate v-else-if="step === 'code'" message="auth.login.codeSent">
        <template #email><strong class="font-semibold text-ink">{{ email }}</strong></template>
      </UiTranslate>
      <template v-else>{{ t('auth.login.intro') }}</template>
    </p>

    <form v-if="step === 'password'" class="flex flex-col gap-4" @submit.prevent="signInWithPassword">
      <UiInput v-model="email" :label="t('auth.login.email')" type="email" autocomplete="username webauthn" inputmode="email" required autofocus />
      <UiInput v-model="password" :label="t('auth.login.password')" type="password" autocomplete="current-password" required />
      <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
      <UiButton type="submit" variant="primary" size="lg" block :loading="busy">{{ t('auth.login.submit') }}</UiButton>
    </form>

    <form v-else-if="step === 'code-request'" class="flex flex-col gap-4" @submit.prevent="requestCode">
      <UiInput v-model="email" :label="t('auth.login.email')" type="email" autocomplete="email" inputmode="email" required autofocus />
      <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
      <UiButton type="submit" variant="primary" size="lg" block :loading="busy">{{ t('auth.login.requestCode') }}</UiButton>
    </form>

    <form v-else class="flex flex-col gap-4" @submit.prevent="step === 'totp' ? verifyTotp() : signInWithCode()">
      <UiInput v-model="code" :label="t('auth.login.code')" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" required autofocus />
      <label v-if="step === 'totp'" class="flex items-center gap-2.5 text-base text-ink">
        <input v-model="trustDevice" type="checkbox" class="size-4 accent-(--accent)">
        {{ t('auth.login.trustDevice') }}
      </label>
      <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
      <UiButton type="submit" variant="primary" size="lg" block :loading="busy">{{ t('auth.login.verify') }}</UiButton>
    </form>

    <div v-if="step !== 'totp'" class="mt-6 flex flex-col gap-2 border-t border-line-weak pt-6">
      <UiButton v-if="step === 'password'" block :icon="Fingerprint" :disabled="busy" @click="signInWithPasskey">{{ t('auth.login.passkey') }}</UiButton>
      <UiButton v-if="step === 'password' && me?.emailEnabled" block variant="ghost" :icon="Mail" @click="step = 'code-request'">{{ t('auth.login.emailCode') }}</UiButton>
      <UiButton v-if="step !== 'password'" block variant="ghost" @click="step = 'password'">{{ t('auth.login.usePassword') }}</UiButton>
    </div>
  </div>
</template>
