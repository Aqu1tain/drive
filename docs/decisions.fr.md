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
- `role` (`owner` | `member` | `reader`) et `status` (`active` | `disabled`) sont des champs serveur (`input: false`) ; plusieurs propriétaires et des membres demandent une licence Drive pour les Organisations (voir plus bas) ;
- l'IP client est calculée par l'application (en-tête interne `x-drive-client-ip`) et jamais reprise d'un en-tête fourni par le client, sauf `NUXT_TRUST_PROXY=true` derrière un proxy ;
- `NUXT_SETUP_TOKEN` protège optionnellement l'installation initiale.

## Modèle de données

- `resources` : fichiers et dossiers dans un arbre. `ancestor_ids uuid[]` (racine → parent) matérialise le chemin : sous-arbre = `ancestor_ids @> [id]` (index GIN), fil d'Ariane et héritage en une requête. Un déplacement réécrit le préfixe du sous-arbre en une requête.
- Unicité du nom (insensible à la casse) par dossier via index partiel (`deleted_at is null`) : aucun doublon silencieux, même en cas de course.
- `updated_at` n'est modifié que par les vraies modifications (contenu, renommage), jamais par une consultation ou un déplacement.
- Pas de table `uploads` : un upload est une requête unique en streaming, l'état de la file vit côté client.

## Permissions

Décision : un résolveur pur (`server/domain/access.ts`) testé unitairement, utilisé par tous les endpoints. Quatre capacités : `read`, `download`, `edit`, `manage`.

- Propriétaire → tout. Membre → ce que ses partages permettent, selon le rôle (ci-dessous). Lecteur → lecture/téléchargement si une règle valide s'applique. Anonyme → uniquement via un lien public valide.
- Favoris et ouvertures récentes sont propres à chaque personne (`favorites`, `resource_opens`) et ne touchent jamais au fichier. On ne peut poser un favori que sur ce qu'on peut lire, et la liste des favoris re-résout l'accès : un partage retiré disparaît aussi des favoris.
- Héritage additif : une ressource cumule ses règles et celles de ses ancêtres, jusqu'au premier nœud qui coupe l'héritage (`inherit_access = false`).
- Une ressource (ou un ancêtre) dans la corbeille n'est plus accessible aux tiers, sauf à ceux qui peuvent la modifier, et seulement pour la restaurer ou la supprimer (option `trashed`).
- Règles : `user`, `invitation`, `link`, chacune avec un rôle : `viewer`, `editor` (ajoute `edit`) ou `manager` (ajoute `manage`). Le résolveur n'accorde `editor` et `manager` que sur une règle `user` d'un membre de l'organisation (`isMember` dans le contexte) : un lecteur, une invitation ou un lien ne font jamais que lire, quoi que dise la règle. Le rôle le plus élevé le long de la chaîne l'emporte.
- Chaque endpoint interroge le résolveur via `requireAccess(viewer, id, 'read' | 'edit' | 'manage')`, et les destinations passent par `requireFolder`, qui exige `edit` sur le dossier ; la racine du Drive appartient aux propriétaires. Les actions à l'échelle de l'organisation (personnes, paramètres, journal complet) utilisent `requireOwner`, les étiquettes et le sélecteur de personnes `requireMember`.

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

Étiquettes : propriétaires et membres en posent autant qu'ils veulent sur ce qu'ils peuvent modifier, et elles sont communes à toute l'organisation (seuls les propriétaires les renomment ou les suppriment). Elles vivent dans `tags` (nom unique sans tenir compte de la casse, couleur d'une palette de huit) et chaque ressource porte `tag_ids uuid[]` avec un index GIN : toutes les listes existantes renvoient les étiquettes sans requête de plus, et `tag:"à relancer"` filtre la recherche. Supprimer une étiquette la retire des fichiers, sans rien toucher d'autre. Elles restent privées : aucun lecteur ne les voit ni ne peut les deviner, un `tag:` dans sa recherche ne renvoie rien.

