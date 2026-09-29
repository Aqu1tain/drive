[English](decisions.md) · **Français**

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
- Favoris : ceux du propriétaire restent une colonne de `resources` ; chaque lecteur a les siens dans `favorites`, qui ne touche pas au fichier. Il ne peut en poser que sur ce qu'il peut lire, et la liste de ses favoris re-résout l'accès : un partage retiré disparaît aussi de ses favoris.
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
- Au-delà de 8 Mo, le navigateur envoie le fichier en parties de 8 Mo : aucune requête ne dure assez longtemps pour atteindre la limite de 5 minutes de Node, même sur une connexion montante lente, et chacune est réessayée seule, reprise à la dernière partie reçue. Tout envoi, en une fois ou par partie, est réessayé 6 fois avec un délai croissant (une trentaine de secondes, de quoi traverser une coupure ou un redémarrage du serveur) ; il garde sa place dans la file pendant ce temps, pour qu'une panne ne fasse pas échouer tous les fichiers suivants en quelques secondes. Si la coupure survient après l'enregistrement, le nouvel essai trouve le fichier sous le même nom avec la même taille et le reconnaît au lieu d'en créer un second. Côté serveur, multipart natif S3 ou fichiers temporaires en local, parties reçues dans l'ordre pour calculer le hash au fil de l'eau. Les sessions vivent en mémoire (un seul processus) ; un redémarrage les perd et le client recommence, une tâche horaire abandonne celles restées inactives un jour.
- Le type MIME vient de la signature binaire quand elle existe (un exécutable renommé `.jpg` n'est jamais une image), sinon de l'extension.

Alternatives : BLOB PostgreSQL (base énorme, sauvegardes lentes), S3 seul (développement local plus lourd).

## Contenu actif (HTML, SVG)

- Jamais exécuté sur l'origine de l'application. Les réponses de contenu portent `Content-Security-Policy: sandbox` et `nosniff` ; le HTML y est servi en `text/plain`.
- Le HTML est rendu sur une origine distincte (`NUXT_PUBLIC_USERCONTENT_URL`), qui refuse toutes les routes de l'app et ne pose jamais de cookie. CSP `sandbox` (origine opaque) ; scripts autorisés uniquement si le propriétaire active « Page interactive ».
- En production, utiliser un domaine enregistrable distinct (ex. `drive-usercontent.net`).
- Les mutations exigent l'en-tête `Origin` de l'application (CSRF), y compris contre l'origine usercontent.
- sharp ne charge jamais de SVG (le chargeur est bloqué) : pas de miniature SVG.
- Un ZIP qui contient un `index.html` (à la racine ou dans un unique dossier de premier niveau) devient un site : ses fichiers sont extraits une fois dans le stockage (`site_files`, 2 000 fichiers et 200 Mo décompressés au plus, comptés pendant la décompression), puis servis un par un sur l'origine isolée, avec les mêmes règles que le HTML : sandbox, scripts seulement si le propriétaire le rend interactif, adresse publiée `/p/<jeton>/` quand un lien public existe. Les chemins qui pourraient sortir du site sont écartés à l'extraction. Les fichiers d'un site portent `Access-Control-Allow-Origin: *`, sans quoi les modules JavaScript et les `fetch` d'une page à l'origine opaque échoueraient ; ils ne sont joignables qu'avec un jeton. L'accès est vérifié avant de dire si un chemin existe.
- Les documents Office (docx, xlsx, pptx) sont convertis côté serveur en une page HTML autonome, servie sur la même origine isolée avec une CSP plus stricte encore : aucun script, aucune ressource externe (`default-src 'none'; img-src data:`), les liens s'ouvrent dans un nouvel onglet. Le texte des cellules et des paragraphes est échappé à la conversion.

## Recherche

`pg_trgm` sur une clé normalisée (minuscules, sans accents) : nom, dossiers englobants, personnes ayant accès (propriétaire). Filtres `type:`, `access:`, `shared:`, `after:`, `before:`, `in:` exposés aussi en chips.

Étiquettes : le propriétaire en pose autant qu'il veut sur ses fichiers et dossiers. Elles vivent dans `tags` (nom unique sans tenir compte de la casse, couleur d'une palette de huit) et chaque ressource porte `tag_ids uuid[]` avec un index GIN : toutes les listes existantes renvoient les étiquettes sans requête de plus, et `tag:"à relancer"` filtre la recherche. Supprimer une étiquette la retire des fichiers, sans rien toucher d'autre. Elles restent privées : aucun lecteur ne les voit ni ne peut les deviner, un `tag:` dans sa recherche ne renvoie rien.

