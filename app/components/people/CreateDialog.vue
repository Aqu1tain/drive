<script setup lang="ts">
import { toast } from 'vue-sonner'

const emit = defineEmits<{ close: [], created: [] }>()
const open = ref(true)
watch(open, value => !value && emit('close'))

const name = ref('')
const email = ref('')
const password = ref(generatePassword())
const error = ref<string | null>(null)
const busy = ref(false)

function generatePassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint32Array(16)), n => alphabet[n % alphabet.length]).join('').replace(/(.{4})(?!$)/g, '$1-')
}

async function submit() {
  busy.value = true
  error.value = null
  try {
    await api('/api/people', { method: 'POST', body: { name: name.value, email: email.value, password: password.value } })
    await navigator.clipboard.writeText(`${email.value.trim()}\n${password.value}`).catch(() => {})
    toast('Compte créé, identifiants copiés')
    emit('created')
    open.value = false
  }
  catch (e) {
    error.value = errorMessage(e, 'Impossible de créer le compte')
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UiDialog v-model:open="open" title="Créer un compte lecteur" description="Pour partager ensuite avec cette personne. Transmettez-lui ses identifiants par un canal sûr." size="sm">
    <form id="create-person" class="flex flex-col gap-4" @submit.prevent="submit">
      <UiInput v-model="name" label="Nom" autocomplete="off" required autofocus />
      <UiInput v-model="email" label="Adresse email" type="email" autocomplete="off" required />
      <UiInput v-model="password" label="Mot de passe provisoire" autocomplete="off" required hint="Généré aléatoirement. La personne pourra le changer." />
      <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
    </form>
    <template #footer>
      <UiButton variant="ghost" @click="open = false">Annuler</UiButton>
      <UiButton type="submit" form="create-person" variant="primary" :loading="busy">Créer</UiButton>
    </template>
  </UiDialog>
</template>
