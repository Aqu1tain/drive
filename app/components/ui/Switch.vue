<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

const model = defineModel<boolean>({ default: false })
defineProps<{ label: string, description?: string, disabled?: boolean }>()
const id = useId()
</script>

<template>
  <div class="flex items-start justify-between gap-4">
    <label :for="id" class="min-w-0 cursor-pointer">
      <span class="block text-base text-ink">{{ label }}</span>
      <span v-if="description" class="block text-sm text-ink-weak">{{ description }}</span>
    </label>
    <SwitchRoot
      :id="id"
      v-model="model"
      :disabled="disabled"
      class="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 data-[state=checked]:bg-accent data-[state=unchecked]:bg-muted disabled:opacity-50"
    >
      <SwitchThumb class="block size-4 translate-x-0.5 rounded-full bg-white shadow-norm transition-transform duration-150 data-[state=checked]:translate-x-[18px]" />
    </SwitchRoot>
  </div>
</template>
