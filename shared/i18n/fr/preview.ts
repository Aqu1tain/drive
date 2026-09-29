import type { Catalog } from '..'
import type en from '../en/preview'

export default {
  title: 'Aperçu',
  close: 'Fermer l’aperçu',
  fullScreen: 'Plein écran',
  toPanel: 'Réduire en panneau',
  previous: 'Précédent',
  next: 'Suivant',
  previousItem: 'Précédent : {name}',
  nextItem: 'Suivant : {name}',
  unavailable: 'Aperçu indisponible',
  modified: 'Modifié {date}',
  converted: 'Aperçu converti, isolé du reste de l’application',
  interactive: 'Page interactive, isolée du reste de l’application',
  safe: 'Aperçu sécurisé : les scripts sont désactivés',
  newTab: 'Nouvel onglet',
  unsupported: 'Ce fichier ne peut pas être prévisualisé',
  downloadDisabled: 'Le téléchargement n’est pas autorisé pour ce partage.',
  page: 'Page {number}',
  pages: { one: '{count} page', other: '{count} pages' },
  truncated: 'Aperçu limité aux 512 premiers Ko.',
} satisfies Catalog<typeof en>
