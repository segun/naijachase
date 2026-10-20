#!/usr/bin/env bash
# Imports dotenv data without executing it. Never connects to a database.
set -euo pipefail
umask 077
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd -P)
output=${1:-"$HOME/.config/naijachase-admin"}
binary=${2:-"$repo_root/rust/target/release/naijachase-admin"}
source_env=${3:-"$repo_root/.env"}
node_bin=${ADMIN_NODE_BIN:-node}
if "$node_bin" "$repo_root/deploy/admin/config.mjs" check "$output" "$source_env"; then
    "$node_bin" "$repo_root/deploy/admin/config.mjs" prepare "$output" "$source_env"
else
    result=$?
    [[ "$result" -eq 10 ]] || exit "$result"
    [[ -x "$binary" ]] || { echo 'Build the admin release binary first: make admin-build' >&2; exit 1; }
    printf 'Database connection settings will be reused from the selected game env.\n'
    printf 'Choose one WEB LOGIN password; database service passwords are generated for you.\n'
    read -r -s -p 'Temporary admin web password (16–128 bytes): ' password
    printf '\n'
    read -r -s -p 'Repeat that web password: ' confirm
    printf '\n'
    [[ "$password" == "$confirm" ]] || { echo 'Passwords do not match.' >&2; exit 1; }
    hash=$(printf '%s\n' "$password" | "$binary" --hash-password)
    unset password confirm
    printf '%s\n' "$hash" | "$node_bin" "$repo_root/deploy/admin/config.mjs" prepare "$output" "$source_env"
    unset hash
fi
