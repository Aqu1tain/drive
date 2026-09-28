#!/usr/bin/env bash
# Drive: your own file space, on any server with Docker.
#
#   curl -fsSL https://raw.githubusercontent.com/Aqu1tain/drive/main/install.sh | bash
#
# Non-interactive (scripts, AI agents):
#   ./install.sh --domain drive.example.com --content-domain files.example.com --yes
#   ./install.sh --ip --yes
#
# Afterwards:  ./install.sh update | backup | status | logs | uninstall
set -euo pipefail

REPO_URL="${DRIVE_REPO:-https://github.com/Aqu1tain/drive.git}"
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)
if [ -z "${DRIVE_DIR:-}" ] && [ -f "$SCRIPT_DIR/compose.yaml" ] && [ -f "$SCRIPT_DIR/install.sh" ]; then
  INSTALL_DIR="$SCRIPT_DIR"
else
  INSTALL_DIR="${DRIVE_DIR:-$HOME/drive}"
fi
ASSUME_YES=0
MODE=""
APP_DOMAIN=""
CONTENT_DOMAIN=""
SMTP_URL=""
SMTP_FROM=""
APP_NAME="Drive"
APP_PORT="${APP_PORT:-3000}"
COMMAND="install"

step() { printf '\n\033[1;35m▸\033[0m \033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
info() { printf '  %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
fail() { printf '\n  \033[31m✗ %s\033[0m\n\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
  cat <<'EOF'

Options:
  --domain NAME           Domain of the app (HTTPS certificate issued automatically)
  --content-domain NAME   Domain for isolated user content (default: files.<domain>)
  --ip                    No domain: serve over HTTP by IP (app on --port, content on --port + 1)
  --smtp URL              smtp(s)://user:password@host:port to send invitations by email
  --smtp-from "Name <a@b>" Sender of the emails
  --name NAME             Name displayed in the interface (default: Drive)
  --port N                Local port of the app (default 3000); isolated content uses N+1
  --dir PATH              Installation directory (default: ~/drive)
  --yes                   Accept defaults, never prompt
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    install|update|backup|status|logs|uninstall) COMMAND="$1" ;;
    --domain) APP_DOMAIN="$2"; MODE="domain"; shift ;;
    --content-domain) CONTENT_DOMAIN="$2"; shift ;;
    --ip) MODE="ip" ;;
    --smtp) SMTP_URL="$2"; shift ;;
    --smtp-from) SMTP_FROM="$2"; shift ;;
    --name) APP_NAME="$2"; shift ;;
    --port) APP_PORT="$2"; shift ;;
    --dir) INSTALL_DIR="$2"; shift ;;
    --yes|-y) ASSUME_YES=1 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Option inconnue : $1 (voir --help)" ;;
  esac
  shift
done

ask() {
  local prompt=$1 default=${2:-} answer=""
  if [ "$ASSUME_YES" = 1 ] || [ ! -r /dev/tty ]; then printf '%s' "$default"; return; fi
  read -r -p "  $prompt${default:+ [$default]} : " answer < /dev/tty || true
  printf '%s' "${answer:-$default}"
}

confirm() {
  [ "$ASSUME_YES" = 1 ] && return 0
  local answer
  answer=$(ask "$1 (o/n)" "o")
  case "$answer" in o|O|oui|y|Y|yes) return 0 ;; *) return 1 ;; esac
}

random() {
  local length=$1
  if command -v openssl >/dev/null 2>&1; then openssl rand -base64 64 | tr -dc 'A-Za-z0-9' | head -c "$length"
  else tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$length"; fi
}

compose() { docker compose --project-directory "$INSTALL_DIR" -f "$INSTALL_DIR/compose.yaml" "$@"; }

