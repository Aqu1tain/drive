<script setup lang="ts">
import { RadioGroupIndicator, RadioGroupItem, RadioGroupRoot } from 'reka-ui'

const props = defineProps<{ request: ConflictRequest }>()
const emit = defineEmits<{ close: [] }>()

const open = ref(true)
const strategy = ref<'replace' | 'keep' | 'skip'>(props.request.kind === 'folder' ? 'replace' : 'keep')
const applyToAll = ref(false)
let settled = false

const keepName = computed(() => keepBothName(props.request.name, [props.request.name]))
const options = computed(() => props.request.kind === 'folder'
  ? [
      { value: 'replace', label: 'Fusionner', hint: 'Ajouter le contenu au dossier existant' },
      { value: 'keep', label: 'Conserver les deux', hint: `Créer « ${keepName.value} »` },
      { value: 'skip', label: 'Ignorer', hint: 'Ne pas importer ce dossier' },
    ]
  : [
      { value: 'replace', label: 'Remplacer', hint: 'Le fichier existant est mis à jour, ses partages sont conservés' },
      { value: 'keep', label: 'Conserver les deux', hint: `Importer sous le nom « ${keepName.value} »` },
      { value: 'skip', label: 'Ignorer', hint: 'Ne pas importer ce fichier' },
    ])

function settle(choice: ConflictChoice) {
  if (settled) return
  settled = true
  props.request.resolve(choice)
  emit('close')
}

watch(open, value => !value && settle({ strategy: 'skip', applyToAll: false }))
</script>

<template>
  <UiDialog
    v-model:open="open"
    :title="request.kind === 'folder' ? `Le dossier « ${request.name} » existe déjà` : `« ${request.name} » existe déjà`"
    description="Que voulez-vous faire ?"
    size="sm"
  >
    <RadioGroupRoot v-model="strategy" class="flex flex-col gap-1" aria-label="Résolution du conflit">
      <label
        v-for="option in options"
        :key="option.value"
        class="flex cursor-pointer items-start gap-3 rounded-md p-2.5 transition-colors hover:bg-hover has-data-[state=checked]:bg-selected"
      >
        <RadioGroupItem :value="option.value" class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-field data-[state=checked]:border-accent">
          <RadioGroupIndicator class="size-2 rounded-full bg-accent" />
        </RadioGroupItem>
        <span>
          <span class="block text-base font-medium text-ink">{{ option.label }}</span>
          <span class="block text-sm text-ink-weak">{{ option.hint }}</span>
        </span>
      </label>
    </RadioGroupRoot>
    <label v-if="request.remaining > 0" class="mt-4 flex items-center gap-2.5 text-base text-ink">
      <input v-model="applyToAll" type="checkbox" class="size-4 accent-(--accent)">
      Appliquer aux {{ plural(request.remaining, 'autre conflit', 'autres conflits') }}
    </label>
    <template #footer>
      <UiButton variant="ghost" @click="settle({ strategy: 'skip', applyToAll: true })">Tout ignorer</UiButton>
      <UiButton variant="primary" @click="settle({ strategy, applyToAll })">Continuer</UiButton>
    </template>
  </UiDialog>
</template>
