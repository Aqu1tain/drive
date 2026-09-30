<script setup lang="ts">
import { toast } from 'vue-sonner'

const emit = defineEmits<{ close: [], created: [] }>()
const { t } = useI18n()
const open = ref(true)
watch(open, value => !value && emit('close'))

const organization = useOrganization()
const ROLES = ['reader', 'member', 'owner'] as const
const role = ref<typeof ROLES[number]>('reader')
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
    await api('/api/people', { method: 'POST', body: { name: name.value, email: email.value, password: password.value, role: role.value } })
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
  <UiDialog v-model:open="open" :title="t(organization?.active ? 'people.createDialog.titleAny' : 'people.createDialog.title')" :description="t('people.createDialog.description')" size="sm">
    <form id="create-person" class="flex flex-col gap-4" @submit.prevent="submit">
      <UiInput v-model="name" :label="t('common.name')" autocomplete="off" required autofocus />
      <UiInput v-model="email" :label="t('people.createDialog.email')" type="email" autocomplete="off" required />
      <UiInput v-model="password" :label="t('people.createDialog.password')" autocomplete="off" required :hint="t('people.createDialog.passwordHint')" />
      <div v-if="organization?.active" class="flex flex-col gap-1.5">
        <label for="person-role" class="text-base text-ink">{{ t('people.role') }}</label>
        <select id="person-role" v-model="role" class="h-10 rounded-md border border-field bg-canvas px-2.5 text-base text-ink focus:border-accent focus:outline-none focus:ring-3 focus:ring-focus-ring">
          <option v-for="value in ROLES" :key="value" :value="value">{{ t(`people.roles.${value}`) }}</option>
        </select>
        <p class="text-sm text-ink-weak">{{ t(`people.roleHints.${role}`) }} {{ role === 'reader' ? '' : t('people.seats', { used: organization.used, seats: organization.seats }) }}</p>
      </div>
      <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
    </form>
    <template #footer>
      <UiButton variant="ghost" @click="open = false">{{ t('common.cancel') }}</UiButton>
      <UiButton type="submit" form="create-person" variant="primary" :loading="busy">{{ t('common.create') }}</UiButton>
    </template>
  </UiDialog>
</template>
