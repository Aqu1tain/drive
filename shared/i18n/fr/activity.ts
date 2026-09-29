import type { Catalog } from '..'
import type en from '../en/activity'

export default {
  title: 'Activité',
  intro: 'Qui a consulté quoi, et quand. Les visiteurs de liens publics restent anonymes.',
  filter: 'Filtrer l’activité',
  filters: {
    all: 'Tout',
    views: 'Consultations',
    downloads: 'Téléchargements',
    sharing: 'Partages',
  },
  empty: 'Aucune activité',
  emptyHint: 'Dès que quelqu’un consultera ou téléchargera un document partagé, vous le verrez ici.',
  showMore: 'Afficher plus',
  you: 'Vous',
  visitor: 'Un visiteur (lien public)',
  personalLink: '{name} (lien personnel)',
  verbs: {
    view: 'a consulté',
    download: 'a téléchargé',
    shareAdded: 'avez partagé avec {target}',
    shareRemoved: 'avez retiré l’accès de {target}',
    shareUpdated: 'avez modifié l’accès de {target}',
    inheritance: ': {target} pour',
    linkCreated: 'avez créé un lien public pour',
    linkUpdated: 'avez modifié le lien public de',
    linkRemoved: 'avez désactivé le lien public de',
    inviteAccepted: 'a accepté l’invitation à',
    accessDenied: 'a tenté d’accéder à',
  },
} satisfies Catalog<typeof en>
