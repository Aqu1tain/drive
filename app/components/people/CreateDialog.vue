<script setup lang="ts">
import { toast } from 'vue-sonner'

const emit = defineEmits<{ close: [], created: [] }>()
const { t } = useI18n()
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
    toast(t('people.createDialog.created'))
    emit('created')
    open.value = false
  }
  catch (e) {
    error.value = errorMessage(e, t('people.createDialog.failed'))
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UiDialog v-model:open="open" :title="t('people.createDialog.title')" :description="t('people.createDialog.description')" size="sm">
    <form id="create-person" class="flex flex-col gap-4" @submit.prevent="submit">
      <UiInput v-model="name" :label="t('common.name')" autocomplete="off" required autofocus />
      <UiInput v-model="email" :label="t('people.createDialog.email')" type="email" autocomplete="off" required />
      <UiInput v-model="password" :label="t('people.createDialog.password')" autocomplete="off" required :hint="t('people.createDialog.passwordHint')" />
      <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
    </form>
    <template #footer>
      <UiButton variant="ghost" @click="open = false">{{ t('common.cancel') }}</UiButton>
      <UiButton type="submit" form="create-person" variant="primary" :loading="busy">{{ t('common.create') }}</UiButton>
    </template>
  </UiDialog>
</template>
