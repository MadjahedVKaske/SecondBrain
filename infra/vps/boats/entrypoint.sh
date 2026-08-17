#!/bin/sh
set -eu

source=/run/boats-input/config.php
target=/run/boats/config.php
test -s "$source" && test ! -L "$source"
grep -Eqi 'change-me|your[-_ ]?(token|secret|password)' "$source" && exit 78
php -l "$source" >/dev/null 2>&1
install -D -o root -g www-data -m 0640 "$source" "$target"

exec "$@"
