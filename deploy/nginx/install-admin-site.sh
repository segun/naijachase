#!/bin/sh
# Install only the admin host; restore its files on validation/reload failure.
set -eu
source=${1:?Usage: install-admin-site.sh source site link}
site=${2:?Missing available-site path}
link=${3:?Missing enabled-site path}
nginx_bin=${NGINX_BIN:-nginx}
systemctl_bin=${SYSTEMCTL_BIN:-systemctl}
case "$source" in
    *.http.conf)
        if [ -e "$site" ] || [ -L "$site" ] || [ -e "$link" ] || [ -L "$link" ]; then
            echo 'Admin site already exists; refusing to replace it with HTTP bootstrap.' >&2
            exit 1
        fi ;;
esac
for destination in "$site" "$link"; do
    if [ -d "$destination" ] && [ ! -L "$destination" ]; then
        echo "Refusing to replace directory: $destination" >&2
        exit 1
    fi
done
backup=$(mktemp -d "${site%/*}/../naijachase-admin-nginx-backup.XXXXXXXX")
[ ! -e "$site" ] && [ ! -L "$site" ] || cp -a -- "$site" "$backup/site"
[ ! -e "$link" ] && [ ! -L "$link" ] || cp -a -- "$link" "$backup/link"
committed=0
rollback() {
    result=$?
    trap - 0 HUP INT TERM
    if [ "$committed" -eq 0 ]; then
        rm -f -- "$site" "$link"
        [ ! -e "$backup/site" ] && [ ! -L "$backup/site" ] || cp -a -- "$backup/site" "$site"
        [ ! -e "$backup/link" ] && [ ! -L "$backup/link" ] || cp -a -- "$backup/link" "$link"
        echo "Restored previous admin site. Backup: $backup" >&2
        if [ "${reload_attempted:-0}" -eq 1 ]; then
            "$nginx_bin" -t && "$systemctl_bin" reload nginx || true
        fi
    fi
    exit "$result"
}
trap rollback 0
trap 'exit 1' HUP INT TERM
rm -f -- "$site"
install -m 0644 "$source" "$site"
ln -sfn -- "$site" "$link"
if ! "$nginx_bin" -t >"$backup/validation.log" 2>&1; then
    cat "$backup/validation.log" >&2
    exit 1
fi
cat "$backup/validation.log"
if grep -q 'conflicting server name' "$backup/validation.log"; then
    echo 'Duplicate virtual host; refusing to reload.' >&2
    exit 1
fi
reload_attempted=1
"$systemctl_bin" reload nginx
committed=1
echo "Installed admin site only. Backup: $backup"
