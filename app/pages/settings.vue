<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import { LayoutGrid, List, Monitor, Moon, Rows3, Rows4, Sun } from '@lucide/vue'

useHead({ title: 'Paramètres' })
const { data: me, refetch } = useMe()
const isOwner = computed(() => me.value?.user?.role === 'owner')
const preferences = usePreferences()
const colorMode = useColorMode()

const { data: settings } = useQuery({
  queryKey: ['settings'],
  queryFn: () => api<{ retentionDays: number, ipMode: 'hash' | 'none', emailEnabled: boolean, usercontentUrl: string, quota: number, uploadMax: number, storageDriver: string }>('/api/settings'),
  enabled: isOwner,
})

const name = ref('')
watch(() => me.value?.user?.name, value => (name.value = value ?? ''), { immediate: true })
const savingName = ref(false)

async function saveName() {
  savingName.value = true
  const { error } = await authClient.updateUser({ name: name.value.trim() })
  savingName.value = false
  if (error) return void toast.error('Impossible de mettre à jour le nom')
  toast('Nom mis à jour')
  refetch()
}

const currentPassword = ref('')
const newPassword = ref('')
const passwordError = ref<string | null>(null)
const savingPassword = ref(false)

async function changePassword() {
  savingPassword.value = true
  passwordError.value = null
  const { error } = await authClient.changePassword({ currentPassword: currentPassword.value, newPassword: newPassword.value, revokeOtherSessions: true })
  savingPassword.value = false
  if (error) return void (passwordError.value = authErrorMessage(error, 'Mot de passe actuel incorrect ou nouveau mot de passe trop court.'))
  currentPassword.value = ''
  newPassword.value = ''
  toast.success('Mot de passe modifié. Vos autres sessions ont été fermées.')
}

async function signOutEverywhere() {
  const { error } = await authClient.revokeOtherSessions()
  if (error) return void toast.error('Impossible de fermer les autres sessions')
  toast('Toutes vos autres sessions ont été fermées')
}

const themes = [
  { value: 'system', label: 'Système', icon: Monitor },
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
]
const theme = computed({ get: () => colorMode.preference, set: value => (colorMode.preference = value) })
const densities = [
  { value: 'comfortable' as const, label: 'Confortable', icon: Rows3 },
  { value: 'compact' as const, label: 'Compact', icon: Rows4 },
]
const views = [
  { value: 'list' as const, label: 'Liste', icon: List },
  { value: 'grid' as const, label: 'Grille', icon: LayoutGrid },
]
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-4xl px-4 py-6 md:px-8">
      <h1 class="text-xl font-semibold text-ink">Paramètres</h1>

      <SettingsSection title="Profil" :description="isOwner ? 'Votre nom est affiché sur les pages de partage.' : undefined">
        <form class="flex max-w-md items-end gap-2" @submit.prevent="saveName">
          <UiInput v-model="name" label="Nom" autocomplete="name" class="flex-1" />
          <UiButton type="submit" :loading="savingName" :disabled="!name.trim() || name === me?.user?.name">Enregistrer</UiButton>
        </form>
        <div>
          <p class="text-sm font-semibold text-ink">Adresse email</p>
          <p class="text-base text-ink-weak">{{ me?.user?.email }}</p>
        </div>
      </SettingsSection>

      <SettingsSection title="Mot de passe">
        <form class="flex max-w-md flex-col gap-3" @submit.prevent="changePassword">
          <UiInput v-model="currentPassword" label="Mot de passe actuel" type="password" autocomplete="current-password" required />
          <UiInput v-model="newPassword" label="Nouveau mot de passe" type="password" autocomplete="new-password" required hint="Au moins 10 caractères." :error="passwordError" />
          <div><UiButton type="submit" :loading="savingPassword">Changer le mot de passe</UiButton></div>
        </form>
      </SettingsSection>

      <SettingsSection title="Clés d’accès" description="Connexion sans mot de passe, résistante à l’hameçonnage.">
        <SettingsPasskeys />
      </SettingsSection>

      <SettingsSection title="Vérification en deux étapes" description="Un code d’une application d’authentification est demandé après le mot de passe.">
        <SettingsTwoFactor :enabled="!!me?.user?.twoFactorEnabled" @changed="refetch()" />
      </SettingsSection>

      <SettingsSection title="Sessions">
        <div><UiButton @click="signOutEverywhere">Se déconnecter des autres appareils</UiButton></div>
      </SettingsSection>

      <SettingsSection title="Apparence">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="text-base text-ink">Thème</span>
          <div role="radiogroup" aria-label="Thème" class="inline-flex rounded-md border border-line p-0.5">
            <button
              v-for="option in themes"
              :key="option.value"
              type="button"
              role="radio"
              :aria-checked="theme === option.value"
              class="inline-flex h-8 items-center gap-2 rounded-[5px] px-3 text-sm transition-colors"
              :class="theme === option.value ? 'bg-selected font-semibold text-accent-ink' : 'text-ink-weak hover:bg-hover hover:text-ink'"
              @click="theme = option.value"
            >
              <component :is="option.icon" class="size-4" aria-hidden="true" />
              {{ option.label }}
            </button>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="text-base text-ink">Densité de la liste</span>
          <UiSegmented v-model="preferences.density" :options="densities" label="Densité" />
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="text-base text-ink">Affichage par défaut</span>
          <UiSegmented v-model="preferences.view" :options="views" label="Affichage" />
        </div>
      </SettingsSection>

      <SettingsSection v-if="isOwner && settings" title="Données et confidentialité" description="Réglés par la configuration du serveur.">
        <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-base">
          <dt class="text-ink-weak">Conservation de l’activité</dt>
          <dd class="text-ink">{{ plural(settings.retentionDays, 'jour') }}</dd>
          <dt class="text-ink-weak">Adresses IP</dt>
          <dd class="text-ink">{{ settings.ipMode === 'hash' ? 'Réseau haché, jamais l’adresse complète' : 'Non enregistrées' }}</dd>
          <dt class="text-ink-weak">Envoi d’emails</dt>
          <dd class="text-ink">{{ settings.emailEnabled ? 'Activé' : 'Désactivé (les liens d’invitation se copient)' }}</dd>
          <dt class="text-ink-weak">Contenu isolé</dt>
          <dd class="truncate text-ink">{{ settings.usercontentUrl }}</dd>
          <dt class="text-ink-weak">Stockage</dt>
          <dd class="text-ink">{{ settings.storageDriver === 's3' ? 'S3 compatible' : 'Disque local' }} · quota {{ formatSize(settings.quota) }} · fichiers ≤ {{ formatSize(settings.uploadMax) }}</dd>
        </dl>
      </SettingsSection>
    </div>
  </div>
</template>
