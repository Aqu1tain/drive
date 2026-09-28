# Décisions structurantes

## Stack

Décision : Nuxt 4.5 (Vue 3, Nitro 2 / h3 v1) en TypeScript, PostgreSQL 17, Drizzle ORM, Better Auth, Tailwind 4, Reka UI, TanStack Query/Virtual. Le tout dockerisé.

Pourquoi :
- une seule application pour l'UI et l'API, un seul conteneur à déployer ;
- rendu hybride : l'app propriétaire est une SPA (`ssr: false`), les pages de partage public sont rendues côté serveur (premier affichage immédiat sur mobile, aperçus de lien) ;
- Drizzle reste proche du SQL : tableaux d'ancêtres, index GIN, `pg_trgm`, sous-requêtes corrélées sans lutter contre l'ORM.

Alternatives considérées : Next.js (équivalent, mais l'écosystème Vue/Reka était préféré), Prisma (génération de client et SQL avancé moins direct).

## Authentification

Décision : Better Auth 1.7 : email + mot de passe (scrypt), passkeys, TOTP, code de connexion par email. Inscription publique désactivée : les comptes ne sont créés que par le serveur (installation, acceptation d'invitation, action du propriétaire).

Pourquoi : sessions en base révocables, rate limiting, contrôle d'origine, plugins maintenus. Aucune primitive cryptographique réimplémentée.

Notes :
- `role` (`owner` | `reader`) et `status` (`active` | `disabled`) sont des champs serveur (`input: false`) ; un index unique partiel garantit un seul propriétaire ;
- l'IP client est calculée par l'application (en-tête interne `x-drive-client-ip`) et jamais reprise d'un en-tête fourni par le client, sauf `NUXT_TRUST_PROXY=true` derrière un proxy ;
- `NUXT_SETUP_TOKEN` protège optionnellement l'installation initiale.

## Modèle de données

- `resources` : fichiers et dossiers dans un arbre. `ancestor_ids uuid[]` (racine → parent) matérialise le chemin : sous-arbre = `ancestor_ids @> [id]` (index GIN), fil d'Ariane et héritage en une requête. Un déplacement réécrit le préfixe du sous-arbre en une requête.
- Unicité du nom (insensible à la casse) par dossier via index partiel (`deleted_at is null`) : aucun doublon silencieux, même en cas de course.
- `updated_at` n'est modifié que par les vraies modifications (contenu, renommage), jamais par une consultation ou un déplacement.
- Pas de table `uploads` : un upload est une requête unique en streaming, l'état de la file vit côté client.

## Permissions

Décision : un résolveur pur (`server/domain/access.ts`) testé unitairement, utilisé par tous les endpoints. Trois primitives : `read`, `download`, `manage`.

- `OWNER` → tout. `READER` → lecture/téléchargement si une règle valide s'applique. Anonyme → uniquement via un lien public valide.
- Héritage additif : une ressource cumule ses règles et celles de ses ancêtres, jusqu'au premier nœud qui coupe l'héritage (`inherit_access = false`).
- Une ressource (ou un ancêtre) dans la corbeille n'est plus accessible aux tiers.
- Règles : `user`, `invitation`, `link`. Pas de rôle Editor : il n'existe aucune règle d'écriture.
- Les endpoints d'écriture exigent `requireOwner`, indépendamment de l'UI.

## Invitations et liens

- Invitation « compte » : lien à usage unique qui crée un compte lecteur (email considéré vérifié : le lien a été remis à cette adresse). Ses règles deviennent des règles `user`.
- Invitation « lien personnel » : lien réutilisable, activité attribuée à l'invitation avec une mention honnête (le lien peut être transféré).
- Lien public : visiteur pseudonyme (cookie `drive_vid` aléatoire), jamais présenté comme identifié.
- Les jetons (192 bits) sont stockés hachés (recherche) et scellés AES-256-GCM (pour pouvoir recopier le lien). Un dump de base seul ne donne aucun lien fonctionnel.

## Révocation

Chaque requête re-résout l'accès. Aucune URL de stockage n'est exposée : le contenu passe toujours par l'API (proxy contrôlé, support `Range`). Les jetons d'aperçu HTML (30 min) portent l'identité, pas le droit : l'accès est revérifié à chaque requête.

## Stockage

Décision : abstraction `StorageProvider` (`put`, `get` avec plage, `size`, `delete`), implémentations filesystem et S3 (MinIO, R2, AWS…).

- Clés générées par le serveur (`blobs/8f/8f311e17-…`), le nom d'origine n'est qu'une métadonnée.
- Upload en streaming (`event.node.req`, contre-pression respectée), hash SHA-256 et détection de signature (file-type) à la volée.
- Au-delà de 32 Mo, le navigateur envoie le fichier en parties de 8 Mo : requêtes courtes, réessayées une à une (4 tentatives, délai croissant), reprise à la dernière partie reçue. Côté serveur, multipart natif S3 ou fichiers temporaires en local, parties reçues dans l'ordre pour calculer le hash au fil de l'eau. Les sessions vivent en mémoire (un seul processus) ; un redémarrage les perd et le client recommence, une tâche horaire abandonne celles restées inactives un jour.
- Le type MIME vient de la signature binaire quand elle existe (un exécutable renommé `.jpg` n'est jamais une image), sinon de l'extension.

Alternatives : BLOB PostgreSQL (base énorme, sauvegardes lentes), S3 seul (développement local plus lourd).

## Contenu actif (HTML, SVG)

- Jamais exécuté sur l'origine de l'application. Les réponses de contenu portent `Content-Security-Policy: sandbox` et `nosniff` ; le HTML y est servi en `text/plain`.
- Le HTML est rendu sur une origine distincte (`NUXT_PUBLIC_USERCONTENT_URL`), qui refuse toutes les routes de l'app et ne pose jamais de cookie. CSP `sandbox` (origine opaque) ; scripts autorisés uniquement si le propriétaire active « Page interactive ».
- En production, utiliser un domaine enregistrable distinct (ex. `drive-usercontent.net`).
- Les mutations exigent l'en-tête `Origin` de l'application (CSRF), y compris contre l'origine usercontent.
- sharp ne charge jamais de SVG (le chargeur est bloqué) : pas de miniature SVG.

## Recherche

`pg_trgm` sur une clé normalisée (minuscules, sans accents) : nom, dossiers englobants, personnes ayant accès (propriétaire). Filtres `type:`, `access:`, `shared:`, `after:`, `before:`, `in:` exposés aussi en chips. Le texte intégral (PDF, Office) pourra s'ajouter via une table d'index alimentée par un extracteur, sans changer l'API.

## Miniatures

File en mémoire (2 workers), relancée au démarrage pour les éléments `pending`. Images uniquement (sharp, orientation EXIF, métadonnées supprimées). PDF et vidéo : phase 2.

## Journal d'activité

- Événements logiques : une consultation = un événement (déduplication 10 min par acteur), pas un par asset. Les requêtes `Range` de continuation ne comptent pas comme téléchargement.
- IP : préfixe /24 (IPv4) ou /48 (IPv6) haché avec HMAC, ou rien (`NUXT_ACTIVITY_IP_MODE=none`). Rétention configurable (`NUXT_ACTIVITY_RETENTION_DAYS`), purge quotidienne.
- Logs techniques séparés (stdout JSON : requestId, userId, resourceId, status, latence) avec jetons masqués.

## Migrations

Pré-démarrage en production (`scripts/migrate.mjs`) : Nitro 2 n'attend pas les plugins asynchrones. En dev, un plugin les applique au lancement.

## Limites connues

- « Téléchargement désactivé » est une dissuasion, pas un DRM : un aperçu transmet forcément le contenu au navigateur.

## Performance

Un dossier est chargé en une requête (tri et sélection instantanés côté client) et affiché en liste virtualisée. Mesures sur 10 000 fichiers en développement : API 170 ms, premier affichage 550 ms, 29 lignes dans le DOM, saut à la fin 60 ms, tout sélectionner 210 ms, tri 220 ms. Au-delà de quelques dizaines de milliers d'éléments par dossier, il faudra paginer côté serveur.
