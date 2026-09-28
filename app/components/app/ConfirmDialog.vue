<script setup lang="ts">
const dialogs = useDialogs()
const request = computed(() => dialogs.state.confirm)
const open = computed({
  get: () => !!request.value,
  set: (value) => {
    if (!value) settle(false)
  },
})

function settle(confirmed: boolean) {
  request.value?.resolve(confirmed)
  dialogs.state.confirm = null
}
</script>

<template>
  <UiDialog v-if="request" v-model:open="open" :title="request.title" size="sm">
    <p class="text-base text-ink-weak text-pretty">{{ request.message }}</p>
    <template #footer>
      <UiButton variant="ghost" @click="settle(false)">Annuler</UiButton>
      <UiButton :variant="request.danger ? 'danger' : 'primary'" autofocus @click="settle(true)">{{ request.confirmLabel }}</UiButton>
    </template>
  </UiDialog>
</template>
