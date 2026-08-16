#!/bin/sh
set -eu

dump="${1:?usage: import-approved-dump /imports/approved.sql.zst}"
test "${INITIAL_IMPORT_CONFIRM:-}" = "EMPTY_DB_ONLY" || { echo "import: explicit initial-import confirmation is required" >&2; exit 78; }
marker=/imports/INITIAL_IMPORT_APPROVED
test -f "$marker" || { echo "import: one-time approval marker is missing" >&2; exit 78; }
test -r "$dump" || { echo "import: approved dump is not readable" >&2; exit 78; }
test -n "${INITIAL_DUMP_SHA256:-}" || { echo "import: expected SHA256 is required" >&2; exit 78; }
actual="$(sha256sum "$dump" | awk '{print $1}')"
test "$actual" = "$INITIAL_DUMP_SHA256" || { echo "import: dump checksum mismatch" >&2; exit 78; }
test "$(cat "$marker")" = "$INITIAL_DUMP_SHA256" || { echo "import: approval marker does not match dump" >&2; exit 78; }
export MYSQL_PWD="$(cat "$MYSQL_ROOT_PASSWORD_FILE")"
tables="$(mariadb -N -h "$MYSQL_HOST" -u root -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='${MYSQL_DATABASE}' AND TABLE_TYPE='BASE TABLE'")"
for table in $tables; do
    count="$(mariadb -N -h "$MYSQL_HOST" -u root "$MYSQL_DATABASE" -e "SELECT COUNT(*) FROM \`${table}\`")"
    test "$count" = "0" || { echo "import: target database is not empty" >&2; exit 78; }
done
zstd -dc "$dump" | mariadb -h "$MYSQL_HOST" -u root "$MYSQL_DATABASE"
unset MYSQL_PWD
count="$(MYSQL_PWD="$(cat "$MYSQL_ROOT_PASSWORD_FILE")" mariadb -N -h "$MYSQL_HOST" -u root "$MYSQL_DATABASE" -e 'SELECT COUNT(*) FROM desk_tasks')"
printf 'import: completed; desk_tasks=%s\n' "$count"
