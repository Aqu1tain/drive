<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { TabsContent, TabsIndicator, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { Globe, Lock, Share2, Star, X } from '@lucide/vue'
import type { ActivityEvent, ActivityStats, ResourceAccess, ResourceDetails, ResourceItem } from '#shared/types/api'

const props = defineProps<{ item: ResourceItem | null, count: number, mode: BrowserMode, folderTo?: (id: string) => string }>()
defineEmits<{ close: [] }>()

const panel = useDetailsPanel()
const dialogs = useDialogs()
const actions = useFileActions()
const queryClient = useQueryClient()
const isOwner = computed(() => props.mode === 'owner')
const id = computed(() => props.item?.id ?? '')

const { data: details } = useQuery({
  queryKey: computed(() => ['resource', id.value]),
  queryFn: () => api<ResourceDetails>(`/api/resources/${id.value}`),
  enabled: computed(() => !!id.value),
})
const { data: access } = useQuery({
  queryKey: computed(() => ['access', id.value]),
  queryFn: () => api<ResourceAccess>(`/api/resources/${id.value}/access`),
  enabled: computed(() => !!id.value && isOwner.value && panel.state.tab !== 'activity'),
})
const { data: activity } = useQuery({
  queryKey: computed(() => ['activity', id.value]),
  queryFn: () => api<{ stats: ActivityStats, events: ActivityEvent[] }>(`/api/resources/${id.value}/activity`),
  enabled: computed(() => !!id.value && isOwner.value && panel.state.tab === 'activity'),
})

const current = computed(() => details.value?.item ?? props.item)
const stats = computed(() => activity.value?.stats ?? details.value?.stats ?? null)
const KIND_LABELS: Record<string, string> = {
  folder: 'Dossier', pdf: 'PDF', image: 'Image', video: 'Vidéo', audio: 'Audio', document: 'Document', spreadsheet: 'Tableur',
  presentation: 'Présentation', text: 'Texte', html: 'Page web', archive: 'Archive', other: 'Fichier',
}

async function toggleScripts(value: boolean) {
  await api(`/api/resources/${id.value}`, { method: 'PATCH', body: { allowScripts: value } })
  queryClient.invalidateQueries({ queryKey: ['resource', id.value] })
  queryClient.invalidateQueries({ queryKey: ['open'] })
}

const allowScripts = computed({ get: () => current.value?.allowScripts ?? false, set: toggleScripts })
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <header class="flex h-14 shrink-0 items-center gap-2 pr-2 pl-4">
      <h2 class="min-w-0 flex-1 truncate font-semibold text-ink">{{ count > 1 ? plural(count, 'élément sélectionné', 'éléments sélectionnés') : current?.name ?? 'Détails' }}</h2>
      <UiIconButton :icon="X" label="Fermer les détails" size="sm" @click="$emit('close')" />
    </header>

    <div v-if="count > 1" class="px-4 py-10 text-center text-base text-ink-weak">
      Sélectionnez un seul élément pour voir ses détails.
    </div>
    <div v-else-if="!current" class="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
      <p class="text-base text-ink-weak">Sélectionnez un fichier ou un dossier pour voir ses détails, ses accès et son activité.</p>
    </div>

    <TabsRoot v-else v-model="panel.state.tab" class="flex min-h-0 flex-1 flex-col">
      <TabsList v-if="isOwner" class="relative flex shrink-0 gap-1 border-b border-line-weak px-3" aria-label="Sections">
        <TabsTrigger v-for="tab in [['details', 'Détails'], ['access', 'Accès'], ['activity', 'Activité']]" :key="tab[0]" :value="tab[0]!" class="h-10 px-2.5 text-base text-ink-weak transition-colors hover:text-ink data-[state=active]:font-semibold data-[state=active]:text-ink">
          {{ tab[1] }}
        </TabsTrigger>
        <TabsIndicator class="absolute bottom-0 left-0 h-0.5 w-(--reka-tabs-indicator-size) translate-x-(--reka-tabs-indicator-position) rounded-full bg-accent transition-[width,translate] duration-200" />
      </TabsList>

      <TabsContent value="details" class="min-h-0 flex-1 overflow-y-auto p-4 focus:outline-none">
        <div class="mb-4 flex aspect-[16/10] items-center justify-center overflow-hidden rounded-lg bg-subtle">
          <img v-if="current.thumbnailUrl" :src="current.thumbnailUrl" alt="" class="size-full object-cover" :class="{ 'object-top': current.kind === 'pdf' }">
          <FilesFileIcon v-else :kind="current.kind" size="xl" />
        </div>
        <div class="mb-4 flex items-start gap-2">
          <p class="min-w-0 flex-1 text-base font-semibold break-words text-ink">{{ current.name }}</p>
          <UiIconButton
            v-if="mode !== 'share'"
            :icon="Star"
            :label="current.starred ? 'Retirer des favoris' : 'Ajouter aux favoris'"
            size="sm"
            :active="current.starred"
            @click="actions.star([current], !current.starred).then(() => queryClient.invalidateQueries({ queryKey: ['resource', id] }))"
          />
        </div>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-base">
          <dt class="text-ink-weak">Type</dt>
          <dd class="text-ink">{{ KIND_LABELS[current.kind] }}<span v-if="current.extension" class="text-ink-weak"> · .{{ current.extension }}</span></dd>
          <template v-if="current.type === 'file'">
            <dt class="text-ink-weak">Taille</dt>
            <dd class="text-ink tabular">{{ formatSize(current.size) }}</dd>
          </template>
          <template v-if="details?.path.length">
            <dt class="text-ink-weak">Emplacement</dt>
            <dd class="min-w-0 text-ink">
              <template v-for="(crumb, index) in details.path" :key="String(crumb.id)">
                <NuxtLink v-if="crumb.id && folderTo" :to="folderTo(crumb.id)" class="hover:underline">{{ crumb.name }}</NuxtLink>
                <span v-else>{{ crumb.name }}</span>
                <span v-if="index < details.path.length - 1" class="text-ink-hint"> / </span>
              </template>
            </dd>
          </template>
          <dt class="text-ink-weak">Créé</dt>
          <dd class="text-ink">{{ formatDateTime(current.createdAt) }}</dd>
          <dt class="text-ink-weak">Modifié</dt>
          <dd class="text-ink">{{ formatDateTime(current.updatedAt) }}</dd>
          <template v-if="isOwner && stats?.lastViewAt">
            <dt class="text-ink-weak">Dernier accès</dt>
            <dd class="text-ink">{{ stats.lastViewBy }}<br><span class="text-sm text-ink-weak">{{ formatDateTime(stats.lastViewAt) }}</span></dd>
          </template>
        </dl>

        <template v-if="isOwner">
          <div class="mt-5 border-t border-line-weak pt-4">
            <div class="mb-2 flex items-center gap-2 text-base">
              <component :is="current.access?.level === 'private' ? Lock : current.access?.hasLink ? Globe : Share2" class="size-4 text-ink-weak" aria-hidden="true" />
              <span class="flex-1 text-ink">{{ current.access?.level === 'private' ? 'Privé' : current.access?.hasLink ? 'Lien public actif' : 'Partagé' }}</span>
              <UiButton size="sm" variant="secondary" @click="dialogs.share(current)">Partager</UiButton>
            </div>
            <p v-if="current.access?.people.length" class="text-sm text-ink-weak">{{ current.access.people.map(p => p.label).join(', ') }}</p>
          </div>
          <div v-if="current.kind === 'html'" class="mt-5 border-t border-line-weak pt-4">
            <UiSwitch v-model="allowScripts" label="Page interactive" description="Autorise le JavaScript de la page, toujours exécuté sur un domaine isolé." />
          </div>
        </template>
      </TabsContent>

      <TabsContent value="access" class="min-h-0 flex-1 overflow-y-auto p-4 focus:outline-none">
        <div v-if="!access" class="flex flex-col gap-3"><UiSkeleton v-for="n in 3" :key="n" height="2rem" /></div>
        <template v-else>
          <ul class="flex flex-col gap-1">
            <li v-if="access.link" class="flex items-center gap-3 py-1.5">
              <span class="flex size-8 items-center justify-center rounded-full bg-accent-softer text-accent-ink"><Globe class="size-4" aria-hidden="true" /></span>
              <div class="min-w-0 flex-1">
                <p class="text-base text-ink">Lien public</p>
                <p class="text-sm text-ink-weak">{{ access.link.allowDownload ? 'Consultation et téléchargement' : 'Consultation seule' }}{{ access.link.expiresAt ? ` · jusqu’au ${formatLongDate(access.link.expiresAt)}` : '' }}</p>
              </div>
            </li>
            <li v-for="entry in access.entries" :key="entry.ruleId" class="flex items-center gap-3 py-1.5">
              <UiAvatar :name="entry.label" :kind="entry.kind === 'invitation' ? 'invitation' : 'user'" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-base text-ink">{{ entry.label }}</p>
                <p class="truncate text-sm text-ink-weak">
                  {{ entry.inheritedFrom ? `Hérité de « ${entry.inheritedFrom.name} »` : entry.status === 'pending' ? 'Invitation en attente' : entry.invitationMode === 'link' ? 'Lien personnel' : entry.email }}
                </p>
              </div>
            </li>
          </ul>
          <p v-if="!access.link && !access.entries.length" class="py-6 text-center text-base text-ink-weak">Seul vous avez accès à cet élément.</p>
          <UiButton variant="secondary" block :icon="Share2" class="mt-4" @click="dialogs.share(current)">Gérer l’accès</UiButton>
        </template>
      </TabsContent>

      <TabsContent value="activity" class="min-h-0 flex-1 overflow-y-auto p-4 focus:outline-none">
        <div v-if="!activity" class="flex flex-col gap-3"><UiSkeleton v-for="n in 4" :key="n" height="2rem" /></div>
        <template v-else>
          <div class="mb-5 grid grid-cols-3 gap-2">
            <div v-for="stat in [['Consultations', activity.stats.views], ['Visiteurs', activity.stats.visitors], ['Téléchargements', activity.stats.downloads]]" :key="stat[0]" class="rounded-lg bg-subtle p-3">
              <p class="text-xl font-semibold text-ink tabular">{{ stat[1] }}</p>
              <p class="truncate text-xs text-ink-weak">{{ stat[0] }}</p>
            </div>
          </div>
          <p v-if="activity.stats.lastViewAt" class="mb-4 text-sm text-ink-weak">
            Dernière consultation {{ formatDateTime(activity.stats.lastViewAt).toLowerCase() }} par {{ activity.stats.lastViewBy }}
          </p>
          <ActivityList v-if="activity.events.length" :events="activity.events" :show-resource="current.type === 'folder'" dense />
          <p v-else class="py-6 text-center text-base text-ink-weak">Personne n’a encore consulté cet élément.</p>
        </template>
      </TabsContent>
    </TabsRoot>
  </div>
</template>
