<script setup lang="ts">
import type { ResourceItem } from '#shared/types/api'

const props = defineProps<{ item: ResourceItem }>()
const emit = defineEmits<{ close: [] }>()
const actions = useFileActions()

const open = ref(true)
const name = ref(props.item.name)
const error = ref<string | null>(null)
const saving = ref(false)
const input = useTemplateRef<{ focus: () => void, select: (start?: number, end?: number) => void }>('input')

watch(open, value => !value && emit('close'))

function onOpen(event: Event) {
  event.preventDefault()
  input.value?.focus()
  const dot = props.item.type === 'file' ? props.item.name.lastIndexOf('.') : -1
  input.value?.select(0, dot > 0 ? dot : props.item.name.length)
}

async function submit() {
  const value = name.value.trim()
  if (!value || value === props.item.name) {
    open.value = false
    return
  }
  saving.value = true
  error.value = null
  try {
    await api(`/api/resources/${props.item.id}`, { method: 'PATCH', body: { name: value } })
    actions.patchInCaches(props.item.id, { name: value })
    actions.refresh()
    open.value = false
  }
  catch (e) {
    error.value = errorMessage(e, 'Impossible de renommer')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDialog v-model:open="open" title="Renommer" size="sm" @open-auto-focus="onOpen">
    <form id="rename-form" @submit.prevent="submit">
      <UiInput ref="input" v-model="name" label="Nom" :error="error" autocomplete="off" />
    </form>
    <template #footer>
      <UiButton variant="ghost" @click="open = false">Annuler</UiButton>
      <UiButton variant="primary" type="submit" form="rename-form" :loading="saving">Renommer</UiButton>
    </template>
  </UiDialog>
</template>
