<script setup lang="ts">
definePageMeta({ layout: 'auth' })
useHead({ title: 'Bienvenue' })

const { data: setup } = await useFetch<{ needed: boolean, tokenRequired: boolean }>('/api/setup')
if (setup.value && !setup.value.needed) await navigateTo('/login', { replace: true })

const name = ref('')
const email = ref('')
const password = ref('')
const token = ref('')
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
    error.value = errorMessage(e, 'L’installation a échoué')
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold text-ink">Créez votre espace</h1>
    <p class="mt-1 mb-6 text-base text-ink-weak">Vous serez le seul à pouvoir y déposer, organiser et partager des documents.</p>
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <UiInput v-model="name" label="Votre nom" autocomplete="name" required autofocus hint="Affiché aux personnes avec qui vous partagez." />
      <UiInput v-model="email" label="Adresse email" type="email" autocomplete="email" inputmode="email" required />
      <UiInput v-model="password" label="Mot de passe" type="password" autocomplete="new-password" required hint="Au moins 10 caractères. Vous pourrez ajouter une clé d’accès ensuite." />
      <UiInput v-if="setup?.tokenRequired" v-model="token" label="Jeton d’installation" required hint="Défini par NUXT_SETUP_TOKEN sur le serveur." />
      <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
      <UiButton type="submit" variant="primary" size="lg" block :loading="busy">Créer mon espace</UiButton>
    </form>
  </div>
</template>
