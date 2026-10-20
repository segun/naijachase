# =============================================================================
# Configuration
# Tool locations, deployment targets, and default arguments. Every `?=` value
# can be overridden from the command line, e.g. `make export EXPORT_DIR=out`.
# =============================================================================

SHELL := /bin/sh

# --- Toolchain ---------------------------------------------------------------
CARGO ?= cargo
CODEX_NODE_BIN := $(HOME)/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin
CODEX_PNPM := $(HOME)/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm
# Prefer the Codex-bundled pnpm when present, otherwise use pnpm from PATH.
ifneq ($(wildcard $(CODEX_PNPM)),)
PNPM ?= env PATH="$(CODEX_NODE_BIN):$(PATH)" "$(CODEX_PNPM)"
else
PNPM ?= pnpm
endif
RSYNC ?= rsync

# --- Deployment targets ------------------------------------------------------
DEPLOY_HOST ?= drawback-web01
DEPLOY_PATH ?= /opt/naijachase/source/
SYSTEMD_DIR ?= /etc/systemd/system
NGINX_SITE ?= /etc/nginx/sites-available/004-naijachase.app
NGINX_SITE_LINK ?= /etc/nginx/sites-enabled/004-naijachase.app
LANDING_ROOT ?= /var/www/naijachase.com
LANDING_NGINX_SITE ?= /etc/nginx/sites-available/003-naijachase.com
LANDING_NGINX_SITE_LINK ?= /etc/nginx/sites-enabled/003-naijachase.com
WEB_ROOT ?= /var/www/naijachase.app
SOURCE_MAP_ROOT ?= /opt/naijachase/source-maps
ADMIN_INSTALL_ROOT ?= /opt/naijachase-admin
ADMIN_WEB_ROOT ?= /var/www/naijachase-admin
ADMIN_NGINX_SITE ?= /etc/nginx/sites-available/005-admin.naijachase.app
ADMIN_NGINX_SITE_LINK ?= /etc/nginx/sites-enabled/005-admin.naijachase.app
ADMIN_SETUP_DIR ?= $(HOME)/.config/naijachase-admin
ADMIN_SOURCE_ENV ?= $(CURDIR)/.env
ADMIN_GAME_ENV_FILE ?= $(ADMIN_SOURCE_ENV)
ADMIN_DB_ENV_FILE ?= $(ADMIN_GAME_ENV_FILE)
ADMIN_NODE ?= node
RELEASE ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo local)

# --- Rust tools and content paths --------------------------------------------
MANIFEST := rust/Cargo.toml
# Runs the naijachase-tools CLI; subcommands are appended by each target.
TOOLS := $(CARGO) run --quiet --manifest-path $(MANIFEST) -p naijachase-tools --
SIMULATION_OUTPUT ?= data/gameplay/mission-balance-report.csv
EXPORT_DIR ?= build/content-export
ARGS ?=

.DEFAULT_GOAL := help

.PHONY: help \
	play test test-storage fmt fmt-check build release benchmark api api-test \
	validate editorial enrichment witness-coverage enrich-state-clues standardize-witness-english \
	enrich-civic-history repair-witness-dialogues \
	export-witness-scenes simulate export \
	db-migrate db-import db-rebuild db-verify db-publish-initial db-export \
	db-backup db-restore db-test \
	web web-build web-install web-production-build web-mock web-mock-ui web-test \
	admin-api admin-web admin-install admin-check admin-build \
	admin-prepare-config admin-provision admin-install-config admin-setup admin-install-bundle admin-install-service admin-start admin-restart admin-status \
	admin-nginx-http admin-nginx-https admin-install-renew-hook \
	production-build copy-code install-api-service restart-api api-status \
	install-web install-nginx publish-web publish-landing \
	check audit p34 p35 p36 p39 p391

# =============================================================================
# Help
# =============================================================================

# List every target that has a `## description` comment.
help: ## Show the common project commands
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-16s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# =============================================================================
# Rust: run, test, format, and build
# Day-to-day development of the Rust workspace and the terminal game.
# =============================================================================

# Launch the terminal game via ./play.
play: ## Play the terminal game; pass options with ARGS="..."
	@./play $(ARGS)

# Run every test in the Rust workspace.
test: ## Run the complete Rust workspace test suite
	@$(CARGO) test --manifest-path $(MANIFEST) --workspace

# Run only the storage crate's tests (no MySQL needed).
test-storage: ## Run storage unit tests without requiring a live database
	@$(CARGO) test --manifest-path $(MANIFEST) -p naijachase-storage

