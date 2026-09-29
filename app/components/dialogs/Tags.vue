<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { Check, Minus, Plus } from '@lucide/vue'
import { cleanTagName } from '#shared/utils/tags'
import type { ResourceItem, TagInfo } from '#shared/types/api'

type Choice = 'on' | 'off' | 'mixed'

const props = defineProps<{ items: ResourceItem[] }>()
const emit = defineEmits<{ close: [] }>()
const actions = useFileActions()
const queryClient = useQueryClient()
const { tags } = useTags()

const open = ref(true)
watch(open, value => !value && emit('close'))

function initial(id: string): Choice {
  const tagged = props.items.filter(item => item.tagIds?.includes(id)).length
  if (tagged === 0) return 'off'
  return tagged === props.items.length ? 'on' : 'mixed'
}
const choices = reactive(new Map<string, Choice>())
const choiceOf = (id: string) => choices.get(id) ?? initial(id)
const toggle = (id: string) => choices.set(id, choiceOf(id) === 'on' ? 'off' : 'on')

const newName = ref('')
const creating = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

async function create() {
  const name = cleanTagName(newName.value)
  if (!name) return
  const existing = tags.value.find(tag => tag.name.toLowerCase() === name.toLowerCase())
  if (existing) {
    choices.set(existing.id, 'on')
    newName.value = ''
    return
  }
  creating.value = true
  error.value = null
  try {
    const tag = await api<TagInfo>('/api/tags', { method: 'POST', body: { name } })
    queryClient.setQueryData<TagInfo[]>(['tags'], list => [...(list ?? []), tag])
    choices.set(tag.id, 'on')
    newName.value = ''
  }
  catch (e) {
    error.value = errorMessage(e, 'Impossible de créer l’étiquette')
  }
  finally {
    creating.value = false
  }
}

async function apply() {
  const changed = [...choices].filter(([id, choice]) => choice !== initial(id))
  const add = changed.filter(([, choice]) => choice === 'on').map(([id]) => id)
  const remove = changed.filter(([, choice]) => choice === 'off').map(([id]) => id)
  if (!add.length && !remove.length) {
    open.value = false
    return
  }
  saving.value = true
  try {
    const { items } = await api<{ items: Array<{ id: string, tagIds: string[] }> }>('/api/resources/tags', {
      method: 'POST',
      body: { ids: props.items.map(item => item.id), add, remove },
    })
    for (const item of items) actions.patchInCaches(item.id, { tagIds: item.tagIds })
    queryClient.invalidateQueries({ queryKey: ['tags'] })
    queryClient.invalidateQueries({ queryKey: ['resource'] })
    open.value = false
  }
  catch (e) {
    error.value = errorMessage(e, 'Impossible de mettre à jour les étiquettes')
  }
  finally {
    saving.value = false
  }
}

const description = computed(() => props.items.length === 1 ? props.items[0]!.name : `${props.items.length} éléments sélectionnés`)
</script>

<template>
  <UiDialog v-model:open="open" title="Étiquettes" :description="description" size="sm">
    <ul v-if="tags.length" class="-mx-2 mb-4 flex flex-col py-1" aria-label="Étiquettes existantes">
      <li v-for="tag in tags" :key="tag.id">
        <button
          type="button"
          role="checkbox"
          :aria-checked="choiceOf(tag.id) === 'mixed' ? 'mixed' : choiceOf(tag.id) === 'on'"
          class="flex h-10 w-full items-center gap-3 rounded-md px-2 text-left text-base text-ink hover:bg-hover"
          @click="toggle(tag.id)"
        >
          <span
            class="flex size-4.5 shrink-0 items-center justify-center rounded border"
            :class="choiceOf(tag.id) === 'off' ? 'border-field' : 'border-accent bg-accent text-white'"
            aria-hidden="true"
          >
            <Check v-if="choiceOf(tag.id) === 'on'" class="size-3.5" />
            <Minus v-else-if="choiceOf(tag.id) === 'mixed'" class="size-3.5" />
          </span>
          <span class="size-2.5 shrink-0 rounded-full" :style="{ background: tag.color }" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ tag.name }}</span>
        </button>
      </li>
    </ul>
    <p v-else class="mb-4 text-base text-ink-weak">Aucune étiquette pour l’instant. Créez la première ci-dessous.</p>
    <form class="flex items-end gap-2" @submit.prevent="create">
      <UiInput v-model="newName" label="Nouvelle étiquette" class="flex-1" :error="error" autocomplete="off" />
      <UiButton type="submit" :icon="Plus" :loading="creating" :disabled="!newName.trim()">Créer</UiButton>
    </form>
    <template #footer>
      <UiButton variant="ghost" @click="open = false">Annuler</UiButton>
      <UiButton variant="primary" :loading="saving" @click="apply">Appliquer</UiButton>
    </template>
  </UiDialog>
</template>
