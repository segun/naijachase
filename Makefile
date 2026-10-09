SHELL := /bin/sh

CARGO ?= cargo
CODEX_NODE_BIN := $(HOME)/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin
CODEX_PNPM := $(HOME)/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm
ifneq ($(wildcard $(CODEX_PNPM)),)
PNPM ?= env PATH="$(CODEX_NODE_BIN):$(PATH)" "$(CODEX_PNPM)"
else
PNPM ?= pnpm
endif
RSYNC ?= rsync
DEPLOY_HOST ?= drawback-web01
DEPLOY_PATH ?= /opt/naijachase/source/
SYSTEMD_DIR ?= /etc/systemd/system
NGINX_SITE ?= /etc/nginx/sites-available/004-naijachase.app
NGINX_SITE_LINK ?= /etc/nginx/sites-enabled/004-naijachase.app
LANDING_ROOT ?= /var/www/naijachase.com
LANDING_NGINX_SITE ?= /etc/nginx/sites-available/003-naijachase.com
LANDING_NGINX_SITE_LINK ?= /etc/nginx/sites-enabled/003-naijachase.com
WEB_ROOT ?= /var/www/naijachase.app
MANIFEST := rust/Cargo.toml
TOOLS := $(CARGO) run --quiet --manifest-path $(MANIFEST) -p naijachase-tools --
SIMULATION_OUTPUT ?= data/gameplay/mission-balance-report.csv
EXPORT_DIR ?= build/content-export
ARGS ?=

.DEFAULT_GOAL := help

.PHONY: help play test test-storage check fmt fmt-check build release production-build benchmark \
	validate editorial enrichment simulate export db-migrate db-import db-rebuild \
	db-verify db-publish-initial db-export db-backup db-restore db-test api api-test web web-build enrich-state-clues standardize-witness-english \
	export-witness-scenes web-install web-production-build web-mock web-mock-ui web-test copy-code \
	install-api-service restart-api api-status install-web install-nginx publish-web \
	publish-landing \
	p34 p35 p36 p39 p391 audit

help: ## Show the common project commands
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_-]+:.*## / {printf "  %-16s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

play: ## Play the terminal game; pass options with ARGS="..."
	@./play $(ARGS)

test: ## Run the complete Rust workspace test suite
	@$(CARGO) test --manifest-path $(MANIFEST) --workspace

test-storage: ## Run storage unit tests without requiring a live database
	@$(CARGO) test --manifest-path $(MANIFEST) -p naijachase-storage

check: fmt-check test validate audit ## Run the full local quality gate

fmt: ## Format every Rust crate
	@$(CARGO) fmt --manifest-path $(MANIFEST) --all

fmt-check: ## Check Rust formatting without changing files
	@$(CARGO) fmt --manifest-path $(MANIFEST) --all -- --check

build: ## Build the Rust workspace in debug mode
	@$(CARGO) build --manifest-path $(MANIFEST) --workspace

release: ## Build the Rust workspace in release mode
	@$(CARGO) build --manifest-path $(MANIFEST) --workspace --release

production-build: release web-production-build ## Build deployable Rust and web production artifacts

benchmark: ## Run the core-engine throughput benchmark
	@$(CARGO) run --quiet --release --manifest-path $(MANIFEST) -p naijachase-core --example benchmark

validate: ## Validate the complete canonical content catalogue
	@$(TOOLS) validate

editorial: ## Run automated clue editorial checks
	@$(TOOLS) editorial

enrichment: ## Report semantic knowledge coverage
	@$(TOOLS) enrichment

enrich-state-clues: ## Rebuild state motto, city, landmark, and economy witness clues
	@$(TOOLS) enrich-state-clues

standardize-witness-english: ## Remove non-English witness variants and standardize editorial metadata
	@$(TOOLS) standardize-witness-english

export-witness-scenes: ## Export Babylon.js witness venue and location scene descriptions
	@$(TOOLS) export-witness-scenes data/exports/witness-location-scenes.json

simulate: ## Simulate all missions; override with SIMULATION_OUTPUT=path
	@$(TOOLS) simulate $(SIMULATION_OUTPUT)

export: ## Export canonical content; override with EXPORT_DIR=path
	@$(TOOLS) export $(EXPORT_DIR)

db-migrate: ## Apply pending MySQL migrations using the repository .env
	@$(TOOLS) migrate-mysql

db-import: validate simulate ## Validate, simulate, then import every canonical CSV into MySQL transactionally
	@$(TOOLS) import-mysql

db-rebuild: validate simulate ## Validate and simulate before rebuilding MySQL content
	@$(TOOLS) rebuild-mysql

db-verify: ## Verify MySQL checksums, row counts, export, and mission parity
	@$(TOOLS) verify-mysql

db-publish-initial: ## Validate and publish an imported first-production catalogue exactly once
	@$(TOOLS) publish-initial-mysql

db-export: ## Export MySQL content; override with EXPORT_DIR=path
	@$(TOOLS) export-mysql $(EXPORT_DIR)

