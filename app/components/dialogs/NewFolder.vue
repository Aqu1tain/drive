<script setup lang="ts">
import { toast } from 'vue-sonner'

const props = defineProps<{ parentId: string | null }>()
const emit = defineEmits<{ close: [] }>()
const actions = useFileActions()
const { t } = useI18n()

const open = ref(true)
const name = ref(t('dialogs.newFolder.defaultName'))
const error = ref<string | null>(null)
const saving = ref(false)
const input = useTemplateRef<{ focus: () => void, select: () => void }>('input')

watch(open, value => !value && emit('close'))

function onOpen(event: Event) {
  event.preventDefault()
  input.value?.focus()
  input.value?.select()
}

async function submit() {
  saving.value = true
  error.value = null
  try {
    await api('/api/folders', { method: 'POST', body: { name: name.value, parentId: props.parentId } })
    actions.refresh()
    toast(t('dialogs.newFolder.created', { name: name.value.trim() }))
    open.value = false
  }
  catch (e) {
    error.value = errorMessage(e, t('dialogs.newFolder.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDialog v-model:open="open" :title="t('dialogs.newFolder.title')" size="sm" @open-auto-focus="onOpen">
    <form id="new-folder-form" @submit.prevent="submit">
      <UiInput ref="input" v-model="name" :label="t('dialogs.newFolder.name')" :error="error" autocomplete="off" />
    </form>
    <template #footer>
      <UiButton variant="ghost" @click="open = false">{{ t('common.cancel') }}</UiButton>
      <UiButton variant="primary" type="submit" form="new-folder-form" :loading="saving">{{ t('common.create') }}</UiButton>
    </template>
  </UiDialog>
</template>
