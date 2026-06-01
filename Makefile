SHELL := /bin/bash

.PHONY: help install up down logs ps restart build rebuild clean shell-back shell-front db-shell migrate generate studio test

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install npm deps in both apps (inside containers)
	docker compose run --rm --no-deps backend npm install
	docker compose run --rm --no-deps frontend npm install

up: ## Start the stack (build if needed)
	docker compose up -d --build

down: ## Stop the stack
	docker compose down

logs: ## Tail logs from all services
	docker compose logs -f --tail=200

ps: ## List running services
	docker compose ps

restart: ## Restart all services
	docker compose restart

build: ## Build images
	docker compose build

rebuild: ## Rebuild images without cache
	docker compose build --no-cache

clean: ## Stop and remove containers, volumes, networks
	docker compose down -v

shell-back: ## Open a shell in the backend container
	docker compose exec backend sh

shell-front: ## Open a shell in the frontend container
	docker compose exec frontend sh

db-shell: ## Open a psql shell
	docker compose exec db psql -U $${POSTGRES_USER:-alaboardage} -d $${POSTGRES_DB:-alaboardage}

migrate: ## Run prisma migrate dev
	docker compose exec backend npx prisma migrate dev

generate: ## Run prisma generate
	docker compose exec backend npx prisma generate

studio: ## Open prisma studio (http://localhost:5555)
	docker compose exec backend npx prisma studio

test: ## Run backend unit tests
	docker compose exec backend npm test

# args after `make test-e2e` are forwarded to jest as a filename pattern,
# e.g. `make test-e2e linkedin` runs only test/scrapers/linkedin.e2e-spec.ts
TEST_E2E_ARGS = $(filter-out test-e2e,$(MAKECMDGOALS))

test-e2e: ## Run backend e2e tests; pass a board name to scope (e.g. `make test-e2e linkedin`)
	docker compose exec backend npm run test:e2e -- $(TEST_E2E_ARGS)

# swallow extra goals so `make test-e2e linkedin` doesn't error on the `linkedin` target
%:
	@:
