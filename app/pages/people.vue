<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import { Ban, CircleCheck, Copy, EllipsisVertical, KeyRound, Trash2, UserPlus, Users } from '@lucide/vue'
import type { Person } from '#shared/types/api'

const { t } = useI18n()
useHead({ title: t('people.title') })
const queryClient = useQueryClient()
const dialogs = useDialogs()
const { data, isPending } = useQuery({ queryKey: ['people'], queryFn: () => api<{ people: Person[] }>('/api/people') })

const accounts = computed(() => data.value?.people.filter(p => p.kind === 'user') ?? [])
const invitations = computed(() => data.value?.people.filter(p => p.kind === 'invitation' && p.status === 'pending') ?? [])
const refresh = () => {
  queryClient.invalidateQueries({ queryKey: ['people'] })
  queryClient.invalidateQueries({ queryKey: ['access'] })
  queryClient.invalidateQueries({ queryKey: ['folder'] })
}

const since = (value: string | Date) => midSentence(formatShortDate(value))

async function attempt(task: () => Promise<unknown>, success: string) {
  try {
    await task()
    toast(success)
    refresh()
  }
  catch (error) {
    toast.error(errorMessage(error))
  }
}

const passwordFor = ref<Person | null>(null)
const creating = ref(false)

function accountMenu(person: Person): MenuEntry[] {
  return [
    { id: 'password', label: t('people.setPassword'), icon: KeyRound, onSelect: () => (passwordFor.value = person) },
    person.status === 'active'
      ? { id: 'disable', label: t('people.disableAccount'), icon: Ban, onSelect: () => disable(person) }
      : { id: 'enable', label: t('people.enableAccount'), icon: CircleCheck, onSelect: () => attempt(() => api(`/api/people/${person.id}`, { method: 'PATCH', body: { status: 'active' } }), t('people.enabled')) },
    { kind: 'separator' },
    { id: 'delete', label: t('people.deleteAccount'), icon: Trash2, danger: true, onSelect: () => remove(person) },
  ]
}

async function disable(person: Person) {
  const confirmed = await dialogs.confirm({
    title: t('people.confirmDisable.title', { name: person.name || person.email }),
    message: t('people.confirmDisable.message'),
    confirmLabel: t('people.confirmDisable.confirm'),
    danger: true,
  })
  if (confirmed) attempt(() => api(`/api/people/${person.id}`, { method: 'PATCH', body: { status: 'disabled' } }), t('people.accountDisabled'))
}

async function remove(person: Person) {
  const confirmed = await dialogs.confirm({
    title: t('people.confirmDelete.title', { name: person.name || person.email }),
    message: t('people.confirmDelete.message', { count: person.shareCount }),
    confirmLabel: t('common.delete'),
    danger: true,
  })
  if (confirmed) attempt(() => api(`/api/people/${person.id}`, { method: 'DELETE' }), t('people.deleted'))
}

function invitationMenu(person: Person): MenuEntry[] {
  return [
    { id: 'link', label: t('people.copyNewLink'), icon: Copy, onSelect: () => regenerate(person) },
    { kind: 'separator' },
    { id: 'revoke', label: t('people.revokeInvitation'), icon: Ban, danger: true, onSelect: () => revoke(person) },
  ]
}

async function regenerate(person: Person) {
  try {
    const { url } = await api<{ url: string }>(`/api/invitations/${person.id}/link`, { method: 'POST' })
    await navigator.clipboard.writeText(url)
    toast(t('people.newLinkCopied'))
  }
  catch (error) {
    toast.error(errorMessage(error))
  }
}

