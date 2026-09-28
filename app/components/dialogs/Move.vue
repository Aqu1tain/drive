<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { ChevronLeft, ChevronRight, FolderPlus } from '@lucide/vue'
import type { FolderListing, ResourceItem } from '#shared/types/api'

const props = defineProps<{ items: ResourceItem[] }>()
const emit = defineEmits<{ close: [] }>()
const actions = useFileActions()

const open = ref(true)
watch(open, value => !value && emit('close'))

const startId = props.items.every(item => item.parentId === props.items[0]?.parentId) ? props.items[0]?.parentId ?? null : null
const currentId = ref<string | null>(startId)
const movingIds = new Set(props.items.map(item => item.id))

const { data, isPending } = useQuery({
  queryKey: computed(() => ['folder', currentId.value ?? 'root', 'folders']),
  queryFn: () => api<FolderListing>(`/api/folders/${currentId.value ?? 'root'}`, { query: { foldersOnly: '1' } }),
})

const folders = computed(() => (data.value?.items ?? []).toSorted((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true })))
const crumbs = computed(() => data.value?.breadcrumbs ?? [{ id: null, name: 'Mon Drive' }])
const here = computed(() => crumbs.value.at(-1)!)
const alreadyHere = computed(() => props.items.every(item => item.parentId === currentId.value))
const highlighted = ref<string | null>(null)

const creating = ref(false)
const newName = ref('')

async function createFolder() {
  const name = newName.value.trim()
  if (!name) return
  try {
    const folder = await api<ResourceItem>('/api/folders', { method: 'POST', body: { name, parentId: currentId.value } })
    creating.value = false
    newName.value = ''
    currentId.value = folder.id
    actions.refresh()
  }
  catch (error) {
    newName.value = name
    creatingError.value = errorMessage(error)
  }
}
const creatingError = ref<string | null>(null)

async function submit() {
  open.value = false
  await actions.moveTo(props.items, { id: currentId.value, name: here.value.name })
}

const title = props.items.length === 1 ? `Déplacer « ${props.items[0]!.name} »` : `Déplacer ${plural(props.items.length, 'élément')}`
</script>

<template>
  <UiDialog v-model:open="open" :title="title" size="md">
    <div class="-mx-1 mb-2 flex items-center gap-1 text-base">
      <UiIconButton v-if="crumbs.length > 1" :icon="ChevronLeft" label="Dossier parent" size="sm" @click="currentId = crumbs.at(-2)!.id" />
      <nav aria-label="Emplacement" class="min-w-0 truncate">
        <template v-for="(crumb, index) in crumbs" :key="String(crumb.id)">
          <button v-if="index < crumbs.length - 1" type="button" class="rounded px-1 text-ink-weak hover:bg-hover hover:text-ink" @click="currentId = crumb.id">{{ crumb.name }}</button>
          <span v-else class="px-1 font-semibold text-ink">{{ crumb.name }}</span>
          <span v-if="index < crumbs.length - 1" class="text-ink-hint">/</span>
        </template>
      </nav>
    </div>

    <ul role="listbox" aria-label="Dossiers" class="h-72 overflow-y-auto rounded-lg border border-line-weak p-1">
      <li v-if="isPending" class="flex flex-col gap-2 p-2"><UiSkeleton v-for="n in 5" :key="n" height="1.75rem" /></li>
      <li
        v-for="folder in folders"
        :key="folder.id"
        role="option"
        :aria-selected="highlighted === folder.id"
        :aria-disabled="movingIds.has(folder.id) || undefined"
        tabindex="0"
        class="flex h-10 items-center gap-3 rounded-md px-2.5 outline-none select-none"
        :class="movingIds.has(folder.id) ? 'opacity-40' : 'cursor-default hover:bg-hover focus-visible:bg-hover'"
        @click="highlighted = folder.id"
        @dblclick="!movingIds.has(folder.id) && (currentId = folder.id)"
        @keydown.enter="!movingIds.has(folder.id) && (currentId = folder.id)"
      >
        <FilesFileIcon kind="folder" />
        <span class="flex-1 truncate text-base text-ink">{{ folder.name }}</span>
        <button v-if="!movingIds.has(folder.id)" type="button" tabindex="-1" class="rounded p-1 text-ink-weak hover:bg-hover" :aria-label="`Ouvrir ${folder.name}`" @click.stop="currentId = folder.id">
          <ChevronRight class="size-4" aria-hidden="true" />
        </button>
      </li>
      <li v-if="!isPending && !folders.length && !creating" class="px-3 py-10 text-center text-sm text-ink-weak">Aucun sous-dossier</li>
      <li v-if="creating" class="p-1">
        <form class="flex gap-2" @submit.prevent="createFolder">
          <input v-model="newName" autofocus placeholder="Nom du dossier" aria-label="Nom du nouveau dossier" class="h-9 flex-1 rounded-md border border-field bg-canvas px-2.5 text-base focus:border-accent focus:outline-none focus:ring-3 focus:ring-focus-ring">
          <UiButton type="submit" size="md" variant="secondary">Créer</UiButton>
        </form>
        <p v-if="creatingError" class="mt-1 text-sm text-danger">{{ creatingError }}</p>
      </li>
    </ul>

    <template #footer>
      <UiButton variant="ghost" :icon="FolderPlus" class="mr-auto" @click="creating = true">Nouveau dossier</UiButton>
      <UiButton variant="ghost" @click="open = false">Annuler</UiButton>
      <UiButton variant="primary" :disabled="alreadyHere" @click="submit">Déplacer ici</UiButton>
    </template>
  </UiDialog>
</template>
