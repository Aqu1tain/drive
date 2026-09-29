<script setup lang="ts">
import { renderSVG } from 'uqr'
import { toast } from 'vue-sonner'
import { ShieldCheck } from '@lucide/vue'

const props = defineProps<{ enabled: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()

const step = ref<'idle' | 'password' | 'scan' | 'disable'>('idle')
const password = ref('')
const code = ref('')
const setup = ref<{ uri: string, backupCodes: string[] } | null>(null)
const error = ref<string | null>(null)
const busy = ref(false)
const qr = computed(() => setup.value ? renderSVG(setup.value.uri, { border: 1 }) : '')
const secret = computed(() => setup.value ? new URL(setup.value.uri).searchParams.get('secret') : '')

async function start() {
  busy.value = true
  error.value = null
  try {
    const { data, error: failure } = await authClient.twoFactor.enable({ password: password.value })
    if (failure || !data) return void (error.value = authErrorMessage(failure, t('auth.errors.invalidPassword')))
    const result = data as { totpURI?: string, backupCodes?: string[] }
    setup.value = { uri: result.totpURI!, backupCodes: result.backupCodes ?? [] }
    step.value = 'scan'
  }
  finally {
    busy.value = false
  }
}

async function confirm() {
  busy.value = true
  error.value = null
  try {
    const { error: failure } = await authClient.twoFactor.verifyTotp({ code: code.value.trim() })
    if (failure) return void (error.value = authErrorMessage(failure))
    toast.success(t('settings.twoFactor.enabled'))
    reset()
    emit('changed')
  }
  finally {
    busy.value = false
  }
}

async function disable() {
  busy.value = true
  error.value = null
  try {
    const { error: failure } = await authClient.twoFactor.disable({ password: password.value })
    if (failure) return void (error.value = authErrorMessage(failure, t('auth.errors.invalidPassword')))
    toast(t('settings.twoFactor.disabled'))
    reset()
    emit('changed')
  }
  finally {
    busy.value = false
  }
}

function reset() {
  step.value = 'idle'
  password.value = ''
  code.value = ''
  setup.value = null
  error.value = null
}
</script>

<template>
  <div>
    <div v-if="step === 'idle'" class="flex flex-wrap items-center gap-3">
      <span v-if="props.enabled" class="inline-flex items-center gap-1.5 text-base text-success"><ShieldCheck class="size-4" aria-hidden="true" /> {{ t('settings.twoFactor.on') }}</span>
      <span v-else class="text-base text-ink-weak">{{ t('settings.twoFactor.off') }}</span>
      <UiButton v-if="props.enabled" variant="ghost" @click="step = 'disable'">{{ t('settings.twoFactor.turnOff') }}</UiButton>
      <UiButton v-else @click="step = 'password'">{{ t('settings.twoFactor.turnOn') }}</UiButton>
    </div>

    <form v-else-if="step === 'password' || step === 'disable'" class="flex max-w-sm flex-col gap-3" @submit.prevent="step === 'password' ? start() : disable()">
      <UiInput v-model="password" :label="t('settings.twoFactor.confirmPassword')" type="password" autocomplete="current-password" required autofocus :error="error" />
      <div class="flex gap-2">
        <UiButton type="submit" variant="primary" :loading="busy">{{ t(step === 'password' ? 'common.continue' : 'settings.twoFactor.turnOff') }}</UiButton>
        <UiButton variant="ghost" @click="reset">{{ t('common.cancel') }}</UiButton>
      </div>
    </form>

    <div v-else-if="step === 'scan' && setup" class="flex flex-col gap-4">
      <p class="text-base text-ink-weak">{{ t('settings.twoFactor.scan') }}</p>
      <div class="flex flex-wrap items-start gap-5">
        <!-- uqr produces a self-contained SVG from the TOTP URI we just received; no user-controlled markup -->
        <div class="size-44 rounded-lg bg-white p-2 [&_svg]:size-full" v-html="qr" />
        <div class="min-w-0 flex-1">
          <p class="text-sm text-ink-weak">{{ t('settings.twoFactor.orKey') }}</p>
          <p class="mb-3 font-mono text-sm break-all text-ink select-all">{{ secret }}</p>
          <p class="text-sm text-ink-weak">{{ t('settings.twoFactor.backupCodes') }}</p>
          <p class="font-mono text-sm leading-relaxed text-ink select-all">{{ setup.backupCodes.join('  ') }}</p>
        </div>
      </div>
      <form class="flex max-w-sm items-end gap-2" @submit.prevent="confirm">
        <UiInput v-model="code" :label="t('settings.twoFactor.code')" inputmode="numeric" autocomplete="one-time-code" required class="flex-1" :error="error" />
        <UiButton type="submit" variant="primary" :loading="busy">{{ t('settings.twoFactor.verify') }}</UiButton>
      </form>
    </div>
  </div>
</template>
