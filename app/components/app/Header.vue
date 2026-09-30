<script setup lang="ts">
import { CircleHelp, Keyboard, LogOut, Menu, Monitor, Moon, PanelLeft, Settings, Sun } from '@lucide/vue'

defineProps<{ member: boolean }>()
defineEmits<{ menu: [], toggleSidebar: [] }>()

const { data: me } = useMe()
const dialogs = useDialogs()
const colorMode = useColorMode()
const { $queryClient } = useNuxtApp()
const { t } = useI18n()

async function signOut() {
  await authClient.signOut()
  $queryClient.clear()
  await navigateTo('/login')
}

const THEMES = { system: 'settings.appearance.system', light: 'settings.appearance.light', dark: 'settings.appearance.dark' } as const
const themeLabel = computed(() => t(THEMES[colorMode.preference as keyof typeof THEMES] ?? THEMES.system))
const nextTheme = () => {
  const order = ['system', 'light', 'dark']
  colorMode.preference = order[(order.indexOf(colorMode.preference) + 1) % order.length]!
}

const userEntries = computed<MenuEntry[]>(() => [
  { id: 'settings', label: t('nav.settings'), icon: Settings, onSelect: () => navigateTo('/settings') },
  { id: 'theme', label: t('nav.theme', { name: themeLabel.value }), icon: colorMode.preference === 'dark' ? Moon : colorMode.preference === 'light' ? Sun : Monitor, onSelect: nextTheme },
  { id: 'shortcuts', label: t('nav.shortcuts.title'), icon: Keyboard, shortcut: 'Mod+/', onSelect: () => dialogs.shortcuts() },
  { kind: 'separator' },
  { id: 'logout', label: t('nav.signOut'), icon: LogOut, onSelect: signOut },
])
</script>

<template>
  <header class="flex h-15 shrink-0 items-center gap-2 px-3 md:px-4">
    <UiIconButton :icon="Menu" :label="t('nav.menu')" class="md:hidden" @click="$emit('menu')" />
    <UiIconButton :icon="PanelLeft" :label="t('nav.toggleSidebar')" class="max-md:hidden" @click="$emit('toggleSidebar')" />
    <AppSearchBox :member="member" class="min-w-0 flex-1 md:max-w-[640px]" />
    <div class="ml-auto flex items-center gap-1">
      <UiIconButton :icon="CircleHelp" :label="t('nav.shortcuts.title')" shortcut="Mod+/" class="max-sm:hidden" @click="dialogs.shortcuts()" />
      <UiIconButton v-if="member" :icon="Settings" :label="t('nav.settings')" class="max-sm:hidden" @click="navigateTo('/settings')" />
      <UiDropdownMenu :entries="userEntries" align="end">
        <button type="button" class="ml-1 rounded-full focus-visible:outline-2" :aria-label="t('nav.account', { name: me?.user?.name ?? '' })">
          <UiAvatar :name="me?.user?.name || me?.user?.email || '?'" />
        </button>
        <template #header>
          <div class="px-2.5 pt-1.5 pb-2">
            <p class="truncate font-semibold text-ink">{{ me?.user?.name }}</p>
            <p class="truncate text-sm text-ink-weak">{{ me?.user?.email }}</p>
          </div>
          <div class="mx-2 mb-1 h-px bg-line-weak" />
        </template>
      </UiDropdownMenu>
    </div>
  </header>
</template>
