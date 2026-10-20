# Deploy the independent admin console

Run these commands from the release checkout on the server. Admin reuses the
existing game's database host, port, database name and TLS mode from `.env`.
You do not need to enter those values again or manage the generated database
passwords yourself.

If you already ran the older setup helper, keep its files. Setup automatically
finds `~/.config/naijachase-admin/first-install/admin.env`, preserves its two
service passwords and bootstrap hash, and resumes. No special `first-install`
directory is needed for a new setup.

## Database and service setup

```sh
make admin-install
make admin-build
make admin-setup
make admin-install-bundle admin-install-service admin-start
```

`admin-setup` performs these steps in order:

1. Reads `.env` as dotenv data, without executing it or printing its values.
   New setups ask for one temporary **web login password**, twice to confirm it.
   Resuming a prepared setup does not ask for that password again.
2. Generates two separate database service passwords internally, or retains
   the existing generated ones. You do not have to copy them into SQL or type
   them into a database prompt.
3. Checks database connectivity and setup permissions before making schema
   changes. If the selected account lacks user/grant privileges, it asks once
   for a **DBA username and existing DBA password**. Those credentials are used
   only for provisioning and are never written into the admin service env.
4. Applies pending game migrations directly with the release tool, then the
   separate control-schema migrations and restricted service grants. Existing
   staff, notes, audit, bootstrap retirement and service passwords are retained.
   It checks service authentication and rejects unexpected broad grants.
5. Uses sudo only at the final configuration-install stage to create the
   unprivileged admin OS account and install the finished private service env.

The game account having privileges on `naijachase.*` does not imply it can
create other database users, grant privileges or create the separate control
schema. If it lacks those rights, a DBA login really is needed once. That is an
existing database-management credential, not another admin website password.
The script will not work around missing privileges by putting the game or DBA
password into the running admin service.

The browser's initial username is `admin`; its password is the web password you
chose. `ADMIN_MYSQL_PASSWORD` and `ADMIN_CONTROL_MYSQL_PASSWORD` are generated
service credentials and are not browser login passwords. They remain private
inside `admin.env`; no manual secret handling is required.

To select a different existing game env explicitly:

```sh
make admin-setup ADMIN_SOURCE_ENV=/absolute/private/game.env
```

If a DBA supplies credentials in a private dotenv file rather than typing
once, that file needs `MYSQL_USER` and `MYSQL_PASSWORD`:

```sh
make admin-setup ADMIN_DB_ENV_FILE=/absolute/private/dba.env
```

An optional host/port/database in that DBA file must match the selected game
connection. No connection values or passwords are printed. Existing custom
control connections on a different host/port/TLS policy need DBA provisioning;
the automatic helper stops before changing the database in that case.

The new private directory defaults to `~/.config/naijachase-admin`; an existing
legacy `first-install` directory is detected automatically. You can still use
`ADMIN_SETUP_DIR=/absolute/private/directory` if your prepared settings live
elsewhere. Files are mode 0600 and their directory is 0700. The installed
service file is `/opt/naijachase-admin/shared/admin.env`, mode 0640 for root and
the dedicated service group.

If Node is installed through NVM but absent from a noninteractive PATH, pass
`ADMIN_NODE=/absolute/path/to/node` or load your normal Node environment before
running these commands. Node 22.18 or later is required. The helper uses a
MySQL 8 client; `mysql --version` should identify MySQL. Missing tools produce
an explicit error before database changes.

## TLS and the earlier migration service failure

The imported `MYSQL_SSL_MODE=required` means encrypted MySQL transport, matching
the game's current behavior. It accepts self-signed certificates or a hostname
mismatch and never falls back to plaintext. `verify_identity` additionally
validates certificate trust and hostname, with optional `MYSQL_SSL_CA` imported
as `ADMIN_MYSQL_SSL_CA`. Production admin rejects `disabled`.

The current game migration tool supports `required`, not `verify_identity`.
When strict mode is selected and game migrations are pending, provisioning
stops rather than silently weakening verification. Apply those migrations
through a verified DBA connection or a compatible migration tool, then resume.
No CA file or DNS-name re-entry is needed merely to preserve an existing
working `required` connection.

The separate `make deploy-migrate` target belongs to the isolated production
migration service. It requires all of these to exist first:

- OS account `naijachase-migrate`.
- `/opt/naijachase/shared/migrations.env` containing isolated deployment settings.
- Executable `/opt/naijachase/source/rust/target/release/naijachase-tools`.

It does not use the repository `.env`. Missing account/env prerequisites can
cause systemd to fail before the migration process starts. The target now
checks those prerequisites and displays status/journal details on failure.
Admin setup avoids that service dependency and runs its migration tool
directly with the explicitly selected connection and setup credentials.

For a deliberately chosen existing account that already has game-schema DDL
privileges, the direct game-only command is:

```sh
NAIJACHASE_ENV_FILE="$PWD/.env" make db-migrate
```

That command does not provision admin database users or its control schema.
Keep the normal isolated migration-service process for regular production
releases once its dedicated account and env have been provisioned.

## Check the loopback service

The installed binary is `/opt/naijachase-admin/bin/naijachase-admin`; its
frontend is `/var/www/naijachase-admin`. Check before enabling the website:

```sh
curl --fail http://127.0.0.1:8081/health/live
curl --fail http://127.0.0.1:8081/health/ready
make admin-status
```

Readiness checks the reporting and control databases. A failure is not fixed
by giving runtime accounts DBA access. Inspect the printed connection/schema
error and retain the prepared settings for a retry. An existing service user
with a different password causes an explicit collision error; setup never
resets it silently. Use its original `admin.env` or have the DBA resolve it.

