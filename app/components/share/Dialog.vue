<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { refDebounced } from '@vueuse/core'
import { ComboboxAnchor, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxPortal, ComboboxRoot, ComboboxViewport, RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { toast } from 'vue-sonner'
import { Ban, CalendarClock, Check, Copy, Download, EllipsisVertical, ExternalLink, Globe, Link, Lock, Mail, UserMinus } from '@lucide/vue'
import type { AccessEntry, ResourceAccess } from '#shared/types/api'
import type { MessageKey } from '#shared/i18n'

const props = defineProps<{ item: { id: string, name: string, type: 'file' | 'folder' } }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

const open = ref(true)
watch(open, value => !value && emit('close'))

const queryClient = useQueryClient()
const dialogs = useDialogs()
const { data: me } = useMe()
const emailEnabled = computed(() => me.value?.emailEnabled ?? false)

const key = computed(() => ['access', props.item.id])
const { data: access, isPending } = useQuery({
  queryKey: key,
  queryFn: () => api<ResourceAccess>(`/api/resources/${props.item.id}/access`),
})

function setAccess(value: ResourceAccess) {
  queryClient.setQueryData(key.value, value)
  for (const k of ['folder', 'list', 'search', 'resource', 'activity']) queryClient.invalidateQueries({ queryKey: [k] })
}

const own = computed(() => access.value?.entries.filter(e => !e.inheritedFrom) ?? [])
const inherited = computed(() => Map.groupBy(access.value?.entries.filter(e => e.inheritedFrom) ?? [], e => e.inheritedFrom!.id))

const email = ref('')
const debouncedEmail = refDebounced(email, 150)
const suggestOpen = ref(false)
const mode = ref<'account' | 'link'>('account')
const notify = ref(true)
const adding = ref(false)
const addError = ref<string | null>(null)
const lastInvite = ref<{ email: string, url: string, emailed: boolean } | null>(null)

const { data: suggestions } = useQuery({
  queryKey: computed(() => ['people', 'suggest', debouncedEmail.value]),
  queryFn: () => api<{ people: Array<{ name: string | null, email: string, kind: 'user' | 'invitation' }> }>('/api/people/suggest', { query: { q: debouncedEmail.value } }),
  enabled: computed(() => debouncedEmail.value.trim().length > 0),
})
const suggested = computed(() => {
  const existing = new Set(own.value.map(e => e.email))
  return (suggestions.value?.people ?? []).filter(p => !existing.has(p.email))
})
const isValidEmail = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
const knownReader = computed(() => suggested.value.some(p => p.kind === 'user' && p.email === email.value.trim().toLowerCase()))

async function add(value = email.value) {
  const address = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    addError.value = t('share.invalidEmail')
    return
  }
  adding.value = true
  addError.value = null
  try {
    const result = await api<{ inviteUrl: string | null, emailed: boolean }>(`/api/resources/${props.item.id}/access`, {
      method: 'POST',
      body: { email: address, mode: mode.value, notify: notify.value && emailEnabled.value },
    })
    email.value = ''
    suggestOpen.value = false
    setAccess(await api<ResourceAccess>(`/api/resources/${props.item.id}/access`))
    if (result.inviteUrl) {
      lastInvite.value = { email: address, url: result.inviteUrl, emailed: result.emailed }
      if (!result.emailed) await copy(result.inviteUrl, t('share.inviteLinkCopiedSend'))
    }
    else {
      toast(t(result.emailed ? 'share.notified' : 'share.granted', { email: address }))
    }
  }
  catch (error) {
    addError.value = errorMessage(error, t('share.addFailed'))
  }
  finally {
    adding.value = false
  }
}

async function copy(text: string, message = t('share.linkCopied')) {
  try {
    await navigator.clipboard.writeText(text)
    toast(message)
  }
  catch {
    toast(t('share.copyFailed'))
  }
}

const inDays = (days: number | null) => days === null ? null : new Date(Date.now() + days * 86_400_000).toISOString()

async function updateRule(entry: { ruleId: string }, patch: { allowDownload?: boolean, expiresAt?: string | null }) {
  try {
    setAccess(await api<ResourceAccess>(`/api/access/${entry.ruleId}`, { method: 'PATCH', body: patch }))
  }
  catch (error) {
    toast.error(errorMessage(error))
  }
}

