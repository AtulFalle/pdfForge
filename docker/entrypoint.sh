#!/bin/sh
set -eu

tmp="${PDFFORGE_TMP:-/tmp/pdfforge}"
mkdir -p "$tmp"

if [ "$(id -u)" -eq 0 ]; then
  chown -R nobody:nogroup "$tmp"
  exec setpriv --reuid=nobody --regid=nogroup --init-groups -- "$@"
fi

exec "$@"