# Rewrite Rust sources with rustfmt.
fmt: ## Format every Rust crate
	@$(CARGO) fmt --manifest-path $(MANIFEST) --all

# Fail if any Rust source is not rustfmt-clean.
fmt-check: ## Check Rust formatting without changing files
	@$(CARGO) fmt --manifest-path $(MANIFEST) --all -- --check

# Debug build of the whole workspace.
build: ## Build the Rust workspace in debug mode
	@$(CARGO) build --manifest-path $(MANIFEST) --workspace

# Optimized build of the whole workspace.
release: ## Build the Rust workspace in release mode
	@$(CARGO) build --manifest-path $(MANIFEST) --workspace --release

# Measure core-engine throughput with the release-mode benchmark example.
benchmark: ## Run the core-engine throughput benchmark
	@$(CARGO) run --quiet --release --manifest-path $(MANIFEST) -p naijachase-core --example benchmark

# =============================================================================
# API service
# Run and test the HTTP API locally (production service: see Deployment).
# =============================================================================

# Run the API server in the foreground.
api: ## Start the versioned HTTP API using .env configuration
	@$(CARGO) run --manifest-path $(MANIFEST) -p naijachase-api

# Run the API crate's tests.
api-test: ## Run API unit, contract, load, and security tests
	@$(CARGO) test --manifest-path $(MANIFEST) -p naijachase-api

# =============================================================================
# Content tooling
# Validate, enrich, simulate, and export the canonical game content catalogue.
# =============================================================================

# Validate the full content catalogue.
validate: ## Validate the complete canonical content catalogue
	@$(TOOLS) validate

# Run editorial checks over clues.
editorial: ## Run automated clue editorial checks
	@$(TOOLS) editorial

# Report how much of the semantic knowledge base is covered.
enrichment: ## Report semantic knowledge coverage
	@$(TOOLS) enrichment

witness-coverage: ## Report clue eligibility and sampled exposure across all missions
	@$(TOOLS) witness-coverage

# Regenerate witness clues for each state.
enrich-state-clues: ## Rebuild state motto, city, landmark, and economy witness clues
	@$(TOOLS) enrich-state-clues

# Regenerate state-creation, early-governance, presidential, and sports-history clues.
enrich-civic-history: ## Rebuild civic and national-history witness clues
	@$(TOOLS) enrich-civic-history

# Clean up witness clue language and metadata.
standardize-witness-english: ## Remove non-English witness variants and standardize editorial metadata
	@$(TOOLS) standardize-witness-english

# Repair malformed place-name substitutions and keep atom/variant wording aligned.
repair-witness-dialogues: ## Repair witness grammar after place-name anonymisation
	@$(TOOLS) repair-witness-dialogues

# Write the witness scene descriptions consumed by the web client.
export-witness-scenes: ## Export Babylon.js witness venue and location scene descriptions
	@$(TOOLS) export-witness-scenes data/exports/witness-location-scenes.json

# Play every mission through the simulator and write a balance report.
simulate: ## Simulate all missions; override with SIMULATION_OUTPUT=path
	@$(TOOLS) simulate $(SIMULATION_OUTPUT)

# Export canonical content to files in EXPORT_DIR.
export: ## Export canonical content; override with EXPORT_DIR=path
	@$(TOOLS) export $(EXPORT_DIR)

# =============================================================================
# Database (MySQL)
# Migrate, import, verify, export, and back up the MySQL data. Uses .env.
# =============================================================================

# Apply schema migrations.
db-migrate: ## Apply pending MySQL migrations using NAIJACHASE_ENV_FILE or repository .env
	@$(TOOLS) migrate-mysql

# Load the canonical CSV content into MySQL (after validation and simulation).
db-import: validate simulate ## Validate, simulate, then import every canonical CSV into MySQL transactionally
	@$(TOOLS) import-mysql

# Rebuild MySQL content from the canonical files (after validation and simulation).
db-rebuild: validate simulate ## Validate and simulate before rebuilding MySQL content
	@$(TOOLS) rebuild-mysql

# Check the database matches the canonical content.
db-verify: ## Verify MySQL checksums, row counts, export, and mission parity
	@$(TOOLS) verify-mysql

# Publish the first production catalogue (one-time operation).
db-publish-initial: ## Validate and publish an imported first-production catalogue exactly once
	@$(TOOLS) publish-initial-mysql

# Dump MySQL content to files in EXPORT_DIR.
db-export: ## Export MySQL content; override with EXPORT_DIR=path
	@$(TOOLS) export-mysql $(EXPORT_DIR)

