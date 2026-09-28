<script setup lang="ts">
const model = defineModel<string>({ default: '' })

defineProps<{
  label?: string
  hint?: string
  error?: string | null
  type?: string
  placeholder?: string
  autocomplete?: string
  autofocus?: boolean
  required?: boolean
  inputmode?: 'text' | 'email' | 'numeric' | 'search'
}>()

const id = useId()
const input = useTemplateRef<HTMLInputElement>('input')
defineExpose({ focus: () => input.value?.focus(), select: (start?: number, end?: number) => input.value?.setSelectionRange(start ?? 0, end ?? model.value.length) })
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" :for="id" class="text-sm font-semibold text-ink">{{ label }}</label>
    <input
      :id="id"
      ref="input"
      v-model="model"
      :type="type ?? 'text'"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :autofocus="autofocus"
      :required="required"
      :inputmode="inputmode"
      :aria-invalid="!!error || undefined"
      :aria-describedby="error || hint ? `${id}-hint` : undefined"
      class="h-10 w-full rounded-md border bg-canvas px-3 text-base text-ink placeholder:text-ink-hint transition-[border-color,box-shadow] duration-150 focus:border-accent focus:outline-none focus:ring-3 focus:ring-focus-ring"
      :class="error ? 'border-danger' : 'border-field hover:border-field-hover'"
    >
    <p v-if="error || hint" :id="`${id}-hint`" class="text-sm" :class="error ? 'text-danger' : 'text-ink-weak'">{{ error || hint }}</p>
  </div>
</template>
