[English](README.md) · **Français**

<div align="center">

<img src="public/favicon.svg" width="64" height="64" alt="">

# Drive

**Votre espace de fichiers personnel. Vous déposez, vous rangez, vous décidez précisément qui voit quoi, et vous savez qui a consulté.**

Auto-hébergé, une commande pour l'installer sur n'importe quel serveur avec Docker.

<img src="docs/presentation.avif" alt="Présentation de Drive" width="100%">

</div>

## Le principe

Drive n'est pas un Drive collaboratif. Il y a **un seul propriétaire** : vous. Tous les autres sont **lecteurs** et ne peuvent jamais rien modifier, ni l'interface ni l'API ne le permettent.

- **Rangez** vos fichiers et dossiers comme dans un gestionnaire moderne : glisser-déposer, sélection multiple, clic droit, raccourcis clavier, palette de commandes (⌘K).
- **Partagez** un fichier ou un dossier avec une personne (compte lecteur), une invitation, un lien personnel ou un lien public. Téléchargement autorisé ou non, expiration, révocation immédiate.
- **Sachez qui a consulté** quoi et quand : un journal d'activité lisible, honnête sur ce qu'il sait (un lien public reste anonyme).
- **Publiez des pages HTML ou des sites entiers** (déposés en ZIP) en toute sécurité : ils s'affichent sur une origine isolée, en plein écran si vous le souhaitez.
- **Retrouvez** un fichier par son nom, ses étiquettes ou ce qu'il contient : texte des PDF, documents Word, classeurs Excel, présentations PowerPoint. Ces documents s'ouvrent aussi en aperçu, sans rien installer.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/preview.webp" alt="Aperçu rapide d'un PDF à côté de la liste"></td>
<td width="50%"><img src="docs/screenshots/share.webp" alt="Dialogue de partage"></td>
</tr>
<tr>
<td align="center"><sub>Aperçu rapide sans quitter la liste</sub></td>
<td align="center"><sub>Partage : personnes, héritage, lien public</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/palette.webp" alt="Palette de commandes"></td>
<td width="50%"><img src="docs/screenshots/dark-grid.webp" alt="Mode sombre en grille"></td>
</tr>
<tr>
<td align="center"><sub>Palette de commandes (⌘K)</sub></td>
<td align="center"><sub>Mode sombre, vue grille avec miniatures</sub></td>
</tr>
</table>

<p align="center"><img src="docs/screenshots/public-mobile.webp" alt="Lien partagé ouvert sur un téléphone" width="280"><br><sub>Ce que voit la personne qui reçoit un lien</sub></p>

## Installation

Il vous faut un serveur Linux (VPS, Raspberry Pi 4 ou plus, NAS, machine à la maison) avec 1 Go de RAM libre. Docker est installé automatiquement si besoin.

```bash
curl -fsSL https://raw.githubusercontent.com/Aqu1tain/drive/main/install.sh | bash
```

Le script vous pose deux ou trois questions (votre nom de domaine, optionnel), génère tous les secrets, démarre Drive et vous donne l'adresse pour créer votre compte propriétaire.

- **Avec un domaine** (recommandé) : faites pointer deux noms vers votre serveur, par exemple `drive.exemple.fr` et `files.exemple.fr`. Les certificats HTTPS sont obtenus et renouvelés automatiquement.
- **Sans domaine** : Drive est servi par adresse IP en HTTP, parfait pour essayer ou pour un réseau local.

Le guide détaillé, les options sans interaction et la configuration manuelle sont dans **[docs/install.fr.md](docs/install.fr.md)**.

### Installer avec un assistant IA

Le guide d'installation est écrit pour pouvoir être suivi par un agent (Claude Code, Codex, Cursor…) connecté à votre serveur. Donnez-lui simplement :

> Installe Drive sur ce serveur en suivant https://github.com/Aqu1tain/drive/blob/main/docs/install.fr.md. Mon domaine est drive.exemple.fr.

Chaque étape du guide se termine par une commande de vérification, pour que l'agent sache si elle a réussi.

### Au quotidien

```bash
~/drive/install.sh update    # mettre à jour
~/drive/install.sh backup    # sauvegarder la base, les fichiers et la configuration
~/drive/install.sh logs      # suivre le journal
~/drive/install.sh status    # état des services
```

## Sécurité, en bref

- Autorisation centralisée côté serveur : chaque requête recalcule les droits, une révocation prend effet immédiatement.
- Aucune URL de stockage exposée : tout passe par l'application, qui vérifie l'accès.
- Le HTML et le SVG ne s'exécutent jamais sur l'origine de l'application. Les pages web sont servies sur un domaine séparé, dans un bac à sable (CSP `sandbox`), sans cookies.
- CSP stricte à nonce, protection CSRF par origine, jetons de partage stockés hachés et chiffrés, mots de passe, clés d'accès (passkeys) et double authentification (TOTP).
- Journal d'activité sobre : adresses IP tronquées puis hachées (ou non enregistrées), durée de conservation configurable. Voir [docs/privacy.fr.md](docs/privacy.fr.md).

Signaler une faille : [SECURITY.fr.md](SECURITY.fr.md). Choix d'architecture : [docs/decisions.fr.md](docs/decisions.fr.md).

## Développement

```bash
pnpm install
cp .env.example .env                        # puis renseignez NUXT_AUTH_SECRET
docker compose -f compose.dev.yaml up -d    # Postgres, MinIO, Mailpit
pnpm dev                                    # http://localhost:3000
pnpm seed                                   # contenu de démonstration (optionnel)
```

| Commande | Rôle |
|---|---|
| `pnpm test:unit` | Résolveur de permissions, noms, recherche, cryptographie, lecture des documents |
| `pnpm test:integration` | API et base de données, scénarios de sécurité (serveur de dev lancé) |
| `pnpm test:e2e` | Parcours complets dans un navigateur, audit d'accessibilité axe |
| `pnpm typecheck` | Vérification TypeScript |

Stack : Nuxt 4, Vue 3, TypeScript, PostgreSQL 17, Drizzle, Better Auth, Tailwind 4, Reka UI, stockage S3 (MinIO par défaut) ou disque local. Conventions et repères pour contribuer : [AGENTS.md](AGENTS.md) (en anglais) et [docs/ux.fr.md](docs/ux.fr.md).

## Licence

[CC BY-NC-SA 4.0](LICENSE) : usage non commercial libre, modifications partagées sous la même licence. Pour un usage commercial, une licence payante est nécessaire : voir [COMMERCIAL.fr.md](COMMERCIAL.fr.md).