# Save player, career, and case data to a JSON backup.
db-backup: ## Back up mutable MySQL player/career/case data
	@$(TOOLS) backup-mysql $(EXPORT_DIR)/operational-backup.json

# Load player, career, and case data from the JSON backup.
db-restore: ## Restore mutable MySQL data from EXPORT_DIR backup
	@$(TOOLS) restore-mysql $(EXPORT_DIR)/operational-backup.json

# Run the storage tests against a real MySQL instance, one thread at a time.
db-test: ## Run live MySQL migration, recovery, concurrency, and idempotency tests
	@NAIJACHASE_MYSQL_TEST=1 $(CARGO) test --manifest-path $(MANIFEST) -p naijachase-storage -- --test-threads=1

# =============================================================================
# Web client
# Develop, build, and test the frontend in web/.
# =============================================================================

# Start the Vite dev server.
web: ## Start the responsive web client at http://127.0.0.1:4173
	@cd web && $(PNPM) dev --force

# Type-check and produce the optimized bundle in web/dist.
web-build: ## Type-check and build the optimized web client
	@cd web && $(PNPM) build

# Install dependencies exactly as locked.
web-install: ## Install the exact locked web dependencies
	@cd web && $(PNPM) install --frozen-lockfile

# Clean install followed by a build, for production.
web-production-build: web-install ## Install dependencies and build the production web client
	@cd web && NAIJACHASE_RELEASE=$(RELEASE) $(PNPM) build

# Run the fake API on port 8081 so the UI works without MySQL.
web-mock: ## Start the in-memory mock API on port 8081 (UI development without MySQL)
	@cd web && node dev/mock-api.mjs

# Run the dev server pointed at the mock API (start web-mock first).
web-mock-ui: ## Start the web client against the mock API
	@cd web && API_TARGET=http://127.0.0.1:8081 $(PNPM) dev

# Run the web test suite.
web-test: ## Run web accessibility, privacy, mobile, and weight guards
	@cd web && $(PNPM) test

# =============================================================================
# Administration
# Separate backend, frontend, credentials, and publication; no admin target is
# a dependency of the player-facing deployment targets below.
# =============================================================================

admin-api: ## Start the separate admin API with exported ADMIN_* configuration
	@$(CARGO) run --manifest-path $(MANIFEST) -p naijachase-admin

admin-web: ## Start the admin frontend at http://127.0.0.1:4174
	@cd admin/frontend && $(PNPM) dev

admin-install: ## Install the exact locked admin frontend dependencies
	@cd admin/frontend && $(PNPM) install --frozen-lockfile

admin-check: ## Check admin formatting, backend tests, frontend types, and frontend tests
	@$(CARGO) fmt --manifest-path $(MANIFEST) -p naijachase-admin -- --check
	@$(CARGO) test --manifest-path $(MANIFEST) -p naijachase-admin
	@$(ADMIN_NODE) --test deploy/admin/setup.test.mjs
	@$(ADMIN_NODE) --test deploy/nginx/admin-site.test.mjs
	@cd admin/frontend && $(PNPM) check && $(PNPM) test

admin-build: ## Build the separate admin release binary and frontend bundle
	@$(CARGO) build --release --manifest-path $(MANIFEST) -p naijachase-admin -p naijachase-tools
	@cd admin/frontend && $(PNPM) build

admin-prepare-config: ## Reuse game connection settings; generate service secrets and ask only for the web password
	@ADMIN_NODE_BIN="$(ADMIN_NODE)" bash deploy/admin/prepare-config.sh "$(ADMIN_SETUP_DIR)" "rust/target/release/naijachase-admin" "$(ADMIN_GAME_ENV_FILE)"

admin-provision: ## Explicitly apply DB setup; reuses prepared secrets and prompts once for DBA credentials if needed
	@$(ADMIN_NODE) deploy/admin/provision.mjs "$(ADMIN_SETUP_DIR)" "$(ADMIN_GAME_ENV_FILE)" "$(ADMIN_DB_ENV_FILE)" "rust/target/release/naijachase-tools"

admin-install-config: ## Install prepared private settings and the dedicated OS account; sudo only here
	@ADMIN_NODE_BIN="$(ADMIN_NODE)" bash deploy/admin/install-config.sh "$(ADMIN_SETUP_DIR)"

admin-setup: ## Prepare/resume admin settings, provision DB, then install final private service config
	@$(MAKE) admin-prepare-config
	@$(MAKE) admin-provision
	@$(MAKE) admin-install-config

