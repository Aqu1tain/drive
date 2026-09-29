import type { Catalog } from '..'
import type en from '../en/uploads'

export default {
  title: 'Imports',
  uploading: { one: 'Import de {count} fichier', other: 'Import de {count} fichiers' },
  uploadingTo: { one: 'Import de {count} fichier vers {folder}', other: 'Import de {count} fichiers vers {folder}' },
  failed: { one: '{count} import en erreur', other: '{count} imports en erreur' },
  done: { one: '{count} fichier importé', other: '{count} fichiers importés' },
  doneWithErrors: '{summary}, {count} en erreur',
  doneRenamed: {
    one: '{summary} ({count} renommé pour éviter un doublon)',
    other: '{summary} ({count} renommés pour éviter un doublon)',
  },
  show: 'Afficher',
  cancelAll: 'Tout annuler',
  expand: 'Déplier',
  collapse: 'Réduire',
  progress: 'Progression totale',
  percent: '{value} %',
  cancelFile: 'Annuler {name}',
  retryFile: 'Réessayer {name}',
  uploaded: 'Importé',
  error: 'L’import a échoué',
  interrupted: 'Connexion interrompue',
  offline: 'Vous êtes hors ligne',
  prepareFailed: 'Impossible de préparer l’import',
  prepareFolderFailed: 'Impossible de préparer l’import du dossier',
} satisfies Catalog<typeof en>