db-backup: ## Back up mutable MySQL player/career/case data
	@$(TOOLS) backup-mysql $(EXPORT_DIR)/operational-backup.json

db-restore: ## Restore mutable MySQL data from EXPORT_DIR backup
	@$(TOOLS) restore-mysql $(EXPORT_DIR)/operational-backup.json

db-test: ## Run live MySQL migration, recovery, concurrency, and idempotency tests
	@NAIJACHASE_MYSQL_TEST=1 $(CARGO) test --manifest-path $(MANIFEST) -p naijachase-storage -- --test-threads=1

api: ## Start the versioned HTTP API using .env configuration
	@$(CARGO) run --manifest-path $(MANIFEST) -p naijachase-api

api-test: ## Run API unit, contract, load, and security tests
	@$(CARGO) test --manifest-path $(MANIFEST) -p naijachase-api

web: ## Start the responsive web client at http://127.0.0.1:4173
	@cd web && $(PNPM) dev --force

web-build: ## Type-check and build the optimized web client
	@cd web && $(PNPM) build

web-install: ## Install the exact locked web dependencies
	@cd web && $(PNPM) install --frozen-lockfile

web-production-build: web-install ## Install dependencies and build the production web client
	@cd web && $(PNPM) build

web-mock: ## Start the in-memory mock API on port 8081 (UI development without MySQL)
	@cd web && node dev/mock-api.mjs

web-mock-ui: ## Start the web client against the mock API
	@cd web && API_TARGET=http://127.0.0.1:8081 $(PNPM) dev

web-test: ## Run web accessibility, privacy, mobile, and weight guards
	@cd web && $(PNPM) test

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

install-api-service: ## Install, enable, and start the production systemd API service
	@sudo install -m 0644 deploy/systemd/naijachase-api.service $(SYSTEMD_DIR)/naijachase-api.service
	@sudo systemctl daemon-reload
	@sudo systemctl enable --now naijachase-api.service

restart-api: ## Restart the production API after a successful build
	@sudo systemctl restart naijachase-api.service

api-status: ## Show production API service status and recent logs
	@sudo systemctl --no-pager --full status naijachase-api.service
	@sudo journalctl -u naijachase-api.service --no-pager -n 30

install-web: ## Publish the built static web client into the Nginx document root
	@test -f web/dist/index.html || { echo "web/dist is missing; run make production-build first"; exit 1; }
	@sudo install -d -m 0755 $(WEB_ROOT)
	@sudo $(RSYNC) -rlt --delete --chmod=D755,F644 web/dist/ $(WEB_ROOT)/

install-nginx: ## Install, validate, and reload the NaijaChase Nginx site
	@if [ -f $(NGINX_SITE) ]; then sudo cp -a $(NGINX_SITE) $(NGINX_SITE).previous; fi
	@sudo install -m 0644 deploy/nginx/naijachase.app.conf $(NGINX_SITE)
	@sudo ln -sfn $(NGINX_SITE) $(NGINX_SITE_LINK)
	@sudo nginx -t || { sudo cp -a $(NGINX_SITE).previous $(NGINX_SITE); sudo nginx -t; exit 1; }
	@sudo systemctl reload nginx

publish-web: install-web install-nginx ## Publish the web build and activate its Nginx configuration

publish-landing: ## Publish the static landing site (naijachase.com) and its Nginx site
	@sudo install -d -m 0755 $(LANDING_ROOT)
	@sudo $(RSYNC) -rlt --delete --chmod=D755,F644 landing/ $(LANDING_ROOT)/
	@if [ -f $(LANDING_NGINX_SITE) ]; then sudo cp -a $(LANDING_NGINX_SITE) $(LANDING_NGINX_SITE).previous; fi
	@sudo install -m 0644 deploy/nginx/naijachase.com.conf $(LANDING_NGINX_SITE)
	@sudo ln -sfn $(LANDING_NGINX_SITE) $(LANDING_NGINX_SITE_LINK)
	@sudo nginx -t || { sudo cp -a $(LANDING_NGINX_SITE).previous $(LANDING_NGINX_SITE); sudo nginx -t; exit 1; }
	@sudo systemctl reload nginx

p34: check db-rebuild db-test ## Run the complete P3.4 persistence gate

p35: check db-test api-test ## Run the complete P3.5 service-safety gate

p36: check api-test web-test web-build ## Run the complete P3.6 web-slice gate

p39: check simulate ## Run economy guardrails and full catalogue solvability checks

p391: check db-test api-test simulate ## Run witness-pressure, discipline, persistence, and solvability gates

audit: ## Reject legacy runtime artifacts and malformed patches
	@test -z "$$(find . -type f \( -name '*.py' -o -name '*.pyc' -o -name '*.pyo' \) \
		-not -path './.git/*' -not -path './rust/target/*')"
	@test -z "$$(find . -type d -name '__pycache__' -not -path './.git/*' \
		-not -path './rust/target/*')"
	@git diff --check
