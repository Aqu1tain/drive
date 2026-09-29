<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Person } from '#shared/types/api'

const props = defineProps<{ person: Person }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const open = ref(true)
watch(open, value => !value && emit('close'))
const password = ref('')
const error = ref<string | null>(null)
const busy = ref(false)

async function submit() {
  busy.value = true
  error.value = null
  try {
    await api(`/api/people/${props.person.id}`, { method: 'PATCH', body: { password: password.value } })
    toast(t('people.passwordDialog.changed'))
    open.value = false
  }
  catch (e) {
    error.value = errorMessage(e)
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <UiDialog v-model:open="open" :title="t('people.passwordDialog.title', { name: person.name || person.email })" size="sm">
    <form id="person-password" @submit.prevent="submit">
      <UiInput v-model="password" :label="t('people.passwordDialog.password')" type="text" autocomplete="off" required autofocus :hint="t('people.passwordDialog.passwordHint')" :error="error" />
    </form>
    <template #footer>
      <UiButton variant="ghost" @click="open = false">{{ t('common.cancel') }}</UiButton>
      <UiButton type="submit" form="person-password" variant="primary" :loading="busy">{{ t('common.save') }}</UiButton>
    </template>
  </UiDialog>
</template>
