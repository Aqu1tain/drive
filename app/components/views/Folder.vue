<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { FolderOpen, FolderPlus, HardDrive, RotateCcw, Upload } from '@lucide/vue'
import type { Crumb, FolderListing } from '#shared/types/api'

const props = defineProps<{ folderId: string | null, mode: 'owner' | 'reader' }>()
const dialogs = useDialogs()
const actions = useFileActions()

const base = computed(() => props.mode === 'owner' ? '/drive' : '/shared-with-me')
const folderTo = (id: string) => `${base.value}/folder/${id}`
const crumbTo = (crumb: Crumb) => crumb.id ? folderTo(crumb.id) : base.value

const { data, isPending, error } = useQuery({
  queryKey: computed(() => ['folder', props.folderId ?? 'root']),
  queryFn: () => api<FolderListing>(`/api/folders/${props.folderId ?? 'root'}`),
  retry: false,
})

const name = computed(() => data.value?.folder?.name ?? (props.folderId ? '' : 'Mon Drive'))
useHead({ title: name })

watch(() => props.folderId, (id) => {
  if (id && props.mode === 'owner') api(`/api/resources/${id}/open`, { method: 'POST' }).catch(() => {})
}, { immediate: true })

const status = computed(() => errorStatus(error.value))
</script>

<template>
  <div v-if="error" class="flex flex-1 items-center justify-center">
    <UiEmptyState
      :icon="FolderOpen"
      :title="status === 409 ? 'Ce dossier est dans la corbeille' : status === 403 ? 'Accès refusé' : 'Dossier introuvable'"
      :description="status === 409 ? 'Restaurez-le pour retrouver son contenu.' : status === 403 ? 'Ce dossier ne vous est pas ou plus partagé.' : 'Il a peut-être été supprimé ou déplacé.'"
    >
      <UiButton v-if="status === 409 && folderId" variant="primary" :icon="RotateCcw" @click="actions.restore([{ id: folderId } as never])">Restaurer</UiButton>
      <UiButton :variant="status === 409 ? 'secondary' : 'primary'" @click="navigateTo(base)">{{ mode === 'owner' ? 'Retour à Mon Drive' : 'Retour aux partages' }}</UiButton>
    </UiEmptyState>
  </div>
  <FilesDriveView
    v-else
    :items="data?.items ?? []"
    :loading="isPending"
    :mode="mode"
    :label="`Contenu de ${name || 'dossier'}`"
    :folder="{ id: folderId, name: name || 'ce dossier' }"
    :folder-item="data?.folder ?? null"
    :crumbs="data?.breadcrumbs ?? [{ id: null, name: mode === 'owner' ? 'Mon Drive' : 'Partagé avec moi' }]"
    :crumb-to="crumbTo"
    :folder-to="folderTo"
  >
    <template #empty="{ pickFiles }">
      <UiEmptyState
        v-if="mode === 'owner'"
        :icon="folderId ? FolderOpen : HardDrive"
        :title="folderId ? 'Ce dossier est vide' : 'Votre Drive est vide'"
        description="Déposez vos fichiers ici, ou créez un dossier pour commencer à ranger."
      >
        <UiButton variant="primary" :icon="Upload" @click="pickFiles">Importer</UiButton>
        <UiButton :icon="FolderPlus" @click="dialogs.newFolder(folderId)">Nouveau dossier</UiButton>
      </UiEmptyState>
      <UiEmptyState v-else :icon="FolderOpen" title="Ce dossier est vide" description="Aucun document ne vous est partagé ici pour l’instant." />
    </template>
  </FilesDriveView>
</template>
