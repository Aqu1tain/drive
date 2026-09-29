import type { Catalog } from '..'
import type en from '../en/views'

export default {
  folder: {
    contents: 'Contenu de {name}',
    unnamed: 'dossier',
    this: 'ce dossier',
    denied: 'Accès refusé',
    deniedHint: 'Ce dossier ne vous est pas ou plus partagé.',
    missing: 'Dossier introuvable',
    missingHint: 'Il a peut-être été supprimé ou déplacé.',
    backToDrive: 'Retour à Mon Drive',
    backToShared: 'Retour aux partages',
    empty: 'Ce dossier est vide',
    emptyDrive: 'Votre Drive est vide',
    emptyHint: 'Déposez vos fichiers ici, ou créez un dossier pour commencer à ranger.',
    emptyShared: 'Aucun document ne vous est partagé ici pour l’instant.',
  },
  recent: {
    title: 'Récents',
    label: 'Fichiers récents',
    empty: 'Aucun fichier récent',
    emptyOwner: 'Les fichiers que vous importez, modifiez ou ouvrez apparaîtront ici.',
    emptyReader: 'Les documents que vous consultez apparaîtront ici.',
  },
  shared: {
    title: 'Partagés',
    label: 'Éléments partagés',
    empty: 'Aucun fichier partagé',
    emptyHint: 'Les fichiers que vous partagerez apparaîtront ici, avec les personnes qui y ont accès.',
  },
  sharedWithMe: {
    label: 'Documents partagés avec moi',
    heading: 'Documents auxquels vous avez accès',
    empty: 'Rien pour l’instant',
    emptyHint: 'Les documents que l’on vous partage apparaîtront ici.',
  },
  starred: {
    title: 'Favoris',
    empty: 'Aucun favori',
    emptyHint: 'Ajoutez une étoile à un fichier ou un dossier (touche S) pour le retrouver ici en un clic.',
  },
  trash: {
    title: 'Corbeille',
    notice: 'Les éléments restent ici jusqu’à leur suppression définitive. Ils ne sont plus accessibles aux personnes avec qui vous les aviez partagés.',
    empty: 'La corbeille est vide',
    emptyHint: 'Les éléments supprimés restent ici, restaurables, jusqu’à ce que vous les supprimiez définitivement.',
  },
  open: {
    denied: 'Vous n’avez pas ou plus accès à cet élément.',
    missing: 'Cet élément n’existe plus.',
    home: 'Retour à l’accueil',
  },
} satisfies Catalog<typeof en>
