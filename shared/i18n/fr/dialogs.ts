import type { Catalog } from '..'
import type en from '../en/dialogs'

export default {
  conflict: {
    folderExists: 'Le dossier « {name} » existe déjà',
    fileExists: '« {name} » existe déjà',
    question: 'Que voulez-vous faire ?',
    label: 'Résolution du conflit',
    merge: 'Fusionner',
    mergeHint: 'Ajouter le contenu au dossier existant',
    replace: 'Remplacer',
    replaceHint: 'Le fichier existant est mis à jour, ses partages sont conservés',
    replaceKeepsVersion: 'Le fichier existant est mis à jour et garde ses partages ; l’actuel reste dans son historique des versions',
    keepBoth: 'Conserver les deux',
    keepFolderHint: 'Créer « {name} »',
    keepFileHint: 'Importer sous le nom « {name} »',
    skip: 'Ignorer',
    skipFolderHint: 'Ne pas importer ce dossier',
    skipFileHint: 'Ne pas importer ce fichier',
    applyToAll: { one: 'Appliquer aux {count} autre conflit', other: 'Appliquer aux {count} autres conflits' },
    skipAll: 'Tout ignorer',
  },
  move: {
    title: 'Déplacer « {name} »',
    titleMany: { one: 'Déplacer {count} élément', other: 'Déplacer {count} éléments' },
    parent: 'Dossier parent',
    location: 'Emplacement',
    folders: 'Dossiers',
    openFolder: 'Ouvrir {name}',
    noSubfolders: 'Aucun sous-dossier',
    folderName: 'Nom du dossier',
    newFolderName: 'Nom du nouveau dossier',
    newFolder: 'Nouveau dossier',
    submit: 'Déplacer ici',
  },
  newFolder: {
    title: 'Nouveau dossier',
    defaultName: 'Nouveau dossier',
    name: 'Nom du dossier',
    created: 'Dossier « {name} » créé',
    failed: 'Impossible de créer le dossier',
  },
  rename: {
    failed: 'Impossible de renommer',
  },
} satisfies Catalog<typeof en>