## DNS and the HTTPS certificate

You still need DNS control and the actual server address. Create an A record
for `admin.naijachase.app` pointing to that server. Add AAAA only if its IPv6
address also works; remove an incorrect AAAA. If an optional office/VPN IP
allowlist is added, account for proxy addressing before enabling it.

Install absent tools with `sudo apt-get install nginx certbot openssl rsync
ca-certificates dnsutils`; keep an existing Certbot installation instead of
installing a second copy. Certbot is available for [Debian](https://packages.debian.org/stable/certbot)
and [Ubuntu](https://packages.ubuntu.com/noble/certbot).

```sh
dig +short A admin.naijachase.app
dig +short AAAA admin.naijachase.app
make admin-nginx-http
```

This installs a certificate-free HTTP site that exposes only
`/.well-known/acme-challenge/`. Permit public port 80 for certificate issuance
and renewal; [Let's Encrypt HTTP-01](https://letsencrypt.org/docs/challenge-types/#http-01-challenge)
requires it. The admin app/API remain unavailable through that HTTP site.

Obtain the certificate before enabling the HTTPS configuration:

```sh
sudo certbot certonly --webroot -w /var/lib/letsencrypt -d admin.naijachase.app --cert-name admin.naijachase.app
```

Certbot prompts for your real contact email and terms acceptance. Its
[webroot mode](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot)
uses the HTTP site without rewriting the other virtual hosts. Check DNS,
firewalls and the challenge URL if issuance fails; do not load the HTTPS site
early. An existing game-domain certificate cannot be assumed to cover admin.

The final configuration already uses the actual certificate paths:

```text
/etc/letsencrypt/live/admin.naijachase.app/fullchain.pem
/etc/letsencrypt/live/admin.naijachase.app/privkey.pem
```

## Enable HTTPS

The login page is reachable normally over HTTPS. Staff usernames, passwords
and permissions protect the API; no IP allowlist is required. The generated
origin matches `https://admin.naijachase.app`.

If Certbot already added admin server blocks to `/etc/nginx/sites-available/default`,
move them into the dedicated site with this command instead of reissuing a
certificate:

```sh
make admin-nginx-move-from-default
```

It preserves the stock default server and any other hosts, removes only
server blocks dedicated to `admin.naijachase.app`, and installs
`005-admin.naijachase.app`. It snapshots both files and the admin symlink,
checks for concurrent edits, validates Nginx and rejects duplicate hostname
warnings before reloading. Validation/reload failure restores the originals.
Blocks shared with another hostname require a manual split.

Otherwise, install the dedicated site normally:

```sh
make admin-nginx-https
```

Then install the renewal hook and check renewal:

```sh
make admin-install-renew-hook
sudo systemctl enable --now certbot.timer
sudo certbot renew --dry-run
```

For an existing snap Certbot installation use `snap.certbot.renew.timer`
instead. The deploy hook validates/reloads Nginx after successful renewal;
see [Certbot renewal hooks](https://eff-certbot.readthedocs.io/en/stable/using.html#renewing-certificates).
The admin-only installer rejects duplicate hostnames and restores the previous
site on validation/reload failure. Its access logs exclude query strings,
cookies and authorization values, so email search terms are not logged there.

For optional SSH-only access, add `allow 127.0.0.1;`, `allow ::1;` and `deny all;`
to the HTTPS server block and reinstall the site. Set
`ADMIN_PUBLIC_ORIGIN=https://admin.naijachase.app:8443` in the prepared private
`admin.env`, run `make admin-install-config admin-restart`, and add
`127.0.0.1 admin.naijachase.app` to your workstation's hosts file. On that
workstation start the tunnel using your real SSH destination:

```sh
read -r -p 'SSH user@server address: ' ADMIN_SSH_TARGET
ssh -N -L 127.0.0.1:8443:127.0.0.1:443 "$ADMIN_SSH_TARGET"
```

Open `https://admin.naijachase.app:8443`; the hostname and configured port keep
TLS and Origin checks correct. Do not use a localhost URL or disable TLS
checks. Remove the workstation hosts override when returning to direct access.

## First named owner and later releases

Log in as `admin` with the temporary web password. In Staff create your first
named account with role **owner** and a separate password. That transaction
permanently retires bootstrap `admin` and revokes all its sessions, ending the
current bootstrap login. Sign in with the new named owner and confirm the
old bootstrap login is rejected. Disabling other staff later never restores
bootstrap. Keep at least one enabled named owner.

After handover remove the `ADMIN_BOOTSTRAP_*` values from the prepared env,
then run `make admin-install-config admin-restart`. They are no longer needed
for an initialized control store. Do not drop/recreate the control database to
recover access; another owner resets staff passwords through the console.

Back up the control schema as well as the game database. Later releases use
`make admin-build`, the reviewed migrations, `make admin-install-bundle` and
`make admin-restart`; database sessions survive a normal restart until expiry
or revocation. Preserve identity/audit/notes/decisions during rollback.

`ADMIN_GAME_HEALTH_ENABLED=true` enables fixed local game readiness/metrics
checks when both services share this host. Backup freshness needs a real
backup job's absolute JSON status file with `last_success_at` and
`ADMIN_BACKUP_STATUS_PATH`; `ADMIN_BACKUP_MAX_AGE_HOURS` defaults to 24. The
console reports unconfigured integrations honestly and does not provide
external paging or proof of a tested restore.
