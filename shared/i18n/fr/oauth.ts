import type { Catalog } from '..'
import type en from '../en/oauth'

export default {
  consent: {
    pageTitle: 'Autoriser l’accès',
    invalidTitle: 'Cette demande n’est plus valable',
    invalidHint: 'Recommencez la connexion depuis votre application d’IA.',
    unknownApp: 'Une application d’IA',
    heading: '{app} veut accéder à votre {drive}',
    signedInAs: 'Connecté en tant que {email}',
    ownerRead: 'Voir, chercher et lire tous vos fichiers et dossiers.',
    ownerOrganize: 'Ranger votre espace : créer des dossiers, enregistrer des fichiers texte, renommer, déplacer et mettre à la corbeille.',
    ownerLimits: 'Elle ne peut pas partager, changer qui a accès ni supprimer quoi que ce soit définitivement. Déplacer un élément dans un dossier partagé le partage bien avec les personnes de ce dossier.',
    readerRead: 'Voir, chercher et lire ce qui a été partagé avec vous.',
    readerLimits: 'Elle ne peut rien modifier. Ce qu’elle ouvre apparaît dans l’activité du propriétaire, comme quand vous ouvrez un fichier.',
    returnsTo: 'Autoriser vous renvoie vers {host}.',
    revokeAnytime: 'Vous pouvez retirer cet accès à tout moment.',
    failed: 'Une erreur est survenue. Réessayez, ou recommencez la connexion depuis votre application d’IA.',
    deny: 'Refuser',
    allow: 'Autoriser',
  },
  apps: {
    title: 'Assistants IA',
    description: 'Les applications comme Claude ou Cursor que vous avez autorisées à utiliser votre Drive par MCP. Elles agissent avec vos droits, jamais plus.',
    empty: 'Aucune application n’est connectée. Ajoutez {url} comme serveur MCP dans votre assistant pour en connecter une.',
    connectedOn: 'Connectée le {date}',
    revoke: 'Déconnecter',
    revokeLabel: 'Déconnecter {name}',
    revoked: '{name} n’a plus accès à votre Drive',
    unnamed: 'Application sans nom',
    guide: 'Connecter un assistant',
  },
} satisfies Catalog<typeof en>