admin-install-bundle: ## Install only the built admin binary and frontend on this server
	@test -f rust/target/release/naijachase-admin && test -f admin/frontend/dist/index.html
	@sudo install -d -m 0755 "$(ADMIN_INSTALL_ROOT)/bin" "$(ADMIN_WEB_ROOT)"
	@sudo install -m 0755 rust/target/release/naijachase-admin "$(ADMIN_INSTALL_ROOT)/bin/naijachase-admin"
	@sudo $(RSYNC) -rlt --delete --exclude='*.map' --exclude='.DS_Store' --delete-excluded --chmod=D755,F644 admin/frontend/dist/ "$(ADMIN_WEB_ROOT)/"

admin-install-service: ## Install the independent systemd unit without starting it
	@sudo install -m 0644 deploy/systemd/naijachase-admin.service "$(SYSTEMD_DIR)/naijachase-admin.service"
	@sudo systemctl daemon-reload

admin-start: ## Enable and start the configured admin service on this server
	@sudo systemctl enable --now naijachase-admin.service

admin-restart: ## Restart the independent admin service
	@sudo systemctl restart naijachase-admin.service

admin-status: ## Show admin service status and recent logs
	@sudo systemctl --no-pager --full status naijachase-admin.service
	@sudo journalctl -u naijachase-admin.service --no-pager -n 30

admin-nginx-http: ## Install first-run HTTP ACME site; refuses to replace an existing admin site
	@sudo install -d -m 0755 /var/lib/letsencrypt/.well-known/acme-challenge
	@sudo sh deploy/nginx/install-admin-site.sh deploy/nginx/admin.naijachase.app.http.conf "$(ADMIN_NGINX_SITE)" "$(ADMIN_NGINX_SITE_LINK)"

admin-nginx-https: ## Install the admin HTTPS site after certificate issuance
	@sudo test -f /etc/letsencrypt/live/admin.naijachase.app/fullchain.pem
	@sudo test -f /etc/letsencrypt/live/admin.naijachase.app/privkey.pem
	@sudo sh deploy/nginx/install-admin-site.sh deploy/nginx/admin.naijachase.app.conf "$(ADMIN_NGINX_SITE)" "$(ADMIN_NGINX_SITE_LINK)"

admin-install-renew-hook: ## Install Nginx validation/reload hook for successful certificate renewal
	@sudo install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
	@sudo install -m 0755 deploy/nginx/reload-admin-certificate.sh /etc/letsencrypt/renewal-hooks/deploy/naijachase-admin-nginx.sh

# =============================================================================
# Deployment
# Ship code to the production server and publish the API, web client, and
# landing site. Most targets use sudo and are run on the server.
# =============================================================================

# Build everything needed for deployment.
production-build: release web-production-build ## Build deployable Rust and web production artifacts

# rsync the source tree to the production host (local machine -> server).
copy-code: ## Synchronize source code to the production application server
	@$(RSYNC) -az --progress --delete-delay \
		--exclude='.git/' \
		--exclude='.env' \
		--exclude='.pnpm-store/' \
		--exclude='.vscode/' \
		--exclude='/archive/' \
		--exclude='rust/target/' \
		--exclude='web/node_modules/' \
		--exclude='web/dist/' \
		--exclude='web/asset-originals/' \
		--exclude='admin/frontend/node_modules/' \
		--exclude='admin/frontend/dist/' \
		--exclude='.env.local' \
		--exclude='.env.*.local' \
		--exclude='.DS_Store' \
		./ "$(DEPLOY_HOST):$(DEPLOY_PATH)"

# --- API service (systemd) ---

# Install the systemd unit and start it.
install-api-service: ## Install, enable, and start the production systemd API service
	@sudo install -m 0644 deploy/systemd/naijachase-api.service $(SYSTEMD_DIR)/naijachase-api.service
	@sudo systemctl daemon-reload
	@sudo systemctl enable --now naijachase-api.service