Le texte des fichiers est aussi cherché : PDF (100 premières pages), Word, Excel, PowerPoint, HTML et fichiers texte. Il est normalisé comme les noms puis stocké en `tsvector` (configuration `simple`, sans racinisation, donc valable pour toutes les langues) dans une table à part, `resource_texts`, pour que les listes ne le chargent jamais. Chaque mot cherché doit commencer un mot du fichier : « factur » trouve « factures ». Un lecteur ne trouve que ce qu'il peut ouvrir, le texte ne sort jamais de la base.

## Traitement des fichiers

Après chaque upload, une file en mémoire (2 workers) dérive de la version du fichier : sa miniature (images avec sharp, première page des PDF avec pdf.js et @napi-rs/canvas), son texte pour la recherche et, pour les documents Office, une page d'aperçu. `processed_checksum` retient la version traitée : au démarrage, tout fichier dont la version n'a pas été traitée est remis en file, ce qui rattrape aussi les fichiers antérieurs à cette fonctionnalité. Si le fichier est remplacé pendant le traitement, le résultat est jeté.

Les fichiers de plus de 80 Mo ne sont pas traités. pdf.js tourne dans le processus du serveur, page par page ; un PDF piégé ne peut être déposé que par le propriétaire. Vidéo : pas de décodeur côté serveur (ffmpeg alourdirait l'image de plusieurs centaines de Mo). C'est le navigateur du propriétaire qui capture une image à une seconde, juste après l'upload à partir du fichier local, ou à la première ouverture pour les vidéos plus anciennes. Le serveur la réencode avec sharp comme n'importe quelle image (SVG refusé, 5 Mo maximum) : un lecteur ne peut jamais en envoyer.

## Journal d'activité

- Événements logiques : une consultation = un événement (déduplication 10 min par acteur), pas un par asset. Les requêtes `Range` de continuation ne comptent pas comme téléchargement.
- IP : préfixe /24 (IPv4) ou /48 (IPv6) haché avec HMAC, ou rien (`NUXT_ACTIVITY_IP_MODE=none`). Rétention configurable (`NUXT_ACTIVITY_RETENTION_DAYS`), purge quotidienne.
- Logs techniques séparés (stdout JSON : requestId, userId, resourceId, status, latence) avec jetons masqués.

## Langues

L'interface, les messages du serveur, les emails et les pages partagées existent en anglais et en français. L'anglais est la langue par défaut ; une instance peut choisir le français avec `DEFAULT_LOCALE` (écrit par `install.sh --lang fr`), et chaque navigateur peut choisir sa langue dans les paramètres, gardée dans un cookie `drive_locale`.

- Les catalogues vivent dans `shared/i18n`, un fichier par domaine et par langue. Les clés sont typées d'après le catalogue anglais et le français doit avoir la même forme : une traduction manquante est une erreur de compilation. Les pluriels passent par `Intl.PluralRules`, les nombres et les dates par `Intl` dans la langue courante.
- Pas de bibliothèque d'i18n : une centaine de lignes suffisent pour les recherches, les pluriels et les paramètres, et le même code tourne dans l'app, sur le serveur et dans les tests.
- Le serveur répond dans la langue de la requête (cookie, sinon celle de l'instance) grâce au contexte asynchrone de Nitro : les fonctions profondes rédigent leurs erreurs sans qu'on leur passe l'événement. Les emails suivent la langue de l'expéditeur. Les aperçus de documents sont faits en arrière-plan, dans la langue de l'instance.
- Le journal d'activité stocke les libellés fixes sous forme de jetons (`@public-link`…) et les nomme à la lecture, dans la langue du lecteur ; les lignes écrites avant contiennent des mots français, reconnus aussi.
- Les tests de bout en bout tournent en français (un cookie dans `playwright.config.ts`), avec un test pour l'anglais par défaut et le changement de langue.

## Migrations

Pré-démarrage en production (`scripts/migrate.mjs`) : Nitro 2 n'attend pas les plugins asynchrones. En dev, un plugin les applique au lancement.

## Limites connues

- « Téléchargement désactivé » est une dissuasion, pas un DRM : un aperçu transmet forcément le contenu au navigateur.

## Performance

Un dossier est chargé en une requête (tri et sélection instantanés côté client) et affiché en liste virtualisée. Mesures sur 10 000 fichiers en développement : API 170 ms, premier affichage 550 ms, 29 lignes dans le DOM, saut à la fin 60 ms, tout sélectionner 210 ms, tri 220 ms. Au-delà de quelques dizaines de milliers d'éléments par dossier, il faudra paginer côté serveur.
