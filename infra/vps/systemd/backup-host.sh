#!/bin/sh
# Install as root:root, mode 0700 at /usr/local/lib/secondbrain/backup-host.sh.
set -eu

root=/opt/secondbrain
. "$root/shared/runtime.env"

recipient_file="$SECRETS_DIR/backup_age_recipient"
test -s "$recipient_file" || { echo "backup: missing age recipient" >&2; exit 78; }
recipient="$(cat "$recipient_file")"
case "$recipient" in age1*) ;; *) echo "backup: invalid age recipient" >&2; exit 78 ;; esac

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
out="$BACKUP_DIR/$stamp"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT HUP INT TERM
install -d -o root -g root -m 0700 "$out"

db=secondbrain-db-1
/usr/bin/docker exec "$db" sh -c 'MYSQL_PWD="$(cat /run/secrets/mysql_root_password)" exec mysqldump --single-transaction --routines --triggers --events --databases desk -u root' > "$stage/desk.sql"
/usr/bin/zstd -T0 -q "$stage/desk.sql" -o "$stage/desk.sql.zst"
/usr/bin/age -r "$recipient" -o "$out/desk.sql.zst.age" "$stage/desk.sql.zst"

/usr/bin/docker exec "$db" sh -c 'MYSQL_PWD="$(cat /run/secrets/mysql_root_password)" exec mysql -N -u root desk -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE=CHAR(66,65,83,69,32,84,65,66,76,69) ORDER BY TABLE_NAME"' |
while IFS= read -r table; do
    case "$table" in ''|*[!A-Za-z0-9_]*) echo "backup: unsafe table name" >&2; exit 78 ;; esac
    /usr/bin/docker exec "$db" sh -c "MYSQL_PWD=\"\$(cat /run/secrets/mysql_root_password)\" exec mysql -N -u root desk -e \"SELECT '$table', COUNT(*) FROM $table\""
done > "$out/row-counts.tsv"

tar -C "$(dirname "$BRAIN_PRIVATE_DIR")" -czf "$stage/brain-private.tgz" "$(basename "$BRAIN_PRIVATE_DIR")"
/usr/bin/age -r "$recipient" -o "$out/brain-private.tgz.age" "$stage/brain-private.tgz"
if [ -n "${TG_DATA_DIR:-}" ] && [ -d "$TG_DATA_DIR" ]; then
    # The poller state is data, not configuration: archive offset, inbox and
    # media, but never the BotFather token or admin secrets.
    test -f "$TG_DATA_DIR/.state.lock" && test ! -L "$TG_DATA_DIR/.state.lock" || { echo "backup: TG state lock missing" >&2; exit 78; }
    flock -x "$TG_DATA_DIR/.state.lock" tar -C "$(dirname "$TG_DATA_DIR")" -czf "$stage/tg-private.tgz" "$(basename "$TG_DATA_DIR")"
    /usr/bin/age -r "$recipient" -o "$out/tg-private.tgz.age" "$stage/tg-private.tgz"
fi
printf '{"created_at":"%s","database":"desk","encrypted":true}\n' "$stamp" > "$out/manifest.json"
(
    cd "$out"
    sha256sum desk.sql.zst.age brain-private.tgz.age row-counts.tsv manifest.json > SHA256SUMS
    if [ -f tg-private.tgz.age ]; then sha256sum tg-private.tgz.age >> SHA256SUMS; fi
)
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+${BACKUP_RETENTION_DAYS:-30}" -exec rm -rf {} +
printf 'backup: wrote %s\n' "$out"
