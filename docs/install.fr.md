[English](install.md) · **Français**

# Installer Drive

Ce guide s'adresse autant à une personne qu'à un assistant IA qui agit sur un serveur. Chaque étape se termine par une vérification : ne passez à la suivante que si elle réussit.

## Ce qu'il faut

- Un serveur Linux 64 bits (x86_64 ou ARM64) avec au moins 1 Go de RAM libre et quelques Go de disque, plus la place pour vos fichiers.
- Un accès SSH avec un utilisateur qui peut utiliser `sudo`.
- Optionnel mais recommandé : un nom de domaine. Il vous faut deux noms qui pointent vers le serveur :
  - un pour l'application, par exemple `drive.exemple.fr` ;
  - un pour le contenu isolé (pages HTML déposées), par exemple `files.exemple.fr`. L'idéal est un domaine enregistrable distinct (`exemple-files.fr`), mais un sous-domaine fonctionne.

## Méthode rapide

```bash
curl -fsSL https://raw.githubusercontent.com/Aqu1tain/drive/main/install.sh | bash
```

Le script est interactif. Répondez aux questions, puis ouvrez l'adresse affichée à la fin pour créer votre compte propriétaire.

## Méthode pas à pas (recommandée pour un agent)

### 1. Installer Docker

```bash
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # puis reconnectez la session SSH
```

Vérification (doit afficher deux numéros de version, sans erreur de permission) :

```bash
docker version --format '{{.Server.Version}}' && docker compose version --short
```

### 2. Préparer le DNS (seulement avec un domaine)

