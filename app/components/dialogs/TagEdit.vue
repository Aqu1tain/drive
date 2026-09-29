<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { Check } from '@lucide/vue'
import { TAG_COLORS } from '#shared/utils/tags'
import type { TagInfo } from '#shared/types/api'

const COLOR_NAMES = ['Violet', 'Bleu', 'Turquoise', 'Vert', 'Ocre', 'Orange', 'Rouge', 'Rose']

const props = defineProps<{ tag: TagInfo }>()
const emit = defineEmits<{ close: [] }>()
const queryClient = useQueryClient()

const open = ref(true)
watch(open, value => !value && emit('close'))
const name = ref(props.tag.name)
const color = ref(props.tag.color)
const error = ref<string | null>(null)
const saving = ref(false)

async function submit() {
  saving.value = true
  error.value = null
  try {
    await api(`/api/tags/${props.tag.id}`, { method: 'PATCH', body: { name: name.value, color: color.value } })
    queryClient.invalidateQueries({ queryKey: ['tags'] })
    open.value = false
  }
  catch (e) {
    error.value = errorMessage(e, 'Impossible de modifier l’étiquette')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <UiDialog v-model:open="open" title="Modifier l’étiquette" size="sm">
    <form id="tag-form" class="flex flex-col gap-4" @submit.prevent="submit">
      <UiInput v-model="name" label="Nom" :error="error" autocomplete="off" />
      <fieldset>
        <legend class="mb-2 text-sm font-semibold text-ink">Couleur</legend>
        <div class="flex flex-wrap gap-2">
          <label v-for="(value, index) in TAG_COLORS" :key="value" class="relative">
            <input v-model="color" type="radio" name="tag-color" :value="value" class="peer sr-only">
            <span class="sr-only">{{ COLOR_NAMES[index] }}</span>
            <span
              class="flex size-8 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-raised peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-focus-ring"
              :style="{ background: value }"
              aria-hidden="true"
            >
              <Check v-if="color === value" class="size-4" />
            </span>
          </label>
        </div>
      </fieldset>
    </form>
    <template #footer>
      <UiButton variant="ghost" @click="open = false">Annuler</UiButton>
      <UiButton variant="primary" type="submit" form="tag-form" :loading="saving">Enregistrer</UiButton>
    </template>
  </UiDialog>
</template>