Le texte des fichiers est aussi cherché : PDF (100 premières pages), Word, Excel, PowerPoint, HTML et fichiers texte. Il est normalisé comme les noms puis stocké en `tsvector` (configuration `simple`, sans racinisation, donc valable pour toutes les langues) dans une table à part, `resource_texts`, pour que les listes ne le chargent jamais. Chaque mot cherché doit commencer un mot du fichier : « factur » trouve « factures ». Un lecteur ne trouve que ce qu'il peut ouvrir, le texte ne sort jamais de la base.

## Traitement des fichiers

Après chaque upload, une file en mémoire (2 workers) dérive de la version du fichier : sa miniature (images avec sharp, première page des PDF avec pdf.js et @napi-rs/canvas), son texte pour la recherche et, pour les documents Office, une page d'aperçu. `processed_checksum` retient la version traitée : au démarrage, tout fichier dont la version n'a pas été traitée est remis en file, ce qui rattrape aussi les fichiers antérieurs à cette fonctionnalité. Si le fichier est remplacé pendant le traitement, le résultat est jeté.

Les fichiers de plus de 80 Mo ne sont pas traités. pdf.js tourne dans le processus du serveur, page par page ; un PDF piégé ne peut être déposé que par le propriétaire. Vidéo : pas de décodeur côté serveur (ffmpeg alourdirait l'image de plusieurs centaines de Mo). C'est le navigateur du propriétaire qui capture une image à une seconde, juste après l'upload à partir du fichier local, ou à la première ouverture pour les vidéos plus anciennes. Le serveur la réencode avec sharp comme n'importe quelle image (SVG refusé, 5 Mo maximum) : un lecteur ne peut jamais en envoyer.

## Journal d'activité

- Événements logiques : une consultation = un événement (déduplication 10 min par acteur), pas un par asset. Les requêtes `Range` de continuation ne comptent pas comme téléchargement.
- IP : préfixe /24 (IPv4) ou /48 (IPv6) haché avec HMAC, ou rien (`NUXT_ACTIVITY_IP_MODE=none`). Rétention configurable (`NUXT_ACTIVITY_RETENTION_DAYS`), purge quotidienne.
- Logs techniques séparés (stdout JSON : requestId, userId, resourceId, status, latence) avec jetons masqués.

## Historique des versions

Activé par dossier et hérité par ses sous-dossiers : `resources.versioning` vaut vrai, faux ou null (suivre le parent), et un dossier qui correspond à ce qu'il hériterait enregistre null, pour que l'interrupteur ne laisse jamais de choix périmés. Rien n'est activé par défaut. Désactiver garde les versions existantes.

- Une version naît quand un fichier est remplacé (import avec « Remplacer », ou « Importer une nouvelle version ») dans un dossier dont l'historique est activé, sauf si le nouveau contenu est identique. L'ancien blob est gardé dans `file_versions` au lieu d'être supprimé ; miniatures et aperçus ne sont faits que pour la version actuelle. Le fichier garde son identifiant, son nom et ses partages.
- Restaurer ne perd jamais rien : le contenu actuel rejoint l'historique avant que la version choisie prenne sa place, quel que soit le réglage du dossier.
- Le nettoyage suit l'idée de SharePoint et de Nextcloud : la valeur d'une vieille version tient à l'état qu'elle capture. Toutes les versions du dernier jour, puis la dernière de chaque jour pendant un mois, puis une par semaine, 100 par fichier au plus. Une version nommée n'est jamais supprimée automatiquement (la règle de Nextcloud). Une tâche quotidienne et chaque nouvelle version appliquent la règle.
- Les versions comptent dans l'espace utilisé, et supprimer un fichier définitivement les supprime. Elles appartiennent au propriétaire : lecteurs, liens et assistants ne voient que le contenu actuel.
- Recherche derrière l'interface : Google Drive (gérer les versions, conserver indéfiniment), Dropbox (aperçu puis retour en arrière), Proton Drive (restaurer garde les versions plus récentes), Nextcloud (versions nommées), SharePoint (allègement automatique), Figma (jalons nommés).

## Langues

L'interface, les messages du serveur, les emails et les pages partagées existent en anglais et en français. L'anglais est la langue par défaut ; une instance peut choisir le français avec `DEFAULT_LOCALE` (écrit par `install.sh --lang fr`), et chaque navigateur peut choisir sa langue dans les paramètres, gardée dans un cookie `drive_locale`.

- Les catalogues vivent dans `shared/i18n`, un fichier par domaine et par langue. Les clés sont typées d'après le catalogue anglais et le français doit avoir la même forme : une traduction manquante est une erreur de compilation. Les pluriels passent par `Intl.PluralRules`, les nombres et les dates par `Intl` dans la langue courante.
- Pas de bibliothèque d'i18n : une centaine de lignes suffisent pour les recherches, les pluriels et les paramètres, et le même code tourne dans l'app, sur le serveur et dans les tests.
- Le serveur répond dans la langue de la requête (cookie, sinon celle de l'instance) grâce au contexte asynchrone de Nitro : les fonctions profondes rédigent leurs erreurs sans qu'on leur passe l'événement. Les emails suivent la langue de l'expéditeur. Les aperçus de documents sont faits en arrière-plan, dans la langue de l'instance.
- Le journal d'activité stocke les libellés fixes sous forme de jetons (`@public-link`…) et les nomme à la lecture, dans la langue du lecteur ; les lignes écrites avant contiennent des mots français, reconnus aussi.
- Les tests de bout en bout tournent en français (un cookie dans `playwright.config.ts`), avec un test pour l'anglais par défaut et le changement de langue.

## Assistants IA (MCP)

Décision : un serveur MCP sur `/mcp` (Streamable HTTP, sans état, réponses JSON), et Better Auth comme serveur d'autorisation OAuth 2.1 grâce à `@better-auth/mcp` : découverte (RFC 8414, RFC 9728), enregistrement dynamique des clients, code d'autorisation avec PKCE, jetons liés à la ressource `/mcp` (RFC 8707). Guide : [docs/mcp.md](mcp.md).

- Chaque requête reconstruit le même `Viewer` que l'application pour la personne qui a autorisé l'app, compte actif exigé. Les outils appellent les services existants (`listFolder`, `searchResources`, `requireReadable`…) : le MCP n'a aucune règle d'accès à lui. Les outils d'organisation sont enregistrés pour les propriétaires et les membres, et chaque appel est vérifié par le résolveur : l'assistant d'un membre ne range que là où le membre peut modifier ou gérer. Un lecteur ne les voit pas et ne peut pas les appeler.
- Jetons d'accès opaques (1 h), stockés hachés comme nos autres jetons, plutôt que des JWT : un JWT resterait valable jusqu'à son expiration et obligerait le serveur à relire ses propres clés par HTTP. Chaque appel vérifie en base le jeton, son audience, l'app, le compte et le consentement : une révocation prend effet à la requête suivante, quel que soit le chemin qui retire le consentement. Les jetons de rafraîchissement (30 jours) sont hachés et tournants.
- Les clients n'appartiennent à personne (la création de clients depuis une session est refusée) ; consentements et jetons appartiennent à une personne. Désactiver ou supprimer un lecteur, ou changer son mot de passe, retire aussi ses apps.
- Connexion par la page `/login` habituelle, puis page de consentement. Jamais d'approbation automatique (pas de `skip_consent`) ; un consentement vaut pour cette app jusqu'à sa révocation. Le nom de l'app est déclaré par l'app elle-même : la page montre aussi l'adresse où elle renvoie.
- Lecture : le droit d'aperçu suffit pour le texte (fichiers texte, texte extrait des PDF et documents Office), puisque l'aperçu l'affiche déjà. Une image est remise telle quelle, c'est une copie : il faut aussi le droit de télécharger. Au plus 200 000 caractères par appel (suite avec `offset`), documents de 25 Mo et images de 5 Mo.
- Journal : une lecture passe par `logAccess`, comme l'ouverture d'un aperçu, avec l'acteur « Alice via Claude Code » ; la déduplication distingue la personne de son assistant. Les lectures de l'assistant du propriétaire ne sont pas journalisées, comme les siennes.
- Aucun outil de partage, de changement d'accès ni de suppression définitive, seulement la corbeille. Déplacer un élément dans un dossier partagé le partage, comme dans l'app : l'outil et la page de consentement le disent.
- CSRF : `/mcp` n'est pas sous `/api/` et n'utilise aucun cookie, seulement le jeton. Seuls `/api/auth/oauth2/token` et `/api/auth/oauth2/register` échappent au contrôle d'`Origin` : ils ne s'appuient sur aucun cookie (vérificateur PKCE, identifiants du client, enregistrement anonyme). `/mcp` et la découverte ne répondent que sur l'origine de l'application.
- HTTPS obligatoire, sauf sur `localhost` en développement : en HTTP sur une IP, `/mcp` et la découverte répondent 404.
- Les clients MCP ne déclarent pas `application_type` ; traités en apps web, leurs adresses de retour locales (`http://127.0.0.1:…`) seraient refusées. Un enregistrement sans type est donc celui d'une app native.

## Organisations

Décision : une organisation par installation. L'édition personnelle est simplement une organisation avec un seul propriétaire : il n'y a qu'un chemin de code, et une licence ne fait qu'ouvrir des places.

- Les membres travaillent par des partages avec un rôle, et rien d'autre : pas d'objet « espace » à part. Un membre commence avec son propre dossier à la racine du Drive (un partage `manager`), que les propriétaires voient comme le reste. Le « Mon Drive » d'un membre liste les éléments de plus haut niveau partagés avec lui.
- Les propriétaires administrent : ils voient chaque fichier, gèrent les personnes, les rôles et les places. Personne ne change son propre rôle, donc un Drive garde toujours un propriétaire.
- Les éléments portent `canEdit` et `canManage` : menus, raccourcis, glisser-déposer et panneau de détails les suivent, et le serveur vérifie de toute façon. Les résumés d'accès et l'activité n'apparaissent que sur ce que la personne gère.
- Les consultations des propriétaires et des membres ne sont pas journalisées et ne font pas bouger « Consulté » : le journal reste celui des personnes extérieures à l'organisation. Elles alimentent seulement les « Récents » de chacun.
- Clés de licence : `payload.signature` en base64url, une signature Ed25519 de `{ v, id, org, seats, exp }`. La clé publique est dans `server/lib/license.ts` et la vérification se fait hors ligne, sans aucun appel réseau ; la clé privée reste chez le concédant (`scripts/issue-license.mjs`). La clé se configure avec `NUXT_LICENSE_KEY` (`./install.sh license CLÉ`).
- Les places comptent les propriétaires et membres actifs ; les lecteurs sont gratuits. Sans licence valide, il y a une place. Ajouter un propriétaire ou un membre, le réactiver, ou donner un rôle `editor` ou `manager` exige une licence active avec une place libre.
- L'expiration ne retire jamais rien : pendant 14 jours de grâce tout fonctionne, ensuite seuls l'ajout de personnes et de rôles attendent un renouvellement. Les rôles existants continuent de fonctionner, car le résolveur ne regarde pas la licence.

## Migrations

Pré-démarrage en production (`scripts/migrate.mjs`) : Nitro 2 n'attend pas les plugins asynchrones. En dev, un plugin les applique au lancement.

## Limites connues

- « Téléchargement désactivé » est une dissuasion, pas un DRM : un aperçu transmet forcément le contenu au navigateur.

## Performance

Un dossier est chargé en une requête (tri et sélection instantanés côté client) et affiché en liste virtualisée. Mesures sur 10 000 fichiers en développement : API 170 ms, premier affichage 550 ms, 29 lignes dans le DOM, saut à la fin 60 ms, tout sélectionner 210 ms, tri 220 ms. Au-delà de quelques dizaines de milliers d'éléments par dossier, il faudra paginer côté serveur.
