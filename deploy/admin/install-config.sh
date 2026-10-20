#!/usr/bin/env bash
set -euo pipefail
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd -P)
node_bin=${ADMIN_NODE_BIN:-node}
file=$("$node_bin" "$repo_root/deploy/admin/config.mjs" resolve "${1:-$HOME/.config/naijachase-admin}")
[[ -f "$file" ]] || { echo 'Run make admin-prepare-config first.' >&2; exit 1; }
getent passwd naijachase-admin >/dev/null || sudo useradd --system --user-group --home-dir /opt/naijachase-admin --shell /usr/sbin/nologin naijachase-admin
sudo install -d -m 0750 -o root -g naijachase-admin /opt/naijachase-admin/shared
sudo install -m 0640 -o root -g naijachase-admin "$file" /opt/naijachase-admin/shared/admin.env
echo 'Installed the private admin service configuration; database setup credentials were not copied.'