# Run explicitly, once per release, before restart-api. Never an API ExecStartPre.
.PHONY: deploy-migrate
deploy-migrate: ## Apply release migrations with the isolated deployment credentials
	@missing=0; \
		if ! getent passwd naijachase-migrate >/dev/null; then \
			echo "Missing OS account naijachase-migrate; provision the isolated migration service before using deploy-migrate." >&2; missing=1; \
		fi; \
		if ! sudo test -f /opt/naijachase/shared/migrations.env; then \
			echo "Missing /opt/naijachase/shared/migrations.env; this target does not use the repository .env." >&2; missing=1; \
		fi; \
		if ! test -x /opt/naijachase/source/rust/target/release/naijachase-tools; then \
			echo "Missing executable release migration tool; build and install the current release first." >&2; missing=1; \
		fi; \
		if test "$$missing" -ne 0; then \
			echo "For an explicitly selected existing deployment credential, use: NAIJACHASE_ENV_FILE=/absolute/private/env make db-migrate" >&2; \
			echo "That direct command needs schema migration privileges. No service credentials were copied automatically." >&2; exit 1; \
		fi
	@sudo install -m 0644 deploy/systemd/naijachase-migrate.service $(SYSTEMD_DIR)/naijachase-migrate.service
	@sudo systemctl daemon-reload
	@sudo systemctl start naijachase-migrate.service || { \
		sudo systemctl --no-pager --full status naijachase-migrate.service || true; \
		sudo journalctl -u naijachase-migrate.service --no-pager -n 60 || true; \
		exit 1; \
	}

# Restart the service to pick up a new build.
restart-api: ## Restart the production API after a successful build
	@sudo systemctl restart naijachase-api.service

# Inspect the service's health.
api-status: ## Show production API service status and recent logs
	@sudo systemctl --no-pager --full status naijachase-api.service
	@sudo journalctl -u naijachase-api.service --no-pager -n 30

# --- Web client and landing site (Nginx) ---

# Copy web/dist into the Nginx document root.
install-web: ## Publish the built static web client into the Nginx document root
	@test -f web/dist/index.html || { echo "web/dist is missing; run make production-build first"; exit 1; }
	@sudo install -d -m 0755 $(WEB_ROOT)
	@sudo install -d -m 0750 $(SOURCE_MAP_ROOT)/$(RELEASE)
	@sudo $(RSYNC) -rlt --delete --include='*/' --include='*.map' --exclude='*' --chmod=D750,F640 web/dist/ $(SOURCE_MAP_ROOT)/$(RELEASE)/
	@sudo $(RSYNC) -rlt --delete --exclude='*.map' --exclude='.DS_Store' --delete-excluded --chmod=D755,F644 web/dist/ $(WEB_ROOT)/

# Reconcile only the two owned sites; back up, reject duplicate warnings and reload.
.PHONY: repair-nginx
repair-nginx: install-nginx ## Repair duplicate NaijaChase virtual hosts and reload safely

install-nginx: ## Install both NaijaChase sites, disable the legacy duplicate, validate and reload
	@sudo sh deploy/nginx/install-sites.sh "$(NGINX_SITE)" "$(NGINX_SITE_LINK)" "$(LANDING_NGINX_SITE)" "$(LANDING_NGINX_SITE_LINK)"

# Publish the web client and its Nginx config together.
publish-web: install-web install-nginx ## Publish the web build and activate its Nginx configuration

# Publish the landing site files and Nginx config; roll back if the test fails.
publish-landing: ## Publish the static landing site (naijachase.com) and its Nginx site
	@sudo install -d -m 0755 $(LANDING_ROOT)
	@sudo $(RSYNC) -rlt --delete --chmod=D755,F644 landing/ $(LANDING_ROOT)/
	@$(MAKE) install-nginx

# =============================================================================
# Quality gates
# Aggregate checks that combine the targets above. `check` is the base gate;
# the pNN targets are the milestone gates that build on it.
# =============================================================================

# Reject leftover Python artifacts and whitespace errors in the diff.
audit: ## Reject legacy runtime artifacts and malformed patches
	@test -z "$$(find . -type f \( -name '*.py' -o -name '*.pyc' -o -name '*.pyo' \) \
		-not -path './.git/*' -not -path './rust/target/*')"
	@test -z "$$(find . -type d -name '__pycache__' -not -path './.git/*' \
		-not -path './rust/target/*')"
	@git diff --check

# Base gate: formatting, tests, content validation, and audit.
check: fmt-check test validate audit ## Run the full local quality gate

# Milestone P3.4: persistence.
p34: check db-rebuild db-test ## Run the complete P3.4 persistence gate

# Milestone P3.5: service safety.
p35: check db-test api-test ## Run the complete P3.5 service-safety gate

# Milestone P3.6: web slice.
p36: check api-test web-test web-build ## Run the complete P3.6 web-slice gate

# Milestone P3.9: economy and solvability.
p39: check simulate ## Run economy guardrails and full catalogue solvability checks

# Milestone P3.9.1: witness pressure, persistence, and solvability.
p391: check db-test api-test simulate ## Run witness-pressure, discipline, persistence, and solvability gates
