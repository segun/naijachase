#!/usr/bin/env bash
# Prepare without privilege, then install both files in one validated operation.
set -euo pipefail
directory=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
site=${1:-/etc/nginx/sites-available/005-admin.naijachase.app}
link=${2:-/etc/nginx/sites-enabled/005-admin.naijachase.app}
legacy=${3:-/etc/nginx/sites-available/default}
temporary=$(mktemp -d)
trap 'rm -rf -- "$temporary"' EXIT
cp -- "$legacy" "$temporary/original"
"${ADMIN_NODE_BIN:-node}" "$directory/extract-admin-default.mjs" "$temporary/original" "$temporary/cleaned"
sudo test -f /etc/letsencrypt/live/admin.naijachase.app/fullchain.pem
sudo test -f /etc/letsencrypt/live/admin.naijachase.app/privkey.pem
sudo sh "$directory/install-admin-site.sh" "$directory/admin.naijachase.app.conf" "$site" "$link" "$legacy" "$temporary/original" "$temporary/cleaned"