async function removeRule(entry: AccessEntry) {
  try {
    setAccess(await api<ResourceAccess>(`/api/access/${entry.ruleId}`, { method: 'DELETE' }))
    toast(t('share.accessRemoved', { name: entry.label }))
  }
  catch (error) {
    toast.error(errorMessage(error))
  }
}

function entryMenu(entry: AccessEntry): MenuEntry[] {
  return tidyMenu([
    entry.inviteUrl && { id: 'copy', label: t('share.copyInviteLink'), icon: Copy, onSelect: () => copy(entry.inviteUrl!, t('share.inviteLinkCopied')) },
    entry.inviteUrl && { kind: 'separator' },
    { id: 'download', label: t(entry.allowDownload ? 'share.blockDownload' : 'share.allowDownload'), icon: entry.allowDownload ? Ban : Download, onSelect: () => updateRule(entry, { allowDownload: !entry.allowDownload }) },
    { id: 'exp-7', label: t('share.expiresIn', { count: 7 }), icon: CalendarClock, onSelect: () => updateRule(entry, { expiresAt: inDays(7) }) },
    { id: 'exp-30', label: t('share.expiresIn', { count: 30 }), icon: CalendarClock, onSelect: () => updateRule(entry, { expiresAt: inDays(30) }) },
    entry.expiresAt && { id: 'exp-none', label: t('share.noExpiration'), icon: CalendarClock, onSelect: () => updateRule(entry, { expiresAt: null }) },
    { kind: 'separator' },
    { id: 'remove', label: t('share.removeAccess'), icon: UserMinus, danger: true, onSelect: () => removeRule(entry) },
  ])
}

const STATUS: Record<AccessEntry['status'], { label: MessageKey, tone: 'neutral' | 'warning' | 'danger' | 'accent' } | null> = {
  active: null,
  pending: { label: 'share.status.pending', tone: 'warning' },
  disabled: { label: 'share.status.disabled', tone: 'danger' },
  expired: { label: 'share.status.expired', tone: 'danger' },
  revoked: { label: 'share.status.revoked', tone: 'danger' },
}

const linkEnabled = computed({
  get: () => (access.value?.link ? 'on' : 'off'),
  set: value => saveLink({ enabled: value === 'on' }),
})
const expirationChoice = computed(() => {
  const expiresAt = access.value?.link?.expiresAt
  if (!expiresAt) return 'never'
  return 'custom'
})
const savingLink = ref(false)

async function saveLink(patch: { enabled?: boolean, allowDownload?: boolean, expiresAt?: string | null }) {
  const link = access.value?.link
  savingLink.value = true
  try {
    const result = await api<ResourceAccess>(`/api/resources/${props.item.id}/link`, {
      method: 'PUT',
      body: {
        enabled: patch.enabled ?? !!link,
        allowDownload: patch.allowDownload ?? link?.allowDownload ?? true,
        expiresAt: patch.expiresAt !== undefined ? patch.expiresAt : link?.expiresAt ?? null,
      },
    })
    setAccess(result)
    if (patch.enabled === true && result.link) await copy(result.link.url, t('share.linkCreated'))
    if (patch.enabled === false) toast(t('share.linkTurnedOff'))
  }
  catch (error) {
    toast.error(errorMessage(error, t('share.linkFailed')))
  }
  finally {
    savingLink.value = false
  }
}

function onExpirationChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'custom') return
  saveLink({ expiresAt: value === 'never' ? null : inDays(Number(value)) })
}

async function toggleInheritance(value: boolean) {
  try {
    await api(`/api/resources/${props.item.id}`, { method: 'PATCH', body: { inheritAccess: value } })
    setAccess(await api<ResourceAccess>(`/api/resources/${props.item.id}/access`))
  }
  catch (error) {
    toast.error(errorMessage(error))
  }
}

const inheritAccess = computed({
  get: () => access.value?.inheritAccess ?? true,
  set: value => toggleInheritance(value),
})

function openParentSharing(crumb: { id: string | null, name: string }) {
  if (!crumb.id) return
  dialogs.share({ id: crumb.id, name: crumb.name, type: 'folder' })
}
</script>

