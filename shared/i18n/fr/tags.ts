import type { Catalog } from '..'
import type en from '../en/tags'

export default {
  title: 'Étiquettes',
  named: 'Étiquettes : {names}',
  existing: 'Étiquettes existantes',
  none: 'Aucune étiquette pour l’instant. Créez la première ci-dessous.',
  newTag: 'Nouvelle étiquette',
  createFailed: 'Impossible de créer l’étiquette',
  applyFailed: 'Impossible de mettre à jour les étiquettes',
  edit: 'Modifier l’étiquette',
  editFailed: 'Impossible de modifier l’étiquette',
  color: 'Couleur',
  colors: {
    violet: 'Violet',
    blue: 'Bleu',
    turquoise: 'Turquoise',
    green: 'Vert',
    ochre: 'Ocre',
    orange: 'Orange',
    red: 'Rouge',
    pink: 'Rose',
  },
} satisfies Catalog<typeof en>
