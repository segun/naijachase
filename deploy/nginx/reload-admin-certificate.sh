#!/bin/sh
set -eu
# Certbot deploy hook: test first, then load a successfully renewed certificate.
nginx -t
systemctl reload nginx
