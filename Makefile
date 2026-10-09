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
	validate editorial enrichment enrich-state-clues standardize-witness-english \
	export-witness-scenes simulate export \
	db-migrate db-import db-rebuild db-verify db-publish-initial db-export \
	db-backup db-restore db-test \
	web web-build web-install web-production-build web-mock web-mock-ui web-test \
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

# Regenerate witness clues for each state.
enrich-state-clues: ## Rebuild state motto, city, landmark, and economy witness clues
	@$(TOOLS) enrich-state-clues

# Clean up witness clue language and metadata.
standardize-witness-english: ## Remove non-English witness variants and standardize editorial metadata
	@$(TOOLS) standardize-witness-english

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
db-migrate: ## Apply pending MySQL migrations using the repository .env
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
	@cd web && $(PNPM) build

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
		--exclude='.DS_Store' \
		./ "$(DEPLOY_HOST):$(DEPLOY_PATH)"

# --- API service (systemd) ---

# Install the systemd unit and start it.
install-api-service: ## Install, enable, and start the production systemd API service
	@sudo install -m 0644 deploy/systemd/naijachase-api.service $(SYSTEMD_DIR)/naijachase-api.service
	@sudo systemctl daemon-reload
	@sudo systemctl enable --now naijachase-api.service

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
	@sudo $(RSYNC) -rlt --delete --chmod=D755,F644 web/dist/ $(WEB_ROOT)/

# Install the app's Nginx site; roll back if the config test fails.
install-nginx: ## Install, validate, and reload the NaijaChase Nginx site
	@if [ -f $(NGINX_SITE) ]; then sudo cp -a $(NGINX_SITE) $(NGINX_SITE).previous; fi
	@sudo install -m 0644 deploy/nginx/naijachase.app.conf $(NGINX_SITE)
	@sudo ln -sfn $(NGINX_SITE) $(NGINX_SITE_LINK)
	@sudo nginx -t || { sudo cp -a $(NGINX_SITE).previous $(NGINX_SITE); sudo nginx -t; exit 1; }
	@sudo systemctl reload nginx

# Publish the web client and its Nginx config together.
publish-web: install-web install-nginx ## Publish the web build and activate its Nginx configuration

# Publish the landing site files and Nginx config; roll back if the test fails.
publish-landing: ## Publish the static landing site (naijachase.com) and its Nginx site
	@sudo install -d -m 0755 $(LANDING_ROOT)
	@sudo $(RSYNC) -rlt --delete --chmod=D755,F644 landing/ $(LANDING_ROOT)/
	@if [ -f $(LANDING_NGINX_SITE) ]; then sudo cp -a $(LANDING_NGINX_SITE) $(LANDING_NGINX_SITE).previous; fi
	@sudo install -m 0644 deploy/nginx/naijachase.com.conf $(LANDING_NGINX_SITE)
	@sudo ln -sfn $(LANDING_NGINX_SITE) $(LANDING_NGINX_SITE_LINK)
	@sudo nginx -t || { sudo cp -a $(LANDING_NGINX_SITE).previous $(LANDING_NGINX_SITE); sudo nginx -t; exit 1; }
	@sudo systemctl reload nginx

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
