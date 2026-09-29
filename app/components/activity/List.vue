<script setup lang="ts">
import { Download, Eye, Globe, Link2Off, Pencil, UserCheck, UserMinus, UserPlus } from '@lucide/vue'
import type { ActivityEvent } from '#shared/types/api'

const props = withDefaults(defineProps<{ events: ActivityEvent[], showResource?: boolean, dense?: boolean }>(), { showResource: true })
const { t } = useI18n()

const groups = computed(() => [...Map.groupBy(props.events, e => new Date(e.createdAt).toDateString()).values()])

const ICONS = {
  view: Eye, download: Download, share_added: UserPlus, share_removed: UserMinus, share_updated: Pencil,
  link_created: Globe, link_updated: Globe, link_removed: Link2Off, invite_accepted: UserCheck, access_denied: UserMinus,
}

/** Honest wording: a public link visitor is never presented as a known person. */
function actor(event: ActivityEvent) {
  if (event.actorKind === 'owner') return t('activity.you')
  if (event.actorKind === 'link') return t('activity.visitor')
  if (event.actorKind === 'invitation') return t('activity.personalLink', { name: event.actorLabel })
  return event.actorLabel
}

const isInheritance = (label: string) => label === t('labels.inheritRestored') || label === t('labels.inheritRemoved')

function verb(event: ActivityEvent) {
  const target = event.targetLabel ?? ''
  switch (event.type) {
    case 'view': return t('activity.verbs.view')
    case 'download': return t('activity.verbs.download')
    case 'share_added': return t('activity.verbs.shareAdded', { target })
    case 'share_removed': return t('activity.verbs.shareRemoved', { target })
    case 'share_updated': return isInheritance(target) ? t('activity.verbs.inheritance', { target: target.toLowerCase() }) : t('activity.verbs.shareUpdated', { target })
    case 'link_created': return t('activity.verbs.linkCreated')
    case 'link_updated': return t('activity.verbs.linkUpdated')
    case 'link_removed': return t('activity.verbs.linkRemoved')
    case 'invite_accepted': return t('activity.verbs.inviteAccepted')
    default: return t('activity.verbs.accessDenied')
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <section v-for="group in groups" :key="group[0]!.createdAt">
      <h3 class="sticky top-0 z-(--z-sticky) bg-canvas py-1.5 text-sm font-semibold text-ink-weak">{{ formatDay(group[0]!.createdAt) }}</h3>
      <ol class="flex flex-col">
        <li v-for="event in group" :key="event.id" class="flex gap-3" :class="dense ? 'py-1.5' : 'py-2.5'">
          <span
            class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full"
            :class="event.actorKind === 'owner' ? 'bg-subtle text-ink-weak' : event.type === 'download' ? 'bg-info-soft text-info' : 'bg-accent-softer text-accent-ink'"
          >
            <component :is="ICONS[event.type]" class="size-3.5" aria-hidden="true" />
          </span>
          <div class="min-w-0 flex-1 text-base leading-snug">
            <p class="text-ink">
              <strong class="font-semibold">{{ actor(event) }}</strong>
              {{ ' ' }}<span class="text-ink-weak">{{ verb(event) }}</span>
              <template v-if="showResource && event.resource">
                {{ ' ' }}<NuxtLink :to="`/open/${event.resource.id}`" class="font-medium text-ink hover:underline">{{ event.resource.name }}</NuxtLink>
              </template>
            </p>
            <p class="text-sm text-ink-hint tabular">{{ formatTime(event.createdAt) }}</p>
          </div>
        </li>
      </ol>
    </section>
  </div>
</template>
