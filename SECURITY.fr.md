[English](SECURITY.md) · **Français**

# Sécurité

## Signaler une vulnérabilité

Merci de ne pas ouvrir d'issue publique. Utilisez l'onglet **Security → Report a vulnerability** du dépôt GitHub (signalement privé), ou écrivez à [contact@corentinrenard.com](mailto:contact@corentinrenard.com). Indiquez la version, les étapes pour reproduire et l'impact estimé. Vous recevrez une réponse dès que possible.

## Modèle de sécurité

- Un seul compte propriétaire ; tous les autres comptes sont lecteurs. Aucune opération d'écriture sur les fichiers, dossiers ou partages n'est possible pour un lecteur, quelle que soit la requête envoyée. Il ne peut modifier que ce qui n'appartient qu'à lui : son profil, sa sécurité de connexion et ses favoris, et seulement sur ce qu'il peut lire.
- Chaque accès est recalculé à chaque requête par un résolveur unique (`server/domain/access.ts`), couvert par des tests unitaires et d'intégration.
- Le contenu actif (HTML, SVG) n'est jamais exécuté sur l'origine de l'application. Les pages HTML sont servies sur une origine distincte, dans un bac à sable CSP, sans cookies.
- Les mutations exigent l'en-tête `Origin` de l'application (CSRF).
- Les jetons de partage sont hachés en base et scellés en AES-256-GCM ; les mots de passe sont hachés par Better Auth (scrypt) ; passkeys et TOTP sont disponibles.
- Les fichiers sont stockés sous des clés générées par le serveur, jamais sous le nom fourni.

Les limites connues sont listées dans [docs/decisions.fr.md](docs/decisions.fr.md).
