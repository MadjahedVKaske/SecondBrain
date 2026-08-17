#!/bin/sh
# Docker Compose file-backed secrets retain root-only host modes. Copy them
# once into a private tmpfs, then run the long-lived poller as UID 10001.
set -eu

secret_dir=/run/tg-secrets
umask 077
mkdir -p "$secret_dir"
for name in tg_bot_token tg_config tg_wake_token; do
    source="/run/secrets/$name"
    target="$secret_dir/$name"
    test -f "$source" && test ! -L "$source"
    install -m 0600 "$source" "$target"
    chown 10001:10001 "$target"
done

exec su-exec 10001:10001 python3 /app/poller.py
