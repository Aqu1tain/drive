<script setup lang="ts">
const props = defineProps<{ owner: boolean }>()
const dialogs = useDialogs()
const open = computed({ get: () => dialogs.state.shortcuts, set: value => (dialogs.state.shortcuts = value) })

const groups = computed(() => [
  {
    title: 'Général',
    items: [
      ['Mod+K', 'Palette de commandes'],
      ['/', 'Rechercher'],
      ['Mod+/', 'Afficher les raccourcis'],
      ['Échap', 'Fermer le panneau, l’aperçu ou vider la sélection'],
    ],
  },
  {
    title: 'Navigation dans les fichiers',
    items: [
      ['↑+↓', 'Élément précédent / suivant'],
      ['←+→', 'Déplacement en grille'],
      ['Maj+↑', 'Étendre la sélection'],
      ['Home+End', 'Premier / dernier élément'],
      ['Entrée', 'Ouvrir'],
      ['Espace', 'Aperçu rapide'],
      ['Mod+A', 'Tout sélectionner'],
      ['Maj+F10', 'Menu contextuel'],
    ],
  },
  {
    title: 'Actions',
    items: props.owner
      ? [
          ['F2', 'Renommer'],
          ['S', 'Ajouter ou retirer des favoris'],
          ['L', 'Étiquettes'],
          ['Suppr', 'Déplacer vers la corbeille'],
          ['Mod+Alt+A', 'Partager'],
        ]
      : [['S', 'Ajouter ou retirer des favoris']],
  },
  {
    title: 'Aperçu plein écran',
    items: [
      ['←+→', 'Fichier précédent / suivant'],
      ['Échap', 'Fermer l’aperçu'],
    ],
  },
])
</script>

<template>
  <UiDialog v-model:open="open" title="Raccourcis clavier" size="lg">
    <div class="grid gap-x-8 gap-y-6 sm:grid-cols-2">
      <section v-for="group in groups" :key="group.title">
        <h3 class="mb-2 text-sm font-semibold text-ink-weak">{{ group.title }}</h3>
        <dl class="flex flex-col">
          <div v-for="[keys, label] in group.items" :key="label" class="flex items-center justify-between gap-4 border-b border-line-weak py-2 last:border-0">
            <dt class="text-base text-ink">{{ label }}</dt>
            <dd class="flex shrink-0 gap-1">
              <UiKbd v-for="key in keys!.includes('+') && !keys!.startsWith('Mod') && !keys!.startsWith('Maj') ? keys!.split('+') : [keys!]" :key="key" :keys="key" />
            </dd>
          </div>
        </dl>
      </section>
    </div>
  </UiDialog>
</template>
