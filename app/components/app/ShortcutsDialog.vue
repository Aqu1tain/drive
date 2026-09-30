<script setup lang="ts">
const props = defineProps<{ member: boolean }>()
const dialogs = useDialogs()
const { t } = useI18n()
const open = computed({ get: () => dialogs.state.shortcuts, set: value => (dialogs.state.shortcuts = value) })

const groups = computed(() => [
  {
    title: t('nav.shortcuts.general'),
    items: [
      ['Mod+K', t('nav.shortcuts.palette')],
      ['/', t('common.search')],
      ['Mod+/', t('nav.shortcuts.show')],
      ['Esc', t('nav.shortcuts.escape')],
    ],
  },
  {
    title: t('nav.shortcuts.files'),
    items: [
      ['↑+↓', t('nav.shortcuts.previousNext')],
      ['←+→', t('nav.shortcuts.grid')],
      ['Shift+↑', t('nav.shortcuts.extend')],
      ['Home+End', t('nav.shortcuts.firstLast')],
      ['Enter', t('common.open')],
      ['Space', t('nav.shortcuts.quickPreview')],
      ['Mod+A', t('nav.shortcuts.selectAll')],
      ['Shift+F10', t('nav.shortcuts.contextMenu')],
    ],
  },
  {
    title: t('nav.shortcuts.actions'),
    items: props.member
      ? [
          ['F2', t('common.rename')],
          ['S', t('nav.shortcuts.star')],
          ['L', t('nav.tags')],
          ['Delete', t('nav.shortcuts.trash')],
          ['Mod+Alt+A', t('common.share')],
        ]
      : [['S', t('nav.shortcuts.star')]],
  },
  {
    title: t('nav.shortcuts.fullPreview'),
    items: [
      ['←+→', t('nav.shortcuts.previousNextFile')],
      ['Esc', t('nav.shortcuts.closePreview')],
    ],
  },
])

/** Arrow pairs and Home/End are separate keys; modifier combinations read as one. */
const keysOf = (keys: string) => keys.includes('+') && !/^(Mod|Shift)\+/.test(keys) ? keys.split('+') : [keys]
</script>

<template>
  <UiDialog v-model:open="open" :title="t('nav.shortcuts.title')" size="lg">
    <div class="grid gap-x-8 gap-y-6 sm:grid-cols-2">
      <section v-for="group in groups" :key="group.title">
        <h3 class="mb-2 text-sm font-semibold text-ink-weak">{{ group.title }}</h3>
        <dl class="flex flex-col">
          <div v-for="[keys, label] in group.items" :key="label" class="flex items-center justify-between gap-4 border-b border-line-weak py-2 last:border-0">
            <dt class="text-base text-ink">{{ label }}</dt>
            <dd class="flex shrink-0 gap-1">
              <UiKbd v-for="key in keysOf(keys!)" :key="key" :keys="key" />
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </UiDialog>
</template>
