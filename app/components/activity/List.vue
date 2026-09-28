<script setup lang="ts">
import { Download, Eye, Globe, Link2Off, Pencil, UserCheck, UserMinus, UserPlus } from '@lucide/vue'
import type { ActivityEvent } from '#shared/types/api'

const props = withDefaults(defineProps<{ events: ActivityEvent[], showResource?: boolean, dense?: boolean }>(), { showResource: true })

const groups = computed(() => [...Map.groupBy(props.events, e => new Date(e.createdAt).toDateString()).values()])

const ICONS = {
  view: Eye, download: Download, share_added: UserPlus, share_removed: UserMinus, share_updated: Pencil,
  link_created: Globe, link_updated: Globe, link_removed: Link2Off, invite_accepted: UserCheck, access_denied: UserMinus,
}

/** Honest wording: a public link visitor is never presented as a known person. */
function actor(event: ActivityEvent) {
  if (event.actorKind === 'owner') return 'Vous'
  if (event.actorKind === 'link') return 'Un visiteur (lien public)'
  if (event.actorKind === 'invitation') return `${event.actorLabel} (lien personnel)`
  return event.actorLabel
}

function verb(event: ActivityEvent) {
  const target = event.targetLabel
  switch (event.type) {
    case 'view': return 'a consulté'
    case 'download': return 'a téléchargé'
    case 'share_added': return `avez partagé avec ${target}`
    case 'share_removed': return `avez retiré l’accès de ${target}`
    case 'share_updated': return target?.startsWith('Accès hérités') ? `: ${target.toLowerCase()} pour` : `avez modifié l’accès de ${target}`
    case 'link_created': return 'avez créé un lien public pour'
    case 'link_updated': return 'avez modifié le lien public de'
    case 'link_removed': return 'avez désactivé le lien public de'
    case 'invite_accepted': return 'a accepté l’invitation à'
    default: return 'a tenté d’accéder à'
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
