#!/bin/sh
# Run as root on the new VPS before deployment; commit no resulting values.
set -eu
out="${1:?usage: record-image-digests.sh <image-digests> <runtime.env>}"
runtime_env="${2:?usage: record-image-digests.sh <image-digests> <runtime.env>}"
test -f "$runtime_env"
if grep -Eq '^(CADDY_IMAGE|MYSQL_IMAGE)=' "$runtime_env"; then
  echo "image digests are already present in runtime.env" >&2
  exit 78
fi
docker pull caddy:2.8.4-alpine
docker pull mysql:8.4.6
umask 077
{
  docker image inspect --format 'CADDY_IMAGE={{index .RepoDigests 0}}' caddy:2.8.4-alpine
  docker image inspect --format 'MYSQL_IMAGE={{index .RepoDigests 0}}' mysql:8.4.6
} > "$out"
grep -Eq '^CADDY_IMAGE=.*@sha256:[0-9a-f]{64}$' "$out"
grep -Eq '^MYSQL_IMAGE=.*@sha256:[0-9a-f]{64}$' "$out"
cat "$out" >> "$runtime_env"
chmod 0600 "$runtime_env" "$out"
