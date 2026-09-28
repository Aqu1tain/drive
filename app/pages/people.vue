<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import { Ban, CircleCheck, Copy, EllipsisVertical, KeyRound, Trash2, UserPlus, Users } from '@lucide/vue'
import type { Person } from '#shared/types/api'

useHead({ title: 'Personnes' })
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
    { id: 'password', label: 'Définir un mot de passe', icon: KeyRound, onSelect: () => (passwordFor.value = person) },
    person.status === 'active'
      ? { id: 'disable', label: 'Désactiver le compte', icon: Ban, onSelect: () => disable(person) }
      : { id: 'enable', label: 'Réactiver le compte', icon: CircleCheck, onSelect: () => attempt(() => api(`/api/people/${person.id}`, { method: 'PATCH', body: { status: 'active' } }), 'Compte réactivé') },
    { kind: 'separator' },
    { id: 'delete', label: 'Supprimer le compte', icon: Trash2, danger: true, onSelect: () => remove(person) },
  ]
}

async function disable(person: Person) {
  const confirmed = await dialogs.confirm({
    title: `Désactiver le compte de ${person.name || person.email} ?`,
    message: 'Ses sessions sont fermées immédiatement et il ne pourra plus rien consulter. Ses partages sont conservés si vous le réactivez.',
    confirmLabel: 'Désactiver',
    danger: true,
  })
  if (confirmed) attempt(() => api(`/api/people/${person.id}`, { method: 'PATCH', body: { status: 'disabled' } }), 'Compte désactivé')
}

async function remove(person: Person) {
  const confirmed = await dialogs.confirm({
    title: `Supprimer le compte de ${person.name || person.email} ?`,
    message: `Tous ses accès (${plural(person.shareCount, 'partage')}) sont retirés immédiatement. Cette action est irréversible.`,
    confirmLabel: 'Supprimer',
    danger: true,
  })
  if (confirmed) attempt(() => api(`/api/people/${person.id}`, { method: 'DELETE' }), 'Compte supprimé')
}

function invitationMenu(person: Person): MenuEntry[] {
  return [
    { id: 'link', label: 'Copier un nouveau lien', icon: Copy, onSelect: () => regenerate(person) },
    { kind: 'separator' },
    { id: 'revoke', label: 'Révoquer l’invitation', icon: Ban, danger: true, onSelect: () => revoke(person) },
  ]
}

async function regenerate(person: Person) {
  try {
    const { url } = await api<{ url: string }>(`/api/invitations/${person.id}/link`, { method: 'POST' })
    await navigator.clipboard.writeText(url)
    toast('Nouveau lien copié — l’ancien ne fonctionne plus')
  }
  catch (error) {
    toast.error(errorMessage(error))
  }
}

async function revoke(person: Person) {
  const confirmed = await dialogs.confirm({
    title: `Révoquer l’invitation de ${person.email} ?`,
    message: `Ses ${plural(person.shareCount, 'accès')} sont retirés immédiatement.`,
    confirmLabel: 'Révoquer',
    danger: true,
  })
  if (confirmed) attempt(() => api(`/api/invitations/${person.id}`, { method: 'DELETE' }), 'Invitation révoquée')
}
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-3xl px-4 py-6 md:px-8">
      <div class="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-ink">Personnes</h1>
          <p class="mt-1 text-base text-ink-weak">Tous sont lecteurs : ils consultent, ne modifient jamais.</p>
        </div>
        <UiButton variant="primary" :icon="UserPlus" @click="creating = true">Créer un compte</UiButton>
      </div>

      <div v-if="isPending" class="flex flex-col gap-3"><UiSkeleton v-for="n in 4" :key="n" height="3rem" /></div>
      <UiEmptyState v-else-if="!accounts.length && !invitations.length" :icon="Users" title="Personne pour l’instant" description="Partagez un fichier avec une adresse email : la personne apparaîtra ici. Vous pouvez aussi créer un compte directement." />

      <template v-else>
        <section v-if="accounts.length" class="mb-8" aria-labelledby="accounts-heading">
          <h2 id="accounts-heading" class="mb-2 text-sm font-semibold text-ink-weak">Comptes ({{ accounts.length }})</h2>
          <ul class="divide-y divide-line-weak rounded-lg border border-line-weak">
            <li v-for="person in accounts" :key="person.id" class="flex items-center gap-3 px-4 py-3">
              <UiAvatar :name="person.name || person.email" />
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-2">
                  <span class="truncate text-base font-medium text-ink">{{ person.name || person.email }}</span>
                  <UiBadge v-if="person.status === 'disabled'" tone="danger">Désactivé</UiBadge>
                </p>
                <p class="truncate text-sm text-ink-weak">{{ person.email }}</p>
              </div>
              <div class="text-right text-sm text-ink-weak max-sm:hidden">
                <p>{{ plural(person.shareCount, 'partage') }}</p>
                <p>{{ person.lastSeenAt ? `Vu ${formatShortDate(person.lastSeenAt).toLowerCase()}` : 'Jamais connecté' }}</p>
              </div>
              <UiDropdownMenu :entries="accountMenu(person)" align="end">
                <UiIconButton :icon="EllipsisVertical" :label="`Options pour ${person.name || person.email}`" size="sm" />
              </UiDropdownMenu>
            </li>
          </ul>
        </section>

        <section v-if="invitations.length" aria-labelledby="invitations-heading">
          <h2 id="invitations-heading" class="mb-2 text-sm font-semibold text-ink-weak">Invitations en attente ({{ invitations.length }})</h2>
          <ul class="divide-y divide-line-weak rounded-lg border border-line-weak">
            <li v-for="person in invitations" :key="person.id" class="flex items-center gap-3 px-4 py-3">
              <UiAvatar :name="person.name || person.email" kind="invitation" />
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-2">
                  <span class="truncate text-base font-medium text-ink">{{ person.name || person.email }}</span>
                  <UiBadge :tone="person.invitationMode === 'link' ? 'accent' : 'warning'">{{ person.invitationMode === 'link' ? 'Lien personnel' : 'En attente' }}</UiBadge>
                </p>
                <p class="truncate text-sm text-ink-weak">{{ person.email }}</p>
              </div>
              <div class="text-right text-sm text-ink-weak max-sm:hidden">
                <p>{{ plural(person.shareCount, 'partage') }}</p>
                <p>{{ person.lastSeenAt ? `Utilisé ${formatShortDate(person.lastSeenAt).toLowerCase()}` : `Invité ${formatShortDate(person.createdAt).toLowerCase()}` }}</p>
              </div>
              <UiDropdownMenu :entries="invitationMenu(person)" align="end">
                <UiIconButton :icon="EllipsisVertical" :label="`Options pour ${person.email}`" size="sm" />
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
