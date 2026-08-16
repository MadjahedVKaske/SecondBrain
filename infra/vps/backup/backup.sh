#!/bin/sh
set -eu

for required in "$MYSQL_ROOT_PASSWORD_FILE" "$BACKUP_AGE_RECIPIENT_FILE"; do
    if [ ! -s "$required" ]; then
        echo "backup: required secret file is missing" >&2
        exit 78
    fi
done

recipient="$(cat "$BACKUP_AGE_RECIPIENT_FILE")"
case "$recipient" in
  age1*) ;;
  *) echo "backup: age recipient is invalid" >&2; exit 78 ;;
esac

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
out="${BACKUP_DIR}/${stamp}"
mkdir -p "$out"

export MYSQL_PWD="$(cat "$MYSQL_ROOT_PASSWORD_FILE")"
mariadb-dump --single-transaction --routines --triggers --events \
    --databases "$MYSQL_DATABASE" -h "$MYSQL_HOST" -u root \
    | zstd -T0 -q \
    | age -r "$recipient" -o "$out/desk.sql.zst.age"

mariadb -N -h "$MYSQL_HOST" -u root "$MYSQL_DATABASE" \
    -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='${MYSQL_DATABASE}' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME" \
    | while IFS= read -r table; do
        count="$(mariadb -N -h "$MYSQL_HOST" -u root "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM \`${table}\`")"
        printf '%s\t%s\n' "$table" "$count"
      done > "$out/row-counts.tsv"
unset MYSQL_PWD

tar -C /source -czf "$stage/runtime.tgz" brain-private
age -r "$recipient" -o "$out/runtime.tgz.age" "$stage/runtime.tgz"

printf '{"created_at":"%s","database":"%s","encrypted":true}\n' "$stamp" "$MYSQL_DATABASE" > "$out/manifest.json"
(
    cd "$out"
    sha256sum desk.sql.zst.age runtime.tgz.age row-counts.tsv manifest.json > SHA256SUMS
)
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+${BACKUP_RETENTION_DAYS:-30}" -exec rm -rf {} +
echo "backup: wrote $out"
