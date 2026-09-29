# Guide pour les agents IA

Ce fichier aide un assistant (Claude Code, Codex, Cursor…) à installer, exploiter ou faire évoluer Drive.

## Installer Drive sur un serveur

Suivez [docs/install.md](docs/install.md), section « Méthode pas à pas ». Règles :

- Exécutez les commandes une par une et lancez la vérification de chaque étape avant de passer à la suivante.
- Utilisez le mode sans interaction : `./install.sh --domain … --content-domain … --yes` ou `./install.sh --ip --yes`.
- Ne créez pas le compte propriétaire à la place de la personne : donnez-lui l'adresse `…/setup?token=…` affichée par le script.
- Ne publiez jamais le contenu de `.env` (secrets) et ne le committez pas.
- En cas d'échec, lisez `./install.sh logs` et le tableau « Dépannage » de docs/install.md avant de modifier quoi que ce soit.

## Le produit en une phrase

Un seul propriétaire dépose, range et partage ; tous les autres sont lecteurs et ne modifient jamais rien. Toute fonctionnalité qui ne sert pas ce principe doit être remise en question.

## Carte du code

| Chemin | Contenu |
|---|---|
| `server/domain/access.ts` | Résolveur de permissions pur (lecture, téléchargement, gestion). Testé dans `tests/unit/access.test.ts` |
| `server/utils/` | Services auto-importés par Nitro : ressources, listing, partage, activité, contenu, recherche, uploads, traitement des fichiers |
| `server/lib/documents/` | Lecture des PDF et documents Office : texte, miniature, page d'aperçu (fonctions pures) |
| `server/api/` | Endpoints. Les écritures passent toutes par `requireOwner`, les lectures par `requireReadable` |
| `server/routes/c`, `server/routes/p` | Origine isolée pour le HTML (aperçus et pages publiées) |
| `server/lib/` | Stockage (local, S3), cryptographie, MIME, configuration Better Auth |
| `server/database/` | Schéma Drizzle et migrations SQL |
| `app/components/files/` | Navigateur de fichiers (liste et grille virtualisées, clavier, glisser-déposer) |
| `app/composables/useFileActions.ts` | Toutes les actions sur fichiers : menus, palette et raccourcis en dérivent |
| `app/assets/css/main.css` | Design tokens (clair et sombre). Aucune couleur brute dans les composants |
| `docs/decisions.md`, `docs/ux.md` | Décisions d'architecture et conventions d'interface à respecter |

## Invariants de sécurité

- Toute autorisation passe par le résolveur. Pas de `if (user.role …)` dispersés dans les endpoints.
- Aucun contenu actif (HTML, SVG) n'est rendu sur l'origine de l'application. Les pages HTML passent par l'origine `USERCONTENT_URL`, avec une CSP `sandbox`, sans cookies.
- Les noms de fichiers ne servent jamais de chemins : les clés de stockage sont générées par le serveur.
- Les jetons de partage sont stockés hachés (recherche) et scellés (affichage), jamais en clair.
- Une révocation doit prendre effet à la requête suivante : ne mettez pas en cache une décision d'accès.

## Développer

```bash
pnpm install
cp .env.example .env                        # renseigner NUXT_AUTH_SECRET
docker compose -f compose.dev.yaml up -d
pnpm dev
```

Avant de proposer une modification :

```bash
pnpm typecheck && pnpm test:unit
pnpm test:integration   # serveur de dev lancé
pnpm test:e2e           # parcours navigateur et audit axe
```

Conventions : TypeScript strict, code sans commentaires superflus, retours anticipés, fonctions courtes. Commits conventionnels et atomiques (`feat(share): …`, `fix(upload): …`). Textes de l'interface en français, sans tiret cadratin.
