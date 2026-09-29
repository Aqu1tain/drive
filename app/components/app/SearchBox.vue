<script setup lang="ts">
import { ComboboxAnchor, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxPortal, ComboboxRoot, ComboboxViewport } from 'reka-ui'
import { useQuery } from '@tanstack/vue-query'
import { refDebounced } from '@vueuse/core'
import { ArrowRight, Search, X } from '@lucide/vue'
import type { ResourceItem } from '#shared/types/api'

const props = defineProps<{ owner: boolean }>()
const route = useRoute()
const query = ref(route.path === '/search' ? String(route.query.q ?? '') : '')
const debounced = refDebounced(query, 120)
const open = ref(false)
const input = useTemplateRef<InstanceType<typeof ComboboxInput>>('input')
const { t } = useI18n()

const { data, isFetching } = useQuery({
  queryKey: computed(() => ['search', 'suggest', debounced.value.trim()]),
  queryFn: () => api<{ items: ResourceItem[] }>('/api/search', { query: { q: debounced.value.trim(), limit: 6 } }),
  enabled: computed(() => debounced.value.trim().length > 0),
  placeholderData: previous => previous,
})

const results = computed(() => debounced.value.trim() ? data.value?.items ?? [] : [])

watch(() => route.fullPath, () => {
  open.value = false
  if (route.path !== '/search') query.value = ''
})

function select(value: unknown) {
  open.value = false
  if (value === '__all') {
    navigateTo({ path: '/search', query: { q: query.value.trim() } })
    return
  }
  const item = results.value.find(r => r.id === value)
  if (item) navigateTo(`/open/${item.id}`)
}

function focus() {
  (input.value?.$el as HTMLInputElement | undefined)?.focus()
}

function onFocusShortcut(event: Event) {
  event.preventDefault()
  focus()
}

onMounted(() => document.addEventListener('drive:focus-search', onFocusShortcut))
onBeforeUnmount(() => document.removeEventListener('drive:focus-search', onFocusShortcut))
</script>

<template>
  <ComboboxRoot
    v-model:open="open"
    :ignore-filter="true"
    :reset-search-term-on-blur="false"
    :reset-search-term-on-select="false"
    :open-on-focus="false"
    class="relative"
    @update:model-value="select"
  >
    <ComboboxAnchor
      class="group flex h-10 w-full items-center gap-2 rounded-lg bg-subtle px-3 transition-[background-color,box-shadow] duration-150 focus-within:bg-canvas focus-within:shadow-raised focus-within:ring-1 focus-within:ring-line-weak hover:bg-muted/60"
    >
      <Search class="size-[18px] shrink-0 text-ink-weak" aria-hidden="true" />
      <ComboboxInput
        ref="input"
        v-model="query"
        :placeholder="t(props.owner ? 'nav.search.owner' : 'nav.search.reader')"
        :aria-label="t('common.search')"
        class="h-full min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-weak focus:outline-none"
        @keydown.enter.exact="!results.length && query.trim() && select('__all')"
        @focus="query.trim() && (open = true)"
        @update:model-value="open = !!$event.trim()"
      />
      <button v-if="query" type="button" class="rounded p-1 text-ink-weak hover:bg-hover" :aria-label="t('nav.search.clear')" @click="query = ''; focus()">
        <X class="size-4" aria-hidden="true" />
      </button>
      <UiKbd v-else keys="/" class="max-sm:hidden" />
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        :side-offset="6"
        class="z-(--z-menu) w-(--reka-combobox-trigger-width) min-w-80 overflow-hidden rounded-lg border border-line-weak bg-raised shadow-lifted animate-pop-in"
      >
        <ComboboxViewport class="max-h-[60vh] p-1">
          <ComboboxEmpty v-if="!isFetching" class="px-3 py-2.5 text-sm text-ink-weak">{{ t('nav.search.noMatch') }}</ComboboxEmpty>
          <ComboboxItem
            v-for="item in results"
            :key="item.id"
            :value="item.id"
            class="flex h-12 cursor-pointer items-center gap-3 rounded-md px-2.5 outline-none data-highlighted:bg-hover"
          >
            <FilesFileIcon :kind="item.kind" />
            <div class="min-w-0">
              <p class="truncate text-base text-ink">{{ item.name }}</p>
              <p class="truncate text-sm text-ink-weak">{{ item.location ?? formatShortDate(item.updatedAt) }}</p>
            </div>
          </ComboboxItem>
          <ComboboxItem value="__all" class="mt-0.5 flex h-10 cursor-pointer items-center gap-3 rounded-md border-t border-line-weak px-2.5 text-base text-accent-ink outline-none data-highlighted:bg-hover">
            <Search class="size-4" aria-hidden="true" />
            <span class="flex-1 truncate">{{ t('nav.search.allResults', { query: query.trim() }) }}</span>
            <ArrowRight class="size-4" aria-hidden="true" />
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
