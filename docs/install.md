**English** · [Français](install.fr.md)

# Installing Drive

This guide is meant for a person as much as for an AI assistant working on a server. Every step ends with a check: only move on to the next one if it passes.

## Requirements

- A 64-bit Linux server (x86_64 or ARM64) with at least 1 GB of free RAM and a few GB of disk, plus room for your files.
- SSH access with a user who can run `sudo`.
- Optional but recommended: a domain name. You need two names pointing to the server:
  - one for the application, for example `drive.example.com`;
  - one for isolated content (uploaded HTML pages), for example `files.example.com`. A separate registrable domain (`example-files.com`) is ideal, but a subdomain works.

## Quick method

```bash
curl -fsSL https://raw.githubusercontent.com/Aqu1tain/drive/main/install.sh | bash
```

The script is interactive. Answer the questions, then open the address printed at the end to create your owner account.

## Step by step (recommended for an agent)

### 1. Install Docker

```bash
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # then reconnect the SSH session
```

Check (must print two version numbers, with no permission error):

```bash
docker version --format '{{.Server.Version}}' && docker compose version --short
```

### 2. Set up DNS (only with a domain)

Create two `A` records (and `AAAA` if you have IPv6) pointing to the server's public address, then open ports 80 and 443.

```bash
curl -fsS https://api.ipify.org; echo            # public address of the server
getent hosts drive.example.com files.example.com # must print that same address
sudo ufw allow 80,443/tcp 2>/dev/null || true    # if ufw is active
```

### 3. Download Drive

```bash
git clone https://github.com/Aqu1tain/drive.git ~/drive && cd ~/drive
```

Check: `ls ~/drive/compose.yaml ~/drive/install.sh` returns no error.

### 4. Configure and start

With a domain:

```bash
~/drive/install.sh --domain drive.example.com --content-domain files.example.com --yes
```

Without a domain (HTTP by IP, ports 3000 and 3001):

```bash
~/drive/install.sh --ip --yes
```

Useful options: `--smtp smtp://user:password@smtp.example.com:587` to send invitations by email, `--smtp-from "Drive <drive@example.com>"`, `--name "My Drive"`, `--port 8080` if port 3000 is already taken.

The script writes `~/drive/.env` (randomly generated secrets), pulls the image, starts the services and waits for the application to respond.

Check:

```bash
cd ~/drive && docker compose ps                     # app, db and minio are "healthy" (and caddy in domain mode)
curl -fsS http://127.0.0.1:3000/api/setup; echo     # {"needed":true,"tokenRequired":true}
```

With a domain, `curl -fsS https://drive.example.com/api/setup` must return the same thing (the certificate can take a minute).

### 5. Create the owner account

The script prints an address like `https://drive.example.com/setup?token=…`. Open it in a browser and create the account. The token is also in `~/drive/.env` (variable `SETUP_TOKEN`); it can no longer be used once the owner exists.

Check: `curl -fsS http://127.0.0.1:3000/api/setup` now returns `"needed":false`.

An agent must stop here and let the person create the account themselves: they are the one who chooses the password.

## Configuration

Everything is set in `~/drive/.env`, then `docker compose up -d` applies it.

| Variable | Purpose | Default |
|---|---|---|
| `APP_URL` | Public address of the application | written by the script |
| `USERCONTENT_URL` | Public address of the isolated content | written by the script |
| `APP_DOMAIN`, `CONTENT_DOMAIN` | Domains served over HTTPS by Caddy | empty in IP mode |
| `COMPOSE_PROFILES` | `https` enables Caddy | `https` in domain mode |
| `APP_NAME` | Name shown in the interface and the emails | `Drive` |
| `DEFAULT_LOCALE` | Language of the interface for everyone who has not picked one, and of emails and shared pages (`en` or `fr`) | `en` |
| `SMTP_URL`, `SMTP_FROM` | Sending invitations and sign-in codes | disabled |
| `UPLOAD_MAX_BYTES` | Maximum size of a file | 5 GB |
| `STORAGE_QUOTA_BYTES` | Total space allowed | 100 GB |
| `ACTIVITY_RETENTION_DAYS` | How long the activity log is kept | 365 |
| `ACTIVITY_IP_MODE` | `hash` (hashed network) or `none` | `hash` |
| `APP_BIND`, `APP_PORT`, `CONTENT_PORT` | Direct port exposure | `127.0.0.1`, 3000, 3001 |
| `TRUST_PROXY` | Trust `X-Forwarded-For` (behind a proxy) | `true` in domain mode |
| `S3_*` | External S3 storage (R2, AWS, Scaleway…) instead of MinIO | built-in MinIO |

### Behind your own reverse proxy

If you already run Nginx, Traefik or your own Caddy: leave `COMPOSE_PROFILES` empty, set `TRUST_PROXY=true`, and point both domains to `127.0.0.1:3000`, keeping the original `Host` header. Both domains go to the same container: the `Host` header is what tells them apart.

### External S3 storage

Fill in `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (and `S3_FORCE_PATH_STYLE=false` for AWS). The `minio` service can then be ignored.

## Updating

```bash
~/drive/install.sh update
```

Database migrations are applied automatically at startup.

## Back up and restore

```bash
~/drive/install.sh backup   # creates ~/drive/backups/YYYY-MM-DD_HHMMSS/{database.sql.gz,files.tar.gz,env}
```

Copy this folder off the server (it contains your secrets). To restore on a new machine:

```bash
git clone https://github.com/Aqu1tain/drive.git ~/drive && cd ~/drive
cp /path/to/backup/env .env
docker compose up -d db minio
gunzip -c /path/to/backup/database.sql.gz | docker compose exec -T db psql -U drive -d drive
docker run --rm --volumes-from "$(docker compose ps -q minio)" -v /path/to/backup:/backup alpine sh -c 'tar -C /data -xzf /backup/files.tar.gz'
docker compose up -d
```

## Troubleshooting

| Symptom | What to check |
|---|---|
| `permission denied` with Docker | `sudo usermod -aG docker $USER` then log in again |
| The HTTPS certificate never arrives | DNS not propagated yet, or ports 80/443 closed. `docker compose logs caddy` |
| The page shows a network error when creating the account | `APP_URL` does not match the address used in the browser |
| HTML pages do not display | `USERCONTENT_URL` must be reachable and different from `APP_URL` |
| No email received | `SMTP_URL` empty or invalid. Invitation links can still be copied from the share dialog |
| Passkeys do not work | They require HTTPS: use domain mode |

Application logs: `~/drive/install.sh logs`.

## Uninstalling

```bash
~/drive/install.sh uninstall   # stops Drive and deletes its data after confirmation
```
