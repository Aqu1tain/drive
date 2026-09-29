<script setup lang="ts">
import { Calendar, ChevronDown, FileType, Share2, Tag, X } from '@lucide/vue'
import { ACCESS_FILTERS, FILE_KINDS, type SearchQuery } from '#shared/utils/search'

const props = defineProps<{ query: SearchQuery, owner: boolean }>()
const emit = defineEmits<{ update: [patch: Partial<SearchQuery>] }>()
const { t } = useI18n()

const TYPES = FILE_KINDS.map(kind => [kind, t(`search.types.${kind}`)] as const)
const ACCESS = ACCESS_FILTERS.map(level => [level, t(`search.accessLevels.${level}`)] as const)

const isoDaysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
const MODIFIED: Array<[string, string]> = [
  [isoDaysAgo(1), t('search.periods.today')],
  [isoDaysAgo(7), t('search.periods.week')],
  [isoDaysAgo(30), t('search.periods.month')],
  [isoDaysAgo(365), t('search.periods.year')],
]

const typeEntries = computed<MenuEntry[]>(() => TYPES.map(([value, label]) => ({ id: value, label, onSelect: () => emit('update', { type: value }) })))
const accessEntries = computed<MenuEntry[]>(() => ACCESS.map(([value, label]) => ({ id: value, label, onSelect: () => emit('update', { access: value }) })))
const modifiedEntries = computed<MenuEntry[]>(() => MODIFIED.map(([value, label]) => ({ id: label, label, onSelect: () => emit('update', { after: value }) })))

const { tags } = useTags(computed(() => props.owner))
const tagEntries = computed<MenuEntry[]>(() => tags.value.map(tag => ({ id: tag.id, label: tag.name, onSelect: () => emit('update', { tag: tag.name.toLowerCase() }) })))
const tagLabel = computed(() => props.query.tag && (tags.value.find(tag => tag.name.toLowerCase() === props.query.tag)?.name ?? props.query.tag))

const typeLabel = computed(() => TYPES.find(([value]) => value === props.query.type)?.[1])
const accessLabel = computed(() => ACCESS.find(([value]) => value === props.query.access)?.[1])
const modifiedLabel = computed(() => props.query.after ? t('search.since', { date: formatLongDate(props.query.after) }) : null)
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" role="toolbar" :aria-label="t('search.filters')">
    <SearchChip :icon="FileType" :label="t('search.type')" :value="typeLabel" :entries="typeEntries" @clear="emit('update', { type: undefined })" />
    <SearchChip v-if="owner" :icon="Share2" :label="t('search.access')" :value="accessLabel" :entries="accessEntries" @clear="emit('update', { access: undefined })" />
    <SearchChip v-if="owner && (tags.length || query.tag)" :icon="Tag" :label="t('search.tag')" :value="tagLabel" :entries="tagEntries" @clear="emit('update', { tag: undefined })" />
    <SearchChip :icon="Calendar" :label="t('search.modified')" :value="modifiedLabel" :entries="modifiedEntries" @clear="emit('update', { after: undefined, before: undefined })" />
    <span v-if="query.sharedWith" class="inline-flex h-8 items-center gap-1.5 rounded-full bg-selected pr-1 pl-3 text-sm font-medium text-accent-ink">
      {{ t('search.sharedWith', { name: query.sharedWith }) }}
      <button type="button" class="rounded-full p-1 hover:bg-hover" :aria-label="t('search.removeThisFilter')" @click="emit('update', { sharedWith: undefined })"><X class="size-3.5" aria-hidden="true" /></button>
    </span>
  </div>
</template>
