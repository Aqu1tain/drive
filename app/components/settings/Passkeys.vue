<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Fingerprint, Trash2 } from '@lucide/vue'

interface Passkey {
  id: string
  name?: string | null
  createdAt?: string | Date | null
  deviceType?: string
}

const { t, locale } = useI18n()
const passkeys = ref<Passkey[] | null>(null)
const busy = ref(false)

async function load() {
  const { data } = await authClient.passkey.listUserPasskeys()
  passkeys.value = (data ?? []) as Passkey[]
}

async function add() {
  busy.value = true
  try {
    const name = `${/Mac/.test(navigator.platform) ? 'Mac' : /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : t('settings.passkeys.device')} (${new Date().toLocaleDateString(locale.value)})`
    const { error } = await authClient.passkey.addPasskey({ name })
    if (error) {
      toast.error(t(error.status === 401 || error.status === 403 ? 'settings.passkeys.signInAgain' : 'settings.passkeys.cancelled'))
      return
    }
    toast.success(t('settings.passkeys.added'))
    await load()
  }
  finally {
    busy.value = false
  }
}

async function remove(passkey: Passkey) {
  const { error } = await authClient.passkey.deletePasskey({ id: passkey.id })
  if (error) return void toast.error(t('settings.passkeys.deleteFailed'))
  toast(t('settings.passkeys.deleted'))
  await load()
}

onMounted(load)
</script>

<template>
  <div>
    <ul v-if="passkeys?.length" class="mb-3 divide-y divide-line-weak rounded-lg border border-line-weak">
      <li v-for="passkey in passkeys" :key="passkey.id" class="flex items-center gap-3 px-3.5 py-2.5">
        <Fingerprint class="size-4 text-ink-weak" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-base text-ink">{{ passkey.name || t('settings.passkeys.name') }}</p>
          <p v-if="passkey.createdAt" class="text-sm text-ink-weak">{{ t('settings.passkeys.addedOn', { date: formatLongDate(passkey.createdAt) }) }}</p>
        </div>
        <UiIconButton :icon="Trash2" :label="passkey.name ? t('settings.passkeys.delete', { name: passkey.name }) : t('settings.passkeys.deleteUnnamed')" size="sm" @click="remove(passkey)" />
      </li>
    </ul>
    <p v-else-if="passkeys" class="mb-3 text-sm text-ink-weak">{{ t('settings.passkeys.empty') }}</p>
    <UiButton :icon="Fingerprint" :loading="busy" @click="add">{{ t('settings.passkeys.add') }}</UiButton>
  </div>
</template>
