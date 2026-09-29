<script setup lang="ts">
import type { MessageKey, MessageParams } from '#shared/i18n'

const props = defineProps<{ message: MessageKey, params?: MessageParams }>()
const { t } = useI18n()
/** Placeholders left without a param become slots of the same name: odd parts are slot names. */
const parts = computed(() => t(props.message, props.params).split(/\{(\w+)\}/))
</script>

<template>
  <template v-for="(part, index) in parts" :key="index">
    <slot v-if="index % 2" :name="part" />
    <template v-else>{{ part }}</template>
  </template>
</template>