env_get() { grep -E "^$1=" "$INSTALL_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2- || true; }

local_port() {
  local port
  port=$(env_get APP_PORT)
  printf '%s' "${port:-3000}"
}

public_ip() {
  curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1"
}

check_docker() {
  step "Vérification de Docker"
  if ! command -v docker >/dev/null 2>&1; then
    warn "Docker n'est pas installé."
    [ "$(uname -s)" = "Linux" ] || fail "Installez Docker Desktop (https://docs.docker.com/get-docker/) puis relancez ce script."
    confirm "Installer Docker maintenant avec le script officiel (get.docker.com) ?" || fail "Docker est nécessaire."
    curl -fsSL https://get.docker.com | sh
    command -v systemctl >/dev/null 2>&1 && sudo systemctl enable --now docker >/dev/null 2>&1 || true
  fi
  docker compose version >/dev/null 2>&1 || fail "Le plugin « docker compose » (v2) est introuvable. Mettez Docker à jour."
  if ! docker info >/dev/null 2>&1; then
    fail "Docker ne répond pas. Démarrez-le, ou ajoutez votre utilisateur au groupe docker : sudo usermod -aG docker \$USER (puis reconnectez-vous)."
  fi
  ok "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null) et Compose $(docker compose version --short 2>/dev/null)"
}

fetch_sources() {
  step "Récupération de Drive"
  if [ -f "$INSTALL_DIR/compose.yaml" ] && [ -f "$INSTALL_DIR/install.sh" ] && [ ! -d "$INSTALL_DIR/.git" ]; then
    ok "Sources présentes dans $INSTALL_DIR"
    return
  fi
  if [ -d "$INSTALL_DIR/.git" ]; then
    git -C "$INSTALL_DIR" pull --ff-only --quiet 2>/dev/null || warn "Mise à jour des sources impossible (modifications locales ?), version actuelle conservée"
    ok "Sources présentes dans $INSTALL_DIR"
    return
  fi
  command -v git >/dev/null 2>&1 || fail "git est nécessaire (apt install git, dnf install git…)."
  git clone --quiet --depth 1 "$REPO_URL" "$INSTALL_DIR"
  ok "Téléchargé dans $INSTALL_DIR"
}

configure() {
  step "Configuration"
  if [ -f "$INSTALL_DIR/.env" ] && [ -n "$(env_get AUTH_SECRET)" ]; then
    ok "Configuration existante conservée ($INSTALL_DIR/.env)"
    return
  fi

  if [ -z "$MODE" ]; then
    info "Avec un nom de domaine pointant vers ce serveur, Drive obtient un certificat HTTPS automatiquement."
    info "Sans domaine, il est servi en HTTP par adresse IP (pratique pour tester ou pour un réseau local)."
    APP_DOMAIN=$(ask "Nom de domaine (laisser vide pour une installation par IP)" "")
    MODE=$([ -n "$APP_DOMAIN" ] && echo domain || echo ip)
  fi

  local app_url usercontent_url bind="127.0.0.1" profiles="" trust_proxy=false
  if [ "$MODE" = "domain" ]; then
    [ -n "$APP_DOMAIN" ] || fail "--domain est requis en mode domaine."
    [ -n "$CONTENT_DOMAIN" ] || CONTENT_DOMAIN=$(ask "Domaine du contenu isolé (pages HTML)" "files.$APP_DOMAIN")
    app_url="https://$APP_DOMAIN"
    usercontent_url="https://$CONTENT_DOMAIN"
    profiles="https"
    trust_proxy=true
    local ip resolved
    ip=$(public_ip)
    for domain in "$APP_DOMAIN" "$CONTENT_DOMAIN"; do
      resolved=$(getent hosts "$domain" 2>/dev/null | awk '{print $1}' | head -1 || true)
      if [ -z "$resolved" ]; then warn "$domain ne résout pas encore. Créez un enregistrement DNS A vers $ip."
      elif [ "$resolved" != "$ip" ]; then warn "$domain pointe vers $resolved, ce serveur semble être $ip."
      else ok "$domain pointe bien vers ce serveur"; fi
    done
  else
    local ip
    ip=$(public_ip)
    ip=$(ask "Adresse IP ou nom d'hôte pour accéder au serveur" "$ip")
    app_url="http://$ip:$APP_PORT"
    usercontent_url="http://$ip:$((APP_PORT + 1))"
    bind="0.0.0.0"
    warn "Sans HTTPS, les clés d'accès (passkeys) ne sont pas disponibles. Préférez un domaine pour un usage réel."
  fi

  if [ -z "$SMTP_URL" ] && [ "$ASSUME_YES" = 0 ]; then
    info "Optionnel : un serveur SMTP permet d'envoyer les invitations par email. Sans lui, vous copiez les liens."
    SMTP_URL=$(ask "SMTP (smtp://utilisateur:motdepasse@hote:587), vide pour ignorer" "")
  fi
  [ -n "$SMTP_URL" ] && [ -z "$SMTP_FROM" ] && SMTP_FROM=$(ask "Expéditeur des emails" "$APP_NAME <drive@${APP_DOMAIN:-localhost}>")

  umask 077
  cat > "$INSTALL_DIR/.env" <<EOF
# Generated by install.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ). Keep this file private: it holds your secrets.
APP_NAME=$APP_NAME
APP_URL=$app_url
USERCONTENT_URL=$usercontent_url
APP_DOMAIN=$APP_DOMAIN
CONTENT_DOMAIN=$CONTENT_DOMAIN
APP_BIND=$bind
APP_PORT=$APP_PORT
CONTENT_PORT=$((APP_PORT + 1))
TRUST_PROXY=$trust_proxy
COMPOSE_PROFILES=$profiles

AUTH_SECRET=$(random 48)
SETUP_TOKEN=$(random 24)
POSTGRES_PASSWORD=$(random 32)
S3_SECRET_ACCESS_KEY=$(random 40)

SMTP_URL=$SMTP_URL
SMTP_FROM=${SMTP_FROM:-$APP_NAME <drive@localhost>}

# Privacy: days of activity history kept, and how IP addresses are stored (hash | none)
ACTIVITY_RETENTION_DAYS=365
ACTIVITY_IP_MODE=hash
EOF
  ok "Secrets générés, configuration écrite dans $INSTALL_DIR/.env"
}

start() {
  step "Démarrage"
  if compose pull --quiet app 2>/dev/null; then
    ok "Image téléchargée"
  else
    info "Image indisponible, compilation locale (quelques minutes)…"
    compose build app
  fi
  compose up -d --remove-orphans
  for _ in $(seq 1 90); do
    if curl -fsS --max-time 2 "http://127.0.0.1:$(local_port)/api/setup" >/dev/null 2>&1; then
      ok "Drive répond"
      return
    fi
    sleep 2
  done
  compose logs --tail 40 app || true
  fail "Drive n'a pas démarré. Journal ci-dessus ; relancez avec « ./install.sh logs »."
}

check_https() {
  [ -z "$(env_get APP_DOMAIN)" ] && return
  local url
  url=$(env_get APP_URL)
  for _ in $(seq 1 30); do
    curl -fsS --max-time 5 "$url/api/setup" >/dev/null 2>&1 && { ok "HTTPS actif sur $url"; return; }
    sleep 3
  done
  warn "HTTPS pas encore joignable. Vérifiez le DNS et que les ports 80 et 443 sont ouverts, puis patientez une minute."
}

summary() {
  local url token
  url=$(env_get APP_URL)
  token=$(env_get SETUP_TOKEN)
  printf '\n\033[1;32m  Drive est prêt.\033[0m\n\n'
  if curl -fsS --max-time 3 "http://127.0.0.1:$(local_port)/api/setup" 2>/dev/null | grep -q '"needed":true'; then
    info "1. Ouvrez           $url/setup?token=$token"
    info "2. Créez votre compte propriétaire (vous seul pourrez déposer et partager)."
  else
    info "Ouvrez              $url"
  fi
  printf '\n'
  info "Dossier             $INSTALL_DIR"
  info "Configuration       $INSTALL_DIR/.env"
  info "Mettre à jour       $INSTALL_DIR/install.sh update"
  info "Sauvegarder         $INSTALL_DIR/install.sh backup"
  info "Journal             $INSTALL_DIR/install.sh logs"
  printf '\n'
}

backup() {
  local target minio
  target="$INSTALL_DIR/backups/$(date +%Y-%m-%d_%H%M%S)"
  umask 077
  mkdir -p "$target"
  step "Sauvegarde vers $target"
  compose exec -T db pg_dump -U drive -d drive | gzip > "$target/database.sql.gz" || fail "Échec de la sauvegarde de la base"
  ok "Base de données"
  minio=$(compose ps -q minio)
  [ -n "$minio" ] || fail "Le service de stockage n'est pas démarré"
  docker run --rm --volumes-from "$minio:ro" alpine tar -C /data -czf - . > "$target/files.tar.gz" || fail "Échec de la sauvegarde des fichiers"
  ok "Fichiers ($(du -h "$target/files.tar.gz" | cut -f1))"
  cp "$INSTALL_DIR/.env" "$target/env"
  chmod 600 "$target/env"
  ok "Configuration (contient vos secrets, gardez-la en lieu sûr)"
  info "Restauration : voir docs/install.md, section « Restaurer une sauvegarde »."
}

case "$COMMAND" in
  install)
    printf '\n\033[1m  Drive · installation\033[0m\n'
    check_docker
    fetch_sources
    configure
    start
    check_https
    summary
    ;;
  update)
    check_docker
    step "Mise à jour"
    [ -d "$INSTALL_DIR/.git" ] && git -C "$INSTALL_DIR" pull --ff-only --quiet && ok "Sources à jour"
    start
    docker image prune -f >/dev/null 2>&1 || true
    ok "Drive est à jour"
    ;;
  backup) backup ;;
  status) compose ps ;;
  logs) compose logs -f --tail 100 app ;;
  uninstall)
    confirm "Arrêter Drive et SUPPRIMER toutes ses données (base, fichiers) ?" || exit 0
    compose down -v
    ok "Drive est arrêté et ses données sont supprimées. Le dossier $INSTALL_DIR reste en place."
    ;;
esac