async function revoke(person: Person) {
  const confirmed = await dialogs.confirm({
    title: t('people.confirmRevoke.title', { email: person.email }),
    message: t('people.confirmRevoke.message', { count: person.shareCount }),
    confirmLabel: t('people.confirmRevoke.confirm'),
    danger: true,
  })
  if (confirmed) attempt(() => api(`/api/invitations/${person.id}`, { method: 'DELETE' }), t('people.revoked'))
}
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
      <div class="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-ink">{{ t('people.title') }}</h1>
          <p class="mt-1 text-base text-ink-weak">{{ t('people.intro') }}</p>
        </div>
        <UiButton variant="primary" :icon="UserPlus" @click="creating = true">{{ t('people.create') }}</UiButton>
      </div>

      <div v-if="isPending" class="flex flex-col gap-3"><UiSkeleton v-for="n in 4" :key="n" height="3rem" /></div>
      <UiEmptyState v-else-if="!accounts.length && !invitations.length" :icon="Users" :title="t('people.empty.title')" :description="t('people.empty.description')" />

      <template v-else>
        <section v-if="accounts.length" class="mb-8" aria-labelledby="accounts-heading">
          <h2 id="accounts-heading" class="mb-2 text-sm font-semibold text-ink-weak">{{ t('people.accounts', { count: accounts.length }) }}</h2>
          <ul class="divide-y divide-line-weak rounded-lg border border-line-weak">
            <li v-for="person in accounts" :key="person.id" class="flex items-center gap-3 px-4 py-3">
              <UiAvatar :name="person.name || person.email" />
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-2">
                  <span class="truncate text-base font-medium text-ink">{{ person.name || person.email }}</span>
                  <UiBadge v-if="person.status === 'disabled'" tone="danger">{{ t('people.disabled') }}</UiBadge>
                </p>
                <p class="truncate text-sm text-ink-weak">{{ person.email }}</p>
              </div>
              <div class="text-right text-sm text-ink-weak max-sm:hidden">
                <p>{{ t('people.shares', { count: person.shareCount }) }}</p>
                <p>{{ person.lastSeenAt ? t('people.lastSeen', { when: since(person.lastSeenAt) }) : t('people.neverSignedIn') }}</p>
              </div>
              <UiDropdownMenu :entries="accountMenu(person)" align="end">
                <UiIconButton :icon="EllipsisVertical" :label="t('people.optionsFor', { name: person.name || person.email })" size="sm" />
              </UiDropdownMenu>
            </li>
          </ul>
        </section>

        <section v-if="invitations.length" aria-labelledby="invitations-heading">
          <h2 id="invitations-heading" class="mb-2 text-sm font-semibold text-ink-weak">{{ t('people.pendingInvitations', { count: invitations.length }) }}</h2>
          <ul class="divide-y divide-line-weak rounded-lg border border-line-weak">
            <li v-for="person in invitations" :key="person.id" class="flex items-center gap-3 px-4 py-3">
              <UiAvatar :name="person.name || person.email" kind="invitation" />
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-2">
                  <span class="truncate text-base font-medium text-ink">{{ person.name || person.email }}</span>
                  <UiBadge :tone="person.invitationMode === 'link' ? 'accent' : 'warning'">{{ t(person.invitationMode === 'link' ? 'people.personalLink' : 'people.pending') }}</UiBadge>
                </p>
                <p class="truncate text-sm text-ink-weak">{{ person.email }}</p>
              </div>
              <div class="text-right text-sm text-ink-weak max-sm:hidden">
                <p>{{ t('people.shares', { count: person.shareCount }) }}</p>
                <p>{{ person.lastSeenAt ? t('people.lastUsed', { when: since(person.lastSeenAt) }) : t('people.invited', { when: since(person.createdAt) }) }}</p>
              </div>
              <UiDropdownMenu :entries="invitationMenu(person)" align="end">
                <UiIconButton :icon="EllipsisVertical" :label="t('people.optionsFor', { name: person.email })" size="sm" />
              </UiDropdownMenu>
            </li>
          </ul>
        </section>
      </template>
    </div>
    <PeopleCreateDialog v-if="creating" @close="creating = false" @created="refresh" />
    <PeoplePasswordDialog v-if="passwordFor" :person="passwordFor" @close="passwordFor = null" />
  </div>
</template>
