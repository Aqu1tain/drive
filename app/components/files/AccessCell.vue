<script setup lang="ts">
import { Globe, Lock } from '@lucide/vue'
import type { AccessSummary } from '#shared/types/api'

const props = defineProps<{ access?: AccessSummary, compact?: boolean }>()
const { t } = useI18n()

const people = computed(() => props.access?.people ?? [])
const text = computed(() => {
  const access = props.access
  if (!access || access.level === 'private') return t('files.access.private')
  const parts = []
  if (access.hasLink) parts.push(t('files.access.public'))
  if (people.value.length === 1 && !access.hasLink) parts.push(people.value[0]!.label)
  else if (access.userCount) parts.push(t('files.access.people', { count: access.userCount }))
  if (access.invitationCount && !(people.value.length === 1 && !access.hasLink)) parts.push(t('files.access.invited', { count: access.invitationCount }))
  return parts.join(' · ')
})
const tooltip = computed(() => {
  const access = props.access
  if (!access || access.level === 'private') return t('files.access.onlyYou')
  const who = [
    ...(access.hasLink ? [t('files.access.anyoneWithLink')] : []),
    ...people.value.map(p => p.kind === 'invitation' ? t('files.access.invitedPerson', { name: p.label }) : p.label),
  ].join(', ')
  return access.inherited ? t('files.access.inherited', { people: who }) : who
})
</script>

<template>
  <UiTooltip :label="tooltip">
    <span class="inline-flex max-w-full min-w-0 items-center gap-1.5 text-sm text-ink-weak">
      <Lock v-if="!access || access.level === 'private'" class="size-3.5 shrink-0" aria-hidden="true" />
      <Globe v-else-if="access.hasLink" class="size-3.5 shrink-0 text-accent-ink" aria-hidden="true" />
      <span v-else class="flex shrink-0 -space-x-0.5">
        <UiAvatar v-for="person in people.slice(0, 3)" :key="person.email" :name="person.label" :kind="person.kind" size="sm" class="ring-2 ring-canvas" />
      </span>
      <span v-if="!compact" class="truncate">{{ text }}</span>
    </span>
  </UiTooltip>
</template>
