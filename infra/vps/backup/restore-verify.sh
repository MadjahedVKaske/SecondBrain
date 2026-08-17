#!/bin/sh
# Deliberately restores only into a newly-created, off-host drill directory.
set -eu

archive_dir="${1:?usage: secondbrain-restore-verify /backups/<timestamp>}"
identity_file="${AGE_IDENTITY_FILE:-/run/secrets/backup_age_identity}"
requested_target="${RESTORE_DRILL_TARGET:-}"

fail() { echo "restore-verify: $*" >&2; exit 78; }

[ -d "$archive_dir" ] || fail "archive directory is missing"
[ -s "$identity_file" ] || fail "age identity is missing"
[ -n "$requested_target" ] || fail "set RESTORE_DRILL_TARGET to a fresh disposable directory"

case "$requested_target" in
    /*) ;;
    *) fail "RESTORE_DRILL_TARGET must be an absolute path" ;;
esac

target_name="$(basename "$requested_target")"
target_parent="$(dirname "$requested_target")"
[ "$target_name" != "." ] && [ "$target_name" != ".." ] || fail "invalid restore target"
[ ! -e "$requested_target" ] || fail "restore target must not already exist"
[ -d "$target_parent" ] || fail "restore target parent is missing"
target_parent="$(cd "$target_parent" && pwd -P)"
target="$target_parent/$target_name"
archive_dir="$(cd "$archive_dir" && pwd -P)"
[ ! -e "$target" ] || fail "resolved restore target must not already exist"

# A drill must never stage files into the live runtime or beside the archive.
case "$target" in
    /|/opt/secondbrain|/opt/secondbrain/*|"$archive_dir"|"$archive_dir"/*)
        fail "production or backup target is forbidden"
        ;;
esac

stage="$(mktemp -d)"
cleanup() {
    unset MYSQL_PWD 2>/dev/null || true
    rm -rf "$stage"
}
trap cleanup EXIT HUP INT TERM

(
    cd "$archive_dir"
    sha256sum -c SHA256SUMS
)

age -d -i "$identity_file" -o "$stage/desk.sql.zst" "$archive_dir/desk.sql.zst.age"
zstd -t "$stage/desk.sql.zst"

private_archive="runtime.tgz.age"
if [ -f "$archive_dir/brain-private.tgz.age" ]; then private_archive="brain-private.tgz.age"; fi
[ -f "$archive_dir/$private_archive" ] || fail "private-brain archive is missing"
age -d -i "$identity_file" -o "$stage/brain-private.tgz" "$archive_dir/$private_archive"

tg_present=0
if [ -f "$archive_dir/tg-private.tgz.age" ]; then
    age -d -i "$identity_file" -o "$stage/tg-private.tgz" "$archive_dir/tg-private.tgz.age"
    tg_present=1
fi

# Python's tarfile lets us reject links and path traversal before extraction.
# The extracted drill copy is private by construction: directories 0700 and
# regular files 0600, owned by the account that ran this off-host drill.
extract_private() {
    archive="$1"
    expected_root="$2"
    destination="$3"
    python3 - "$archive" "$expected_root" "$destination" <<'PY'
import os
import shutil
import sys
import tarfile
from pathlib import Path, PurePosixPath

archive, expected_root, destination = map(Path, sys.argv[1:])
root = destination.resolve()
root.mkdir(mode=0o700, exist_ok=True)
os.chmod(root, 0o700)
members = []
with tarfile.open(archive, "r:gz") as tar:
    for member in tar.getmembers():
        name = PurePosixPath(member.name)
        parts = name.parts
        if (not parts or name.is_absolute() or ".." in parts or parts[0] != expected_root.name
                or not (member.isdir() or member.isreg())):
            raise SystemExit("restore-verify: unsafe or unexpected archive member")
        members.append(member)
    if not any(member.isreg() for member in members):
        raise SystemExit("restore-verify: archive has no regular files")
    for member in members:
        target = root.joinpath(*PurePosixPath(member.name).parts)
        if member.isdir():
            target.mkdir(mode=0o700, parents=True, exist_ok=True)
            os.chmod(target, 0o700)
            continue
        target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(target.parent, 0o700)
        source = tar.extractfile(member)
        if source is None:
            raise SystemExit("restore-verify: archive member cannot be read")
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with source, os.fdopen(fd, "wb") as out:
            shutil.copyfileobj(source, out)
        os.chmod(target, 0o600)
for path in [root, *root.rglob("*")]:
    st = path.stat()
    wanted = 0o700 if path.is_dir() else 0o600
    if st.st_uid != os.geteuid() or st.st_gid != os.getegid() or (st.st_mode & 0o777) != wanted:
        raise SystemExit("restore-verify: extracted ownership or mode is unsafe")
PY
}

mkdir -m 0700 "$target"
extract_private "$stage/brain-private.tgz" "brain-private" "$target"

if [ "$tg_present" -eq 1 ]; then
    extract_private "$stage/tg-private.tgz" "tg-data" "$target"
    python3 - "$target/tg-data/offset.json" "$target/tg-data/inbox.json" <<'PY'
import json
import re
import sys
from pathlib import Path

offset_path, inbox_path = map(Path, sys.argv[1:])
try:
    offset = json.loads(offset_path.read_text(encoding="utf-8"))
    inbox = json.loads(inbox_path.read_text(encoding="utf-8"))
except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
    raise SystemExit(f"restore-verify: invalid TG state JSON: {exc}")
if set(offset) != {"offset"} or not isinstance(offset["offset"], int) or offset["offset"] < 0:
    raise SystemExit("restore-verify: offset.json must contain one non-negative integer offset")
items = inbox.get("items") if isinstance(inbox, dict) and set(inbox) == {"items"} else None
if not isinstance(items, list) or len(items) > 500:
    raise SystemExit("restore-verify: inbox.json must contain at most 500 items")
seen_ids, seen_updates, max_update = set(), set(), -1
for item in items:
    if not isinstance(item, dict):
        raise SystemExit("restore-verify: inbox item is not an object")
    item_id, update_id = item.get("id"), item.get("update_id")
    if not isinstance(item_id, str) or not re.fullmatch(r"[0-9a-f]{32}", item_id):
        raise SystemExit("restore-verify: inbox item id is invalid")
    if not isinstance(update_id, int) or update_id < 0 or item_id in seen_ids or update_id in seen_updates:
        raise SystemExit("restore-verify: inbox IDs or update IDs are invalid")
    stored = item.get("stored_as")
    if stored is not None and (not isinstance(stored, str) or Path(stored).name != stored or not stored):
        raise SystemExit("restore-verify: inbox stored_as is unsafe")
    seen_ids.add(item_id); seen_updates.add(update_id); max_update = max(max_update, update_id)
if offset["offset"] <= max_update:
    raise SystemExit("restore-verify: offset does not advance past restored inbox")
PY
fi

if [ -n "${RESTORE_MYSQL_HOST:-}" ]; then
    # Only the recovery-compose service name is accepted: an IP, localhost,
    # production service name, or arbitrary DNS name cannot be used by mistake.
    [ "$RESTORE_MYSQL_HOST" = "restore-db" ] || fail "RESTORE_MYSQL_HOST must be the disposable restore-db service"
    [ "${RESTORE_DRILL_CONFIRM:-}" = "FRESH_DISPOSABLE_TARGET" ] || fail "fresh disposable-target confirmation required"
    [ -n "${RESTORE_MYSQL_ROOT_PASSWORD_FILE:-}" ] || fail "MySQL password file required for import drill"
    [ -s "$RESTORE_MYSQL_ROOT_PASSWORD_FILE" ] || fail "MySQL password file is missing"
    export MYSQL_PWD="$(cat "$RESTORE_MYSQL_ROOT_PASSWORD_FILE")"
    existing="$(mariadb -N -h "$RESTORE_MYSQL_HOST" -u root -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='desk'")"
    [ "$existing" = "0" ] || fail "target is not an empty disposable MySQL"
    zstd -dc "$stage/desk.sql.zst" | mariadb -h "$RESTORE_MYSQL_HOST" -u root
    while IFS="$(printf '\t')" read -r table expected; do
        printf '%s' "$table" | grep -Eq '^desk_[a-z0-9_]+$' || { echo "restore-verify: invalid table in row-count manifest" >&2; exit 1; }
        printf '%s' "$expected" | grep -Eq '^[0-9]+$' || { echo "restore-verify: invalid row count in manifest" >&2; exit 1; }
        actual="$(mariadb -N -h "$RESTORE_MYSQL_HOST" -u root desk -e "SELECT COUNT(*) FROM \`${table}\`")"
        [ "$actual" = "$expected" ] || { echo "restore-verify: row-count mismatch for ${table}" >&2; exit 1; }
    done < "$archive_dir/row-counts.tsv"
    unset MYSQL_PWD
    echo "restore-verify: import drill and row-count comparison passed"
fi

echo "restore-verify: fresh target extracted and validated at $target"