<template>
  <UiDialog v-model:open="open" :title="t('share.title', { name: item.name })" size="lg">
    <form class="flex flex-col gap-2" @submit.prevent="add()">
      <div class="flex gap-2">
        <ComboboxRoot v-model:open="suggestOpen" :ignore-filter="true" :reset-search-term-on-blur="false" :reset-search-term-on-select="false" class="relative flex-1" @update:model-value="value => add(String(value))">
          <ComboboxAnchor class="flex h-10 items-center gap-2 rounded-md border border-field bg-canvas px-3 focus-within:border-accent focus-within:ring-3 focus-within:ring-focus-ring">
            <Mail class="size-4 shrink-0 text-ink-weak" aria-hidden="true" />
            <ComboboxInput
              v-model="email"
              type="email"
              inputmode="email"
              autocomplete="off"
              :placeholder="t('share.emailPlaceholder')"
              :aria-label="t('share.emailLabel')"
              class="h-full min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-hint focus:outline-none"
              @update:model-value="suggestOpen = !!$event.trim() && suggested.length > 0"
              @keydown.enter.prevent="add()"
            />
          </ComboboxAnchor>
          <ComboboxPortal>
            <ComboboxContent v-if="suggested.length" position="popper" :side-offset="4" class="z-(--z-menu) w-(--reka-combobox-trigger-width) rounded-lg border border-line-weak bg-raised p-1 shadow-lifted">
              <ComboboxViewport>
                <ComboboxItem v-for="person in suggested" :key="person.email" :value="person.email" class="flex h-11 items-center gap-3 rounded-md px-2.5 outline-none data-highlighted:bg-hover">
                  <UiAvatar :name="person.name || person.email" size="sm" :kind="person.kind" />
                  <div class="min-w-0">
                    <p class="truncate text-base text-ink">{{ person.name || person.email }}</p>
                    <p v-if="person.name" class="truncate text-sm text-ink-weak">{{ person.email }}</p>
                  </div>
                </ComboboxItem>
              </ComboboxViewport>
            </ComboboxContent>
          </ComboboxPortal>
        </ComboboxRoot>
        <UiButton type="submit" variant="primary" :loading="adding" :disabled="!email.trim()">{{ t('common.share') }}</UiButton>
      </div>
      <p v-if="addError" class="text-sm text-danger" role="alert">{{ addError }}</p>

      <div v-if="isValidEmail && !knownReader" class="flex flex-col gap-2 rounded-lg bg-subtle p-3 text-sm animate-fade-in">
        <RadioGroupRoot v-model="mode" class="flex flex-col gap-2" :aria-label="t('share.modeLabel')">
          <label class="flex items-start gap-2.5">
            <RadioGroupItem value="account" class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-field bg-canvas data-[state=checked]:border-accent">
              <RadioGroupIndicator class="size-2 rounded-full bg-accent" />
            </RadioGroupItem>
            <span><span class="block font-medium text-ink">{{ t('share.withAccount') }}</span><span class="block text-ink-weak">{{ t('share.withAccountHint') }}</span></span>
          </label>
          <label class="flex items-start gap-2.5">
            <RadioGroupItem value="link" class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-field bg-canvas data-[state=checked]:border-accent">
              <RadioGroupIndicator class="size-2 rounded-full bg-accent" />
            </RadioGroupItem>
            <span><span class="block font-medium text-ink">{{ t('share.personalLink') }}</span><span class="block text-ink-weak">{{ t('share.personalLinkHint') }}</span></span>
          </label>
        </RadioGroupRoot>
        <label class="flex items-center gap-2.5" :class="!emailEnabled && 'opacity-60'">
          <input v-model="notify" type="checkbox" :disabled="!emailEnabled" class="size-4 accent-(--accent)">
          <span class="text-ink">{{ t('share.notify') }}</span>
          <span v-if="!emailEnabled" class="text-ink-weak">{{ t('share.emailOff') }}</span>
        </label>
      </div>

      <div v-if="lastInvite" class="flex flex-col gap-2.5 rounded-lg bg-accent-softer p-3 text-sm animate-fade-in" role="status">
        <p class="flex items-center gap-2 text-ink">
          <Check class="size-4 shrink-0 text-accent-ink" aria-hidden="true" />
          <span>
            <UiTranslate :message="lastInvite.emailed ? 'share.inviteSent' : 'share.inviteCreated'">
              <template #email><strong class="font-semibold">{{ lastInvite.email }}</strong></template>
            </UiTranslate>
          </span>
        </p>
        <div class="flex gap-2">
          <input :value="lastInvite.url" readonly :aria-label="t('share.inviteLink')" class="h-8 min-w-0 flex-1 rounded-md border border-line bg-canvas px-2 text-sm text-ink-weak" @focus="($event.target as HTMLInputElement).select()">
          <UiButton size="sm" variant="secondary" :icon="Copy" @click="copy(lastInvite.url, t('share.inviteLinkCopied'))">{{ t('common.copy') }}</UiButton>
        </div>
      </div>
    </form>

    <section class="mt-6" aria-labelledby="people-heading">
      <h3 id="people-heading" class="mb-2 text-sm font-semibold text-ink-weak">{{ t('share.peopleWithAccess') }}</h3>
      <div v-if="isPending" class="flex flex-col gap-3 py-1"><UiSkeleton v-for="n in 2" :key="n" height="2.25rem" /></div>
      <ul v-else class="flex flex-col">
        <li class="flex items-center gap-3 py-2">
          <UiAvatar :name="me?.user?.name || t('share.me')" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-base text-ink">{{ me?.user?.name }} <span class="text-ink-weak">{{ t('share.you') }}</span></p>
            <p class="truncate text-sm text-ink-weak">{{ me?.user?.email }}</p>
          </div>
          <span class="text-sm text-ink-weak">{{ t('share.owner') }}</span>
        </li>
        <li v-for="entry in own" :key="entry.ruleId" class="flex items-center gap-3 py-2">
          <UiAvatar :name="entry.label" :kind="entry.kind === 'invitation' ? 'invitation' : 'user'" />
          <div class="min-w-0 flex-1">
            <p class="flex min-w-0 items-center gap-2">
              <span class="truncate text-base text-ink">{{ entry.label }}</span>
              <UiBadge v-if="STATUS[entry.status]" :tone="STATUS[entry.status]!.tone">{{ t(STATUS[entry.status]!.label) }}</UiBadge>
              <UiBadge v-else-if="entry.invitationMode === 'link'" tone="accent">{{ t('share.personalLink') }}</UiBadge>
            </p>
            <p class="truncate text-sm text-ink-weak">
              <template v-if="entry.label !== entry.email">{{ entry.email }}</template>
              <template v-if="entry.expiresAt"> · {{ t('share.expires', { date: formatLongDate(entry.expiresAt) }) }}</template>
              <template v-if="!entry.allowDownload"> · {{ t('share.viewOnly') }}</template>
            </p>
          </div>
          <span class="text-sm text-ink-weak max-sm:hidden">{{ t('share.reader') }}</span>
          <UiDropdownMenu :entries="entryMenu(entry)" align="end">
            <UiIconButton :icon="EllipsisVertical" :label="t('share.optionsFor', { name: entry.label })" size="sm" />
          </UiDropdownMenu>
        </li>
      </ul>

      <div v-for="[folderId, entries] in inherited" :key="String(folderId)" class="mt-3 rounded-lg border border-line-weak p-3">
        <div class="mb-1 flex items-center justify-between gap-2">
          <p class="text-sm text-ink-weak">
            <UiTranslate message="share.inheritedFrom">
              <template #folder><strong class="font-semibold text-ink">{{ t('share.quoted', { name: entries[0]!.inheritedFrom!.name }) }}</strong></template>
            </UiTranslate>
          </p>
          <UiButton size="sm" variant="ghost" @click="openParentSharing(entries[0]!.inheritedFrom!)">{{ t('common.edit') }}</UiButton>
        </div>
        <ul>
          <li v-for="entry in entries" :key="entry.ruleId" class="flex items-center gap-3 py-1.5">
            <UiAvatar :name="entry.label" size="sm" :kind="entry.kind === 'invitation' ? 'invitation' : 'user'" />
            <span class="min-w-0 flex-1 truncate text-base text-ink">{{ entry.label }}</span>
            <UiBadge v-if="STATUS[entry.status]" :tone="STATUS[entry.status]!.tone">{{ t(STATUS[entry.status]!.label) }}</UiBadge>
          </li>
        </ul>
      </div>

      <UiSwitch
        v-if="access?.parent"
        v-model="inheritAccess"
        class="mt-4"
        :label="t('share.inherit', { name: access.parent.name })"
        :description="t(inheritAccess ? 'share.inheritOn' : 'share.inheritOff')"
      />
    </section>

    <section class="mt-6 border-t border-line-weak pt-5" aria-labelledby="link-heading">
      <h3 id="link-heading" class="mb-3 text-sm font-semibold text-ink-weak">{{ t('share.linkAccess') }}</h3>
      <div class="flex items-start gap-3">
        <div class="flex size-9 shrink-0 items-center justify-center rounded-full" :class="access?.link ? 'bg-accent-softer text-accent-ink' : 'bg-subtle text-ink-weak'">
          <Globe v-if="access?.link" class="size-[18px]" aria-hidden="true" />
          <Lock v-else class="size-[18px]" aria-hidden="true" />
        </div>
        <RadioGroupRoot v-model="linkEnabled" class="flex flex-1 flex-col gap-2" :aria-label="t('share.linkAccess')" :disabled="savingLink || isPending">
          <label class="flex items-center gap-2.5">
            <RadioGroupItem value="off" class="flex size-4 shrink-0 items-center justify-center rounded-full border border-field data-[state=checked]:border-accent">
              <RadioGroupIndicator class="size-2 rounded-full bg-accent" />
            </RadioGroupItem>
            <span class="text-base text-ink">{{ t('share.linkOff') }}</span>
          </label>
          <label class="flex items-center gap-2.5">
            <RadioGroupItem value="on" class="flex size-4 shrink-0 items-center justify-center rounded-full border border-field data-[state=checked]:border-accent">
              <RadioGroupIndicator class="size-2 rounded-full bg-accent" />
            </RadioGroupItem>
            <span class="text-base text-ink">{{ t('share.linkOn') }}</span>
          </label>
        </RadioGroupRoot>
      </div>

      <p v-if="!access?.link && access?.inheritedLink" class="mt-3 flex items-center gap-2 rounded-lg bg-info-soft p-3 text-sm text-info">
        <Link class="size-4 shrink-0" aria-hidden="true" />
        {{ t('share.inheritedLink', { name: access.inheritedLink.inheritedFrom.name }) }}
      </p>

      <div v-if="access?.link" class="mt-4 flex flex-col gap-4 pl-12 animate-fade-in">
        <UiSwitch :model-value="access.link.allowDownload" :label="t('share.allowDownload')" :description="t('share.allowDownloadHint')" @update:model-value="value => saveLink({ allowDownload: value })" />
        <div class="flex items-center justify-between gap-4">
          <label for="link-expiration" class="text-base text-ink">{{ t('share.expiration') }}</label>
          <select
            id="link-expiration"
            :value="expirationChoice"
            class="h-9 rounded-md border border-field bg-canvas px-2.5 text-base text-ink focus:border-accent focus:outline-none focus:ring-3 focus:ring-focus-ring"
            @change="onExpirationChange"
          >
            <option value="never">{{ t('share.never') }}</option>
            <option value="1">{{ t('share.in24Hours') }}</option>
            <option value="7">{{ t('share.inDays', { count: 7 }) }}</option>
            <option value="30">{{ t('share.inDays', { count: 30 }) }}</option>
            <option v-if="access.link.expiresAt" value="custom" disabled>{{ t('share.on', { date: formatLongDate(access.link.expiresAt) }) }}</option>
          </select>
        </div>
        <div class="flex gap-2">
          <input :value="access.link.url" readonly :aria-label="t('share.linkAddress')" class="h-9 min-w-0 flex-1 rounded-md border border-line bg-subtle px-2.5 text-sm text-ink-weak" @focus="($event.target as HTMLInputElement).select()">
          <UiButton variant="secondary" :icon="Copy" @click="copy(access.link.url)">{{ t('share.copyLink') }}</UiButton>
        </div>
        <a v-if="access.link.publishedUrl" :href="access.link.publishedUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-sm text-accent-ink hover:underline">
          <ExternalLink class="size-3.5" aria-hidden="true" />
          {{ t('share.publishedAddress') }}
        </a>
      </div>
    </section>

    <template #footer>
      <UiButton variant="primary" @click="open = false">{{ t('share.done') }}</UiButton>
    </template>
  </UiDialog>
</template>
