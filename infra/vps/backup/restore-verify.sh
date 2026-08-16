#!/bin/sh
set -eu

archive_dir="${1:?usage: secondbrain-restore-verify /backups/<timestamp>}"
identity_file="${AGE_IDENTITY_FILE:-/run/secrets/backup_age_identity}"

if [ ! -d "$archive_dir" ] || [ ! -s "$identity_file" ]; then
    echo "restore-verify: archive or age identity is missing" >&2
    exit 78
fi

(
    cd "$archive_dir"
    sha256sum -c SHA256SUMS
)

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
age -d -i "$identity_file" -o "$stage/desk.sql.zst" "$archive_dir/desk.sql.zst.age"
zstd -t "$stage/desk.sql.zst"
age -d -i "$identity_file" -o "$stage/runtime.tgz" "$archive_dir/runtime.tgz.age"
tar -tzf "$stage/runtime.tgz" >/dev/null
if [ -n "${RESTORE_MYSQL_HOST:-}" ]; then
    test "${RESTORE_DRILL_CONFIRM:-}" = "DISPOSABLE_EMPTY_DB" || { echo "restore-verify: disposable-target confirmation required" >&2; exit 78; }
    case "$RESTORE_MYSQL_HOST" in db|localhost|127.0.0.1|::1) echo "restore-verify: production/local target is forbidden" >&2; exit 78 ;; esac
    test -n "${RESTORE_MYSQL_ROOT_PASSWORD_FILE:-}" || { echo "restore-verify: MySQL password file required for import drill" >&2; exit 78; }
    export MYSQL_PWD="$(cat "$RESTORE_MYSQL_ROOT_PASSWORD_FILE")"
    existing="$(mariadb -N -h "$RESTORE_MYSQL_HOST" -u root -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='desk'")"
    test "$existing" = "0" || { echo "restore-verify: target is not an empty disposable MySQL" >&2; exit 78; }
    zstd -dc "$stage/desk.sql.zst" | mariadb -h "$RESTORE_MYSQL_HOST" -u root
    while IFS="$(printf '\t')" read -r table expected; do
        printf '%s' "$table" | grep -Eq '^desk_[a-z0-9_]+$' || { echo "restore-verify: invalid table in row-count manifest" >&2; exit 1; }
        actual="$(mariadb -N -h "$RESTORE_MYSQL_HOST" -u root desk -e "SELECT COUNT(*) FROM \`${table}\`")"
        test "$actual" = "$expected" || { echo "restore-verify: row-count mismatch for ${table}" >&2; exit 1; }
    done < "$archive_dir/row-counts.tsv"
    unset MYSQL_PWD
    echo "restore-verify: import drill and row-count comparison passed"
fi
echo "restore-verify: checksum and archive integrity passed"
