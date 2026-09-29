<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import { LayoutGrid, List, Monitor, Moon, Rows3, Rows4, Sun } from '@lucide/vue'
import { LOCALES, isLocale } from '#shared/i18n'

const { t, locale, setLocale } = useI18n()
useHead({ title: t('settings.title') })
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
  if (error) return void toast.error(t('settings.profile.nameFailed'))
  toast(t('settings.profile.nameSaved'))
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
  if (error) return void (passwordError.value = authErrorMessage(error, t('settings.password.failed')))
  currentPassword.value = ''
  newPassword.value = ''
  toast.success(t('settings.password.changed'))
}

async function signOutEverywhere() {
  const { error } = await authClient.revokeOtherSessions()
  if (error) return void toast.error(t('settings.sessions.failed'))
  toast(t('settings.sessions.signedOut'))
}

function onLanguageChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (isLocale(value)) setLocale(value)
}

const themes = [
  { value: 'system', label: t('settings.appearance.system'), icon: Monitor },
  { value: 'light', label: t('settings.appearance.light'), icon: Sun },
  { value: 'dark', label: t('settings.appearance.dark'), icon: Moon },
]
const theme = computed({ get: () => colorMode.preference, set: value => (colorMode.preference = value) })
const densities = [
  { value: 'comfortable' as const, label: t('settings.appearance.comfortable'), icon: Rows3 },
  { value: 'compact' as const, label: t('settings.appearance.compact'), icon: Rows4 },
]
const views = [
  { value: 'list' as const, label: t('settings.appearance.list'), icon: List },
  { value: 'grid' as const, label: t('settings.appearance.grid'), icon: LayoutGrid },
]
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-4xl px-4 py-6 md:px-8">
      <h1 class="text-xl font-semibold text-ink">{{ t('settings.title') }}</h1>

      <SettingsSection :title="t('settings.profile.title')" :description="isOwner ? t('settings.profile.description') : undefined">
        <form class="flex max-w-md items-end gap-2" @submit.prevent="saveName">
          <UiInput v-model="name" :label="t('common.name')" autocomplete="name" class="flex-1" />
          <UiButton type="submit" :loading="savingName" :disabled="!name.trim() || name === me?.user?.name">{{ t('common.save') }}</UiButton>
        </form>
        <div>
          <p class="text-sm font-semibold text-ink">{{ t('settings.profile.email') }}</p>
          <p class="text-base text-ink-weak">{{ me?.user?.email }}</p>
        </div>
      </SettingsSection>

      <SettingsSection :title="t('settings.password.title')">
        <form class="flex max-w-md flex-col gap-3" @submit.prevent="changePassword">
          <UiInput v-model="currentPassword" :label="t('settings.password.current')" type="password" autocomplete="current-password" required />
          <UiInput v-model="newPassword" :label="t('settings.password.new')" type="password" autocomplete="new-password" required :hint="t('settings.password.hint')" :error="passwordError" />
          <div><UiButton type="submit" :loading="savingPassword">{{ t('settings.password.submit') }}</UiButton></div>
        </form>
      </SettingsSection>

      <SettingsSection :title="t('settings.passkeys.title')" :description="t('settings.passkeys.description')">
        <SettingsPasskeys />
      </SettingsSection>

      <SettingsSection :title="t('settings.twoFactor.title')" :description="t('settings.twoFactor.description')">
        <SettingsTwoFactor :enabled="!!me?.user?.twoFactorEnabled" @changed="refetch()" />
      </SettingsSection>

      <SettingsSection :title="t('settings.sessions.title')">
        <div><UiButton @click="signOutEverywhere">{{ t('settings.sessions.signOutOthers') }}</UiButton></div>
      </SettingsSection>

      <SettingsSection :title="t('settings.language.title')">
        <div class="flex flex-col gap-1.5">
          <select
            :value="locale"
            :aria-label="t('settings.language.title')"
            aria-describedby="language-hint"
            class="h-9 self-start rounded-md border border-field bg-canvas px-2.5 text-base text-ink focus:border-accent focus:outline-none focus:ring-3 focus:ring-focus-ring"
            @change="onLanguageChange"
          >
            <option v-for="code in LOCALES" :key="code" :value="code" :lang="code">{{ t(`locale.${code}`) }}</option>
          </select>
          <p id="language-hint" class="text-sm text-ink-weak text-pretty">{{ t('settings.language.hint') }}</p>
        </div>
      </SettingsSection>

      <SettingsSection :title="t('settings.appearance.title')">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="text-base text-ink">{{ t('settings.appearance.theme') }}</span>
          <div role="radiogroup" :aria-label="t('settings.appearance.theme')" class="inline-flex rounded-md border border-line p-0.5">
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
          <span class="text-base text-ink">{{ t('settings.appearance.density') }}</span>
          <UiSegmented v-model="preferences.density" :options="densities" :label="t('settings.appearance.densityLabel')" />
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="text-base text-ink">{{ t('settings.appearance.view') }}</span>
          <UiSegmented v-model="preferences.view" :options="views" :label="t('settings.appearance.viewLabel')" />
        </div>
      </SettingsSection>

      <SettingsSection v-if="isOwner && settings" :title="t('settings.data.title')" :description="t('settings.data.description')">
        <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-base">
          <dt class="text-ink-weak">{{ t('settings.data.retention') }}</dt>
          <dd class="text-ink">{{ t('settings.data.days', { count: settings.retentionDays }) }}</dd>
          <dt class="text-ink-weak">{{ t('settings.data.ipAddresses') }}</dt>
          <dd class="text-ink">{{ t(settings.ipMode === 'hash' ? 'settings.data.ipHashed' : 'settings.data.ipNone') }}</dd>
          <dt class="text-ink-weak">{{ t('settings.data.email') }}</dt>
          <dd class="text-ink">{{ t(settings.emailEnabled ? 'settings.data.emailOn' : 'settings.data.emailOff') }}</dd>
          <dt class="text-ink-weak">{{ t('settings.data.isolated') }}</dt>
          <dd class="truncate text-ink">{{ settings.usercontentUrl }}</dd>
          <dt class="text-ink-weak">{{ t('settings.data.storage') }}</dt>
          <dd class="text-ink">{{ t(settings.storageDriver === 's3' ? 'settings.data.s3' : 'settings.data.local') }} · {{ t('settings.data.quota', { size: formatSize(settings.quota) }) }} · {{ t('settings.data.maxFile', { size: formatSize(settings.uploadMax) }) }}</dd>
        </dl>
      </SettingsSection>
    </div>
  </div>
</template>
