<script setup lang="ts">
import { Globe, Lock } from '@lucide/vue'
import type { AccessSummary } from '#shared/types/api'

const props = defineProps<{ access?: AccessSummary, compact?: boolean }>()

const people = computed(() => props.access?.people ?? [])
const text = computed(() => {
  const access = props.access
  if (!access || access.level === 'private') return 'Privé'
  const parts = []
  if (access.hasLink) parts.push('Public')
  if (people.value.length === 1 && !access.hasLink) parts.push(people.value[0]!.label)
  else if (access.userCount) parts.push(plural(access.userCount, 'personne'))
  if (access.invitationCount && !(people.value.length === 1 && !access.hasLink)) parts.push(plural(access.invitationCount, 'invité'))
  return parts.join(' · ')
})
const tooltip = computed(() => {
  const access = props.access
  if (!access || access.level === 'private') return 'Visible uniquement par vous'
  const lines = [
    ...(access.hasLink ? ['Toute personne disposant du lien'] : []),
    ...people.value.map(p => p.kind === 'invitation' ? `${p.label} (invité)` : p.label),
  ]
  return (access.inherited ? 'Hérité du dossier parent : ' : '') + lines.join(', ')
})
</script>

<template>
  <UiTooltip :label="tooltip">
    <span class="inline-flex min-w-0 items-center gap-1.5 text-sm" :class="access?.level === 'private' || !access ? 'text-ink-hint' : 'text-ink-weak'">
      <Lock v-if="!access || access.level === 'private'" class="size-3.5 shrink-0" aria-hidden="true" />
      <Globe v-else-if="access.hasLink" class="size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
      <span v-else class="flex shrink-0 -space-x-1">
        <UiAvatar v-for="person in people.slice(0, 3)" :key="person.email" :name="person.label" :kind="person.kind" size="sm" class="ring-2 ring-canvas" />
      </span>
      <span v-if="!compact" class="truncate">{{ text }}</span>
    </span>
  </UiTooltip>
</template>
