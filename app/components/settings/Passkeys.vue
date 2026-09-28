<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Fingerprint, Trash2 } from '@lucide/vue'

interface Passkey {
  id: string
  name?: string | null
  createdAt?: string | Date | null
  deviceType?: string
}

const passkeys = ref<Passkey[] | null>(null)
const busy = ref(false)

async function load() {
  const { data } = await authClient.passkey.listUserPasskeys()
  passkeys.value = (data ?? []) as Passkey[]
}

async function add() {
  busy.value = true
  try {
    const name = `${/Mac/.test(navigator.platform) ? 'Mac' : /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : 'Appareil'} (${new Date().toLocaleDateString('fr-FR')})`
    const { error } = await authClient.passkey.addPasskey({ name })
    if (error) {
      toast.error(error.status === 401 || error.status === 403
        ? 'Reconnectez-vous puis réessayez : l’ajout d’une clé exige une connexion récente.'
        : 'Ajout annulé ou non pris en charge par cet appareil.')
      return
    }
    toast.success('Clé d’accès ajoutée')
    await load()
  }
  finally {
    busy.value = false
  }
}

async function remove(passkey: Passkey) {
  const { error } = await authClient.passkey.deletePasskey({ id: passkey.id })
  if (error) return void toast.error('Suppression impossible')
  toast('Clé d’accès supprimée')
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
          <p class="truncate text-base text-ink">{{ passkey.name || 'Clé d’accès' }}</p>
          <p v-if="passkey.createdAt" class="text-sm text-ink-weak">Ajoutée le {{ formatLongDate(passkey.createdAt) }}</p>
        </div>
        <UiIconButton :icon="Trash2" :label="`Supprimer ${passkey.name || 'cette clé'}`" size="sm" @click="remove(passkey)" />
      </li>
    </ul>
    <p v-else-if="passkeys" class="mb-3 text-sm text-ink-weak">Aucune clé d’accès. Connectez-vous d’un geste avec Touch ID, Face ID, Windows Hello ou une clé de sécurité.</p>
    <UiButton :icon="Fingerprint" :loading="busy" @click="add">Ajouter une clé d’accès</UiButton>
  </div>
</template>
