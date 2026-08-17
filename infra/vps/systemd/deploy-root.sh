#!/bin/sh
# Install root:root 0755 at /usr/local/lib/secondbrain/deploy-root.sh.
# It is never executed from an uploaded release tree.
set -eu

action="${1:?usage: deploy-root.sh deploy-or-rollback sha}"
sha="${2:?usage: deploy-root.sh deploy-or-rollback sha}"
root=/opt/secondbrain
release="$root/releases/$sha"
archive="$root/incoming/$sha.tar.gz"
shared="$root/shared"
current="$root/current"
staging="$root/releases/.staging-$sha-$$"

cleanup_staging() {
  if [ -n "${staging:-}" ] && [ -e "$staging" ]; then
    rm -rf -- "$staging"
  fi
}
trap cleanup_staging EXIT HUP INT TERM

case "$action" in deploy|rollback) ;; *) exit 64 ;; esac
case "$sha" in ''|*[!0-9a-f]*) exit 64 ;; esac
[ "${#sha}" -eq 40 ] || exit 64

exec 9>/run/lock/secondbrain-deploy.lock
flock -n 9 || { echo "secondbrain: another release operation is active" >&2; exit 75; }

if [ "$action" = deploy ]; then
  test -f "$archive" && test ! -L "$archive" && test ! -e "$release" && test ! -L "$release"
  umask 077
  # Root creates every inode from the signed archive. No deploy-user-owned
  # directory or open writable descriptor crosses the trust boundary.
  /usr/bin/python3 /usr/local/lib/secondbrain/verify-release.py --extract "$archive" "$staging" "$sha"
  test -d "$staging" && test ! -L "$staging"
  mv "$staging" "$release"
  staging=""
  chown -R root:root "$release"
  chmod -R a-w "$release"
  rm -f "$archive"
fi
# Rollback re-verifies the already sealed release. Deploy was verified while
# extracting, and is verified again from its immutable root-owned tree.
test -d "$release" && test ! -L "$release"
/usr/bin/python3 /usr/local/lib/secondbrain/verify-release.py "$release" "$sha"
test -f "$shared/runtime.env"
test -s "$shared/image-digests"
grep -Eq '^CADDY_IMAGE=.*@sha256:[0-9a-f]{64}$' "$shared/image-digests"
grep -Eq '^MYSQL_IMAGE=.*@sha256:[0-9a-f]{64}$' "$shared/image-digests"
set -a
. "$shared/runtime.env"
set +a
compose_file="$release/infra/vps/compose.yml"
compose() {
  if [ -f "$shared/tg-enabled" ]; then
    docker compose --profile tg --project-name secondbrain --env-file "$shared/runtime.env" -f "$compose_file" "$@"
  else
    docker compose --project-name secondbrain --env-file "$shared/runtime.env" -f "$compose_file" "$@"
  fi
}
if [ -f "$shared/tg-enabled" ]; then
  test "$(stat -c '%U:%G:%a' "$shared/tg-enabled")" = "root:root:600"
  test -n "${TG_DATA_DIR:-}" && test -d "$TG_DATA_DIR"
  test "$(stat -c '%U:%G:%a' "$TG_DATA_DIR")" = "secondbrain:secondbrain:700"
  for name in tg_bot_token tg_config.json tg_wake_token; do
    test "$(stat -c '%U:%G:%a' "$SECRETS_DIR/$name")" = "root:root:600"
  done
fi
grep -Fx "CADDY_IMAGE=$CADDY_IMAGE" "$shared/image-digests" >/dev/null
grep -Fx "MYSQL_IMAGE=$MYSQL_IMAGE" "$shared/image-digests" >/dev/null
APP_IMAGE="secondbrain-app:$sha"
export APP_IMAGE
if [ "$action" = rollback ]; then
  docker image inspect "$APP_IMAGE" >/dev/null
fi
compose config -q

old=""
if [ -L "$current" ]; then old="$(readlink -f "$current")"; fi
ln -s "$release" "$root/.current-next"
mv -Tf "$root/.current-next" "$current"
compose_file="$current/infra/vps/compose.yml"

release_ready() {
  mode="$1"
  if [ "$mode" = build ]; then
    compose up -d --build --remove-orphans
    docker image inspect "$APP_IMAGE" >/dev/null
  else
    compose up -d --no-build --remove-orphans
  fi
  docker compose --project-name secondbrain --env-file "$shared/runtime.env" -f "$current/infra/vps/compose.yml" exec -T app \
    curl --fail --silent http://127.0.0.1/api/desk/health >/dev/null
  if [ -f "$shared/tg-enabled" ]; then
    compose exec -T tg python3 -c "import json,urllib.request; x=json.load(urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=5)); assert x.get('ok') and x.get('poll_recent')"
  fi
  resolved="$(getent ahostsv4 "$BRAIN_DOMAIN" | awk '{print $1}' | sort -u)"
  test "$resolved" = "72.56.66.161" || {
    echo "secondbrain: DNS does not resolve exclusively to the approved VPS" >&2
    return 1
  }
  curl --fail --silent --show-error --proto '=https' --tlsv1.2 \
    "https://$BRAIN_DOMAIN/api/desk/health" >/dev/null
  test "$(curl --silent --output /dev/null --write-out '%{http_code}' --proto '=https' --tlsv1.2 "https://$BRAIN_DOMAIN/api/tg/health")" = "404"
}

mode=reuse
if [ "$action" = deploy ]; then mode=build; fi
if ! release_ready "$mode"; then
  if [ -n "$old" ]; then
    old_sha="$(basename "$old")"
    APP_IMAGE="secondbrain-app:$old_sha"
    export APP_IMAGE
    ln -s "$old" "$root/.current-rollback"
    mv -Tf "$root/.current-rollback" "$current"
    compose_file="$current/infra/vps/compose.yml"
    docker image inspect "$APP_IMAGE" >/dev/null 2>&1 \
      && compose up -d --no-build --remove-orphans \
      || true
  else
    compose down || true
    rm -f "$current"
  fi
  echo "secondbrain: release failed, prior symlink restored when available" >&2
  exit 1
fi
printf '%s\n' "$sha" > "$shared/active-release"
