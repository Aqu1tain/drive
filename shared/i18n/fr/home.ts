import type { Catalog } from '..'
import type en from '../en/home'

export default {
  title: 'Accueil',
  hello: 'Bonjour',
  evening: 'Bonsoir',
  ready: 'Votre espace est prêt',
  readyHint: 'Déposez vos premiers fichiers ou créez un dossier. Vous déciderez ensuite, précisément, qui peut voir quoi.',
  recentFolders: 'Dossiers récents',
  recentFiles: 'Fichiers récents',
  seeAll: 'Tout voir',
  viewedByOthers: 'Consulté par d’autres',
  noViews: 'Personne n’a encore consulté vos partages. Les consultations et téléchargements apparaîtront ici.',
} satisfies Catalog<typeof en>
