#!/bin/sh
set -eu

require_secret_config() {
    file="$1"
    label="$2"

    if [ ! -s "$file" ]; then
        echo "secondbrain: missing ${label} config" >&2
        exit 78
    fi
    if grep -Eqi 'change-me|example\.com|your[-_ ]?(token|secret|password)' "$file"; then
        echo "secondbrain: ${label} config still contains a placeholder" >&2
        exit 78
    fi
    if ! php -l "$file" >/dev/null 2>&1; then
        echo "secondbrain: invalid ${label} PHP config" >&2
        exit 78
    fi
}

if [ "${SECOND_BRAIN_REQUIRE_SECRETS:-0}" = "1" ]; then
    require_secret_config /run/secondbrain-input/desk.config.php desk
    # Apache children read only this ephemeral copy, never the host bind mount.
    config_path="${DESK_CONFIG_PATH:-/run/secondbrain/desk.config.php}"
    install -D -o root -g www-data -m 0640 /run/secondbrain-input/desk.config.php "$config_path"
fi

for asset in /var/www/html/desk/vendor/fullcalendar.global.min.js /var/www/html/desk/vendor/sortable.min.js; do
    if [ ! -s "$asset" ]; then
        echo "secondbrain: local Desk vendor assets are required for production" >&2
        exit 78
    fi
done

exec "$@"
