SHELL := /bin/sh

CARGO ?= cargo
MANIFEST := rust/Cargo.toml
TOOLS := $(CARGO) run --quiet --manifest-path $(MANIFEST) -p naijachase-tools --
SIMULATION_OUTPUT ?= data/gameplay/mission-balance-report.csv
EXPORT_DIR ?= build/content-export
ARGS ?=

.DEFAULT_GOAL := help

.PHONY: help play test test-storage check fmt fmt-check build release benchmark \
	validate editorial enrichment simulate export db-migrate db-import db-rebuild \
	db-verify db-export db-backup db-restore db-test p34 audit

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

benchmark: ## Run the core-engine throughput benchmark
	@$(CARGO) run --quiet --release --manifest-path $(MANIFEST) -p naijachase-core --example benchmark

validate: ## Validate the complete canonical content catalogue
	@$(TOOLS) validate

editorial: ## Run automated clue editorial checks
	@$(TOOLS) editorial

enrichment: ## Report semantic knowledge coverage
	@$(TOOLS) enrichment

simulate: ## Simulate all missions; override with SIMULATION_OUTPUT=path
	@$(TOOLS) simulate $(SIMULATION_OUTPUT)

export: ## Export canonical content; override with EXPORT_DIR=path
	@$(TOOLS) export $(EXPORT_DIR)

db-migrate: ## Apply pending MySQL migrations using the repository .env
	@$(TOOLS) migrate-mysql

db-import: ## Import every canonical CSV into MySQL transactionally
	@$(TOOLS) import-mysql

db-rebuild: ## Rebuild MySQL content and verify all mission outcomes
	@$(TOOLS) rebuild-mysql

db-verify: ## Verify MySQL checksums, row counts, export, and mission parity
	@$(TOOLS) verify-mysql

db-export: ## Export MySQL content; override with EXPORT_DIR=path
	@$(TOOLS) export-mysql $(EXPORT_DIR)

db-backup: ## Back up mutable MySQL player/career/case data
	@$(TOOLS) backup-mysql $(EXPORT_DIR)/operational-backup.json

db-restore: ## Restore mutable MySQL data from EXPORT_DIR backup
	@$(TOOLS) restore-mysql $(EXPORT_DIR)/operational-backup.json

db-test: ## Run live MySQL migration and state round-trip tests
	@NAIJACHASE_MYSQL_TEST=1 $(CARGO) test --manifest-path $(MANIFEST) \
		-p naijachase-storage live_mysql_migration_and_state_round_trip_when_enabled

p34: check db-rebuild db-test ## Run the complete P3.4 persistence gate

audit: ## Reject legacy runtime artifacts and malformed patches
	@test -z "$$(find . -type f \( -name '*.py' -o -name '*.pyc' -o -name '*.pyo' \) \
		-not -path './.git/*' -not -path './rust/target/*')"
	@test -z "$$(find . -type d -name '__pycache__' -not -path './.git/*' \
		-not -path './rust/target/*')"
	@git diff --check