Créez deux enregistrements `A` (et `AAAA` si vous avez de l'IPv6) vers l'adresse publique du serveur, puis ouvrez les ports 80 et 443.

```bash
curl -fsS https://api.ipify.org; echo            # adresse publique du serveur
getent hosts drive.exemple.fr files.exemple.fr   # doivent afficher cette même adresse
sudo ufw allow 80,443/tcp 2>/dev/null || true    # si ufw est actif
```

### 3. Télécharger Drive

```bash
git clone https://github.com/Aqu1tain/drive.git ~/drive && cd ~/drive
```

Vérification : `ls ~/drive/compose.yaml ~/drive/install.sh` ne renvoie pas d'erreur.

### 4. Configurer et démarrer

Avec un domaine :

```bash
~/drive/install.sh --domain drive.exemple.fr --content-domain files.exemple.fr --yes
```

Sans domaine (HTTP par IP, ports 3000 et 3001) :

```bash
~/drive/install.sh --ip --yes
```

Options utiles : `--smtp smtp://utilisateur:motdepasse@smtp.exemple.fr:587` pour envoyer les invitations par email, `--smtp-from "Drive <drive@exemple.fr>"`, `--name "Mon Drive"`, `--port 8080` si le port 3000 est déjà pris.

Le script écrit `~/drive/.env` (secrets générés aléatoirement), télécharge l'image, démarre les services et attend que l'application réponde.

Vérification :

```bash
cd ~/drive && docker compose ps                     # app, db et minio sont "healthy" (et caddy en mode domaine)
curl -fsS http://127.0.0.1:3000/api/setup; echo     # {"needed":true,"tokenRequired":true}
```

Avec un domaine, `curl -fsS https://drive.exemple.fr/api/setup` doit répondre la même chose (le certificat peut prendre une minute).

### 5. Créer le compte propriétaire

Le script affiche une adresse de la forme `https://drive.exemple.fr/setup?token=…`. Ouvrez-la dans un navigateur et créez le compte. Le jeton est aussi dans `~/drive/.env` (variable `SETUP_TOKEN`) ; il n'est plus utilisable une fois le propriétaire créé.

Vérification : `curl -fsS http://127.0.0.1:3000/api/setup` renvoie désormais `"needed":false`.

Un agent doit s'arrêter ici et laisser la personne créer son compte elle-même : c'est elle qui choisit son mot de passe.

## Configuration

Tout se règle dans `~/drive/.env`, puis `docker compose up -d` pour appliquer.

| Variable | Rôle | Défaut |
|---|---|---|
| `APP_URL` | Adresse publique de l'application | écrite par le script |
| `USERCONTENT_URL` | Adresse publique du contenu isolé | écrite par le script |
| `APP_DOMAIN`, `CONTENT_DOMAIN` | Domaines servis par Caddy en HTTPS | vides en mode IP |
| `COMPOSE_PROFILES` | `https` active Caddy | `https` en mode domaine |
| `APP_NAME` | Nom affiché dans l'interface et les emails | `Drive` |
| `DEFAULT_LOCALE` | Langue de l'interface pour qui n'en a pas choisi, ainsi que des emails et des pages partagées (`en` ou `fr`) | `en` |
| `SMTP_URL`, `SMTP_FROM` | Envoi des invitations et des codes de connexion | désactivé |
| `UPLOAD_MAX_BYTES` | Taille maximale d'un fichier | 5 Go |
| `STORAGE_QUOTA_BYTES` | Espace total autorisé | 100 Go |
| `ACTIVITY_RETENTION_DAYS` | Durée de conservation du journal d'activité | 365 |
| `ACTIVITY_IP_MODE` | `hash` (réseau haché) ou `none` | `hash` |
| `APP_BIND`, `APP_PORT`, `CONTENT_PORT` | Exposition directe des ports | `127.0.0.1`, 3000, 3001 |
| `TRUST_PROXY` | Faire confiance à `X-Forwarded-For` (derrière un proxy) | `true` en mode domaine |
| `S3_*` | Stockage S3 externe (R2, AWS, Scaleway…) au lieu de MinIO | MinIO intégré |

### Derrière votre propre reverse proxy

Si vous avez déjà Nginx, Traefik ou un Caddy existant : laissez `COMPOSE_PROFILES` vide, mettez `TRUST_PROXY=true`, et faites pointer vos deux domaines vers `127.0.0.1:3000` en conservant l'en-tête `Host` d'origine. Les deux domaines vont vers le même conteneur : c'est l'en-tête `Host` qui les distingue.

### Stockage S3 externe

Renseignez `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (et `S3_FORCE_PATH_STYLE=false` pour AWS). Le service `minio` peut alors être ignoré.

## Mettre à jour

```bash
~/drive/install.sh update
```

Les migrations de base de données s'appliquent automatiquement au démarrage.

## Sauvegarder et restaurer

```bash
~/drive/install.sh backup   # crée ~/drive/backups/AAAA-MM-JJ_HHMMSS/{database.sql.gz,files.tar.gz,env}
```

Copiez ce dossier hors du serveur (il contient vos secrets). Pour restaurer sur une nouvelle machine :

```bash
git clone https://github.com/Aqu1tain/drive.git ~/drive && cd ~/drive
cp /chemin/vers/sauvegarde/env .env
docker compose up -d db minio
gunzip -c /chemin/vers/sauvegarde/database.sql.gz | docker compose exec -T db psql -U drive -d drive
docker run --rm --volumes-from "$(docker compose ps -q minio)" -v /chemin/vers/sauvegarde:/backup alpine sh -c 'tar -C /data -xzf /backup/files.tar.gz'
docker compose up -d
```

## Dépannage

| Symptôme | Piste |
|---|---|
| `permission denied` avec Docker | `sudo usermod -aG docker $USER` puis reconnectez-vous |
| Le certificat HTTPS n'arrive pas | DNS pas encore propagé, ou ports 80/443 fermés. `docker compose logs caddy` |
| La page affiche une erreur réseau à l'enregistrement | `APP_URL` ne correspond pas à l'adresse utilisée dans le navigateur |
| Les pages HTML ne s'affichent pas | `USERCONTENT_URL` doit être joignable et différent de `APP_URL` |
| Pas d'email reçu | `SMTP_URL` vide ou invalide. Les liens d'invitation restent copiables depuis le dialogue de partage |
| Les clés d'accès ne fonctionnent pas | Elles exigent HTTPS : utilisez le mode domaine |

Journal de l'application : `~/drive/install.sh logs`.

## Désinstaller

```bash
~/drive/install.sh uninstall   # arrête Drive et supprime ses données après confirmation
```
