#!/bin/sh
# Install the two owned sites together, without changing unrelated virtual hosts.
set -eu
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
game_site=${1:-/etc/nginx/sites-available/004-naijachase.app}
game_link=${2:-/etc/nginx/sites-enabled/004-naijachase.app}
landing_site=${3:-/etc/nginx/sites-available/003-naijachase.com}
landing_link=${4:-/etc/nginx/sites-enabled/003-naijachase.com}
legacy_link="${landing_link%/*}/004-naijachase.com"
nginx_bin=${NGINX_BIN:-nginx}
systemctl_bin=${SYSTEMCTL_BIN:-systemctl}
backup=$(mktemp -d "${game_site%/*}/../naijachase-nginx-backup.XXXXXXXX")
committed=0
# Backups live outside sites-enabled: Nginx includes every file in that directory.
set -- "$game_site" "$game_link" "$landing_site" "$landing_link" "$legacy_link"
index=0
for destination do
    index=$((index + 1))
    if [ -d "$destination" ] && [ ! -L "$destination" ]; then
        echo "Refusing to replace directory: $destination" >&2
        exit 1
    fi
    if [ -e "$destination" ] || [ -L "$destination" ]; then
        cp -a -- "$destination" "$backup/$index"
    fi
done
rollback() {
    result=$?
    trap - 0 HUP INT TERM
    if [ "$committed" -eq 0 ]; then
        index=0
        for destination do
            index=$((index + 1))
            rm -f -- "$destination"
            if [ -e "$backup/$index" ] || [ -L "$backup/$index" ]; then
                cp -a -- "$backup/$index" "$destination"
            fi
        done
        echo "Restored previous Nginx files. Backup: $backup" >&2
        # A failed reload may have changed the running configuration; restore it.
        if [ "${reload_attempted:-0}" -eq 1 ]; then
            "$nginx_bin" -t && "$systemctl_bin" reload nginx || true
        fi
    fi
    exit "$result"
}
# Trap arguments explicitly: positional arguments inside a function are local.
trap 'rollback "$game_site" "$game_link" "$landing_site" "$landing_link" "$legacy_link"' 0
trap 'exit 1' HUP INT TERM
rm -f -- "$game_site" "$landing_site"
install -m 0644 "$source_dir/naijachase.app.conf" "$game_site"
install -m 0644 "$source_dir/naijachase.com.conf" "$landing_site"
ln -sfn -- "$game_site" "$game_link"
ln -sfn -- "$landing_site" "$landing_link"
if [ "$legacy_link" != "$landing_link" ] && [ "$legacy_link" != "$game_link" ]; then
    rm -f -- "$legacy_link"
fi
if ! "$nginx_bin" -t >"$backup/validation.log" 2>&1; then
    cat "$backup/validation.log" >&2
    exit 1
fi
cat "$backup/validation.log"
if grep -q 'conflicting server name' "$backup/validation.log"; then
    echo "Duplicate virtual hosts remain; refusing to reload." >&2
    exit 1
fi
reload_attempted=1
"$systemctl_bin" reload nginx
committed=1
echo "Installed one landing site and one game site. Backup: $backup"
