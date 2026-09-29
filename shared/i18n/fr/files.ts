import type { Catalog } from '..'
import type en from '../en/files'

export default {
  upload: 'Importer',
  uploadFiles: 'Importer des fichiers',
  newFolder: 'Nouveau dossier',
  columns: {
    location: 'Emplacement',
    access: 'Accès',
    modified: 'Modifié',
    deleted: 'Supprimé',
    size: 'Taille',
    viewed: 'Consulté',
    actions: 'Actions',
  },
  actionsFor: 'Actions pour {name}',
  favorite: 'Favori',
  selected: { one: '{count} sélectionné', other: '{count} sélectionnés' },
  selectedItems: { one: '{count} élément sélectionné', other: '{count} éléments sélectionnés' },
  clearSelection: 'Effacer la sélection',
  moreActions: 'Plus d’actions',
  layout: 'Affichage',
  list: 'Liste',
  grid: 'Grille',
  dropTo: 'Déposer pour importer dans',
  breadcrumb: 'Fil d’Ariane',
  hiddenFolders: 'Dossiers masqués',
  trashedFolder: {
    title: 'Ce dossier est dans la corbeille',
    browse: 'Restaurez-le pour parcourir son contenu.',
    recover: 'Restaurez-le pour retrouver son contenu.',
  },
  access: {
    private: 'Privé',
    public: 'Public',
    people: { one: '{count} personne', other: '{count} personnes' },
    invited: { one: '{count} invité', other: '{count} invités' },
    invitedPerson: '{name} (invité)',
    onlyYou: 'Visible uniquement par vous',
    anyoneWithLink: 'Toute personne disposant du lien',
    inherited: 'Hérité du dossier parent : {people}',
  },
} satisfies Catalog<typeof en>
