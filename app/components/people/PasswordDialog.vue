<script setup lang="ts">
import { toast } from 'vue-sonner'
import type { Person } from '#shared/types/api'

const props = defineProps<{ person: Person }>()
const emit = defineEmits<{ close: [] }>()
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
    toast('Mot de passe modifié. Ses sessions ont été fermées.')
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
  <UiDialog v-model:open="open" :title="`Mot de passe de ${person.name || person.email}`" size="sm">
    <form id="person-password" @submit.prevent="submit">
      <UiInput v-model="password" label="Nouveau mot de passe" type="text" autocomplete="off" required autofocus hint="Au moins 10 caractères." :error="error" />
    </form>
    <template #footer>
      <UiButton variant="ghost" @click="open = false">Annuler</UiButton>
      <UiButton type="submit" form="person-password" variant="primary" :loading="busy">Enregistrer</UiButton>
    </template>
  </UiDialog>
</template>
