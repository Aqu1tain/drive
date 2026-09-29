import type { Catalog } from '..'
import type en from '../en/publicPage'

export default {
  signIn: 'Se connecter',
  share: 'Partage',
  sharedWithYou: 'Documents partagés avec vous',
  sharedBy: 'Partagé par {name}',
  ogTitle: '{title}, partagé par {name}',
  sharedFile: '{name} vous a partagé un document.',
  sharedFiles: '{name} vous a partagé des documents.',
  hello: 'Bonjour',
  helloName: 'Bonjour {name}',
  sharedThese: '{name} a partagé ces documents avec vous.',
  downloadAll: 'Tout télécharger',
  viewOnly: 'Consultation seule',
  previewUnavailable: 'Aperçu indisponible pour le moment.',
  emptyForNow: 'Ce dossier est vide pour le moment.',
  empty: 'Ce dossier est vide.',
  personal: 'Ce lien vous est personnel : vos consultations sont associées à votre invitation.',
  folder: 'Dossier',
  downloadFile: 'Télécharger {name}',
  breadcrumb: 'Fil d’Ariane',
  gone: 'Ce lien n’est plus actif',
  goneText: 'Il a expiré ou a été désactivé par la personne qui l’a partagé. Demandez-lui un nouveau lien.',
  notFound: 'Lien introuvable',
  notFoundText: 'Vérifiez l’adresse, ou demandez un nouveau lien à la personne qui vous l’a envoyé.',
} satisfies Catalog<typeof en>
