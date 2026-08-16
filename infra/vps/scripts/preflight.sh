#!/bin/sh
set -eu

root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
env_file="${1:-$root/runtime.env}"

if [ ! -f "$env_file" ]; then
    echo "preflight: runtime.env is missing (copy .env.example outside Git)" >&2
    exit 78
fi

if command -v stat >/dev/null 2>&1; then
    mode="$(stat -c '%a' "$env_file" 2>/dev/null || true)"
    if [ -n "$mode" ] && [ "$mode" != "600" ]; then
        echo "preflight: runtime.env must be mode 0600" >&2
        exit 78
    fi
fi

set -a
. "$env_file"
set +a

for name in BRAIN_DOMAIN ACME_EMAIL SECRETS_DIR BRAIN_PRIVATE_DIR BACKUP_DIR CADDY_IMAGE MYSQL_IMAGE; do
    eval "value=\${$name:-}"
    if [ -z "$value" ] || printf '%s' "$value" | grep -q 'example\.com'; then
        echo "preflight: $name is missing or still an example value" >&2
        exit 78
    fi
done

printf '%s\n' "$CADDY_IMAGE" | grep -Eq '^caddy@sha256:[0-9a-f]{64}$' || {
    echo "preflight: CADDY_IMAGE is not pinned by digest" >&2; exit 78;
}
printf '%s\n' "$MYSQL_IMAGE" | grep -Eq '^mysql@sha256:[0-9a-f]{64}$' || {
    echo "preflight: MYSQL_IMAGE is not pinned by digest" >&2; exit 78;
}

case "$BRAIN_DOMAIN" in
  *.*) ;;
  *) echo "preflight: BRAIN_DOMAIN must be a DNS name, not an IP" >&2; exit 78 ;;
esac

for file in mysql_app_password mysql_root_password backup_age_recipient desk.config.php; do
    if [ ! -s "$SECRETS_DIR/$file" ]; then
        echo "preflight: missing $SECRETS_DIR/$file" >&2
        exit 78
    fi
    if command -v stat >/dev/null 2>&1; then
        mode="$(stat -c '%a' "$SECRETS_DIR/$file" 2>/dev/null || true)"
        if [ -n "$mode" ] && [ "$mode" != "600" ]; then
            echo "preflight: $SECRETS_DIR/$file must be mode 0600" >&2
            exit 78
        fi
    fi
done

if grep -Eqi 'change-me|example\.com|your[-_ ]?(token|secret|password)' "$SECRETS_DIR/desk.config.php"; then
    echo "preflight: Desk configuration still contains a placeholder" >&2
    exit 78
fi

if ! grep -Eq '^age1[[:alnum:]]+$' "$SECRETS_DIR/backup_age_recipient" \
    || grep -Eqi 'replace|example|change-me' "$SECRETS_DIR/backup_age_recipient"; then
    echo "preflight: backup age recipient is invalid or still a placeholder" >&2
    exit 78
fi

for dir in "$BRAIN_PRIVATE_DIR/wiki" "$BRAIN_PRIVATE_DIR/raw/_inbox" "$BACKUP_DIR"; do
    if [ ! -d "$dir" ]; then
        echo "preflight: missing directory $dir" >&2
        exit 78
    fi
done

if [ ! -s "$(dirname "$env_file")/image-digests" ] \
    || ! grep -Eq '^CADDY_IMAGE=.*@sha256:[0-9a-f]{64}$' "$(dirname "$env_file")/image-digests" \
    || ! grep -Eq '^MYSQL_IMAGE=.*@sha256:[0-9a-f]{64}$' "$(dirname "$env_file")/image-digests"; then
    echo "preflight: root-recorded image digests are required" >&2
    exit 78
fi

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    echo "preflight: Docker Compose v2 is required" >&2
    exit 78
fi

APP_IMAGE="${APP_IMAGE:-secondbrain-app:0000000000000000000000000000000000000000}"
export APP_IMAGE
docker compose --env-file "$env_file" -f "$root/compose.yml" config -q
echo "preflight: passed"
