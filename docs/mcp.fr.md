[English](mcp.md) · **Français**

# Connecter un assistant IA (MCP)

Drive parle le [Model Context Protocol](https://modelcontextprotocol.io). Un assistant IA comme Claude Code, Claude.ai ou Cursor peut parcourir, chercher et lire votre espace, et l'assistant du propriétaire peut aussi le ranger.

L'assistant ne reçoit jamais de mot de passe. À sa première connexion, votre navigateur ouvre votre Drive : vous vous connectez comme d'habitude, une page montre quelle application demande l'accès et ce qu'elle pourra faire, et vous choisissez Autoriser ou Refuser. Ensuite, l'assistant agit en votre nom, avec exactement vos droits, et vous pouvez les lui retirer à tout moment.

Votre Drive doit être servi en HTTPS, ce qui est le cas avec un nom de domaine (`install.sh --domain`). En HTTP simple sur une adresse IP (`install.sh --ip`), le point d'accès MCP est désactivé : les jetons d'accès circuleraient en clair. Sur `localhost`, il fonctionne, pour le développement.

Dans les exemples ci-dessous, remplacez `https://drive.exemple.fr` par l'adresse de votre Drive.

## Claude Code

```bash
claude mcp add --transport http drive https://drive.exemple.fr/mcp
```

Lancez ensuite `/mcp` dans Claude Code, choisissez `drive` et authentifiez-vous. Votre navigateur ouvre la page de connexion de votre Drive, puis la page de consentement.

## Claude.ai

Dans Paramètres, Connecteurs, choisissez « Ajouter un connecteur personnalisé » et saisissez `https://drive.exemple.fr/mcp`. Laissez vides l'identifiant et le secret OAuth : Claude s'enregistre lui-même. Cliquez ensuite sur Connecter et autorisez l'accès. Claude.ai se connecte depuis les serveurs d'Anthropic : votre Drive doit donc être joignable depuis Internet.

## Cursor

Ajoutez le serveur dans `~/.cursor/mcp.json` (ou `.cursor/mcp.json` dans un projet) :

```json
{
  "mcpServers": {
    "drive": { "url": "https://drive.exemple.fr/mcp" }
  }
}
```

Cursor indique alors que le serveur demande une connexion : cliquez dessus pour ouvrir la page de consentement.

## Autres clients

Tout client qui prend en charge le transport Streamable HTTP et l'autorisation MCP fonctionne. Il trouvera tout seul ce qu'il lui faut à partir de la réponse `401` de `/mcp`, mais voici le détail :

| Quoi | Où |
|---|---|
| Point d'accès MCP | `POST /mcp`, sans état, réponses JSON |
| Métadonnées de la ressource protégée (RFC 9728) | `/.well-known/oauth-protected-resource` (aussi `/.well-known/oauth-protected-resource/mcp`) |
| Métadonnées du serveur d'autorisation (RFC 8414) | `/.well-known/oauth-authorization-server` (aussi `/.well-known/oauth-authorization-server/api/auth`) |
| Enregistrement dynamique des clients (RFC 7591) | `POST /api/auth/oauth2/register`, clients publics (`token_endpoint_auth_method: none`) ou confidentiels |
| Autorisation et jeton | `/api/auth/oauth2/authorize` avec PKCE (S256 uniquement), `/api/auth/oauth2/token` |

Envoyez l'indicateur de ressource `resource=https://drive.exemple.fr/mcp` (RFC 8707) lors de l'autorisation : `/mcp` refuse les jetons émis pour autre chose. Le seul scope est `offline_access`, qui apporte un jeton de rafraîchissement. Les jetons d'accès durent une heure, les jetons de rafraîchissement trente jours. Les jetons Bearer et les jetons liés par DPoP sont acceptés.

## Ce qu'un assistant peut faire

L'assistant agit au nom de la personne qui l'a autorisé, et chaque règle de l'application s'applique telle quelle.

| Outil | Propriétaire | Lecteur | Ce qu'il fait |
|---|---|---|---|
| `list_folder` | oui | oui | Liste un dossier, page par page. Sans dossier : Mon Drive pour le propriétaire, ce qui a été partagé avec lui pour un lecteur. |
| `search` | oui | oui | La même recherche que dans l'application : mots, `type:`, `after:`, `before:`, `in:`, et pour le propriétaire `access:`, `shared:`, `tag:`. Par pages aussi. |
| `get_item` | oui | oui | Détails et emplacement d'un élément ; pour le propriétaire, avec qui il est partagé et combien de fois il a été consulté. |
| `read_file` | oui | oui | Texte des fichiers texte, texte extrait des fichiers PDF, Word, Excel, PowerPoint et HTML, et images. |
| `create_folder` | oui | non | Crée un dossier. |
| `upload_text_file` | oui | non | Enregistre du texte dans un fichier, jusqu'à 1 Mo. |
| `update_text_file` | oui | non | Remplace le contenu d'un fichier texte existant ; dans un dossier avec historique des versions, l'ancien contenu est gardé. |
| `upload_file` | oui | non | Enregistre n'importe quel fichier à partir d'un contenu en base64, jusqu'à 10 Mo. |
| `copy` | oui | non | Copie des fichiers, à côté des originaux ou dans un dossier. |
| `rename` | oui | non | Renomme un fichier ou un dossier. |
| `move` | oui | non | Déplace des fichiers et des dossiers. |
| `move_to_trash` | oui | non | Met des éléments à la corbeille. |
| `list_trash` | oui | non | Liste le contenu de la corbeille. |
| `restore_from_trash` | oui | non | Remet des éléments de la corbeille à leur place. |
| `list_versions` | oui | non | Les versions précédentes d'un fichier, là où l'historique est activé. |
| `restore_version` | oui | non | Rend une version précédente de nouveau actuelle, en gardant l'actuelle comme version. |
| `list_activity` | oui | non | Le journal d'activité, pour tout l'espace ou pour un élément. |

Avec Drive pour les Organisations, l'assistant d'un membre a lui aussi ces outils, et chaque appel est vérifié comme dans l'application : il ne range que là où le membre peut modifier, et le journal complet reste aux propriétaires. L'assistant d'un lecteur ne voit même pas ces outils, et en appeler un échoue.

Chaque élément a un `type`, `file` ou `folder`, et un `kind` qui dit ce qu'il est (`pdf`, `image`, `spreadsheet`…). Les longues listes arrivent par pages : une réponse avec `nextCursor` en a d'autres, à redemander en le passant comme `cursor`.

La lecture suit la même règle que l'aperçu dans l'application : pouvoir ouvrir un élément suffit pour lire son texte. Une image, en revanche, est remise telle quelle, c'est donc une copie : il faut aussi le droit de télécharger. Quand le propriétaire a désactivé le téléchargement pour un partage, l'assistant obtient le texte des documents mais pas les images. Les textes longs arrivent en parties de 200 000 caractères au plus. Les documents de plus de 25 Mo et les images de plus de 5 Mo ne sont pas lus.

Aucun assistant ne peut partager un élément, changer qui y a accès ni supprimer quoi que ce soit définitivement. Gardez en tête que déplacer un élément dans un dossier partagé le partage avec les personnes de ce dossier, comme dans l'application.

Ce que lit l'assistant d'un lecteur apparaît dans le journal d'activité du propriétaire, par exemple « Alice via Claude Code ». L'assistant du propriétaire est traité comme lui : ses lectures ne sont pas journalisées, mais les fichiers lus apparaissent parmi les récents.

## Retirer un accès

Chaque personne gère les assistants qu'elle a autorisés dans Drive, sous Paramètres, Assistants IA : la liste montre chaque application avec sa date d'autorisation, et Déconnecter lui retire l'accès. La même chose est possible par l'API : `GET /api/connected-apps` les liste, `DELETE /api/connected-apps/<clientId>` en retire un.

Un assistant déconnecté cesse de fonctionner à sa requête suivante et doit redemander le consentement. Désactiver ou supprimer un lecteur, ou changer son mot de passe, retire aussi tous ses assistants. Retirer le serveur de l'assistant (par exemple `claude mcp remove drive`) ne fait qu'oublier le jeton de son côté : retirez-le aussi dans Drive.
