.PHONY: up down build logs ps shell-back shell-front \
        migrate prisma-generate \
        lint-back lint-front test-back \
        clean

# ── Docker ────────────────────────────────────────────────────────────────────

up:
	docker compose up -d

up-build:
	docker compose up --build -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

ps:
	docker compose ps

# ── Shells ────────────────────────────────────────────────────────────────────

shell-back:
	docker compose exec backend bash

shell-front:
	docker compose exec frontend sh

# ── Base de données ───────────────────────────────────────────────────────────

migrate:
	docker compose exec backend npx prisma migrate dev

prisma-generate:
	docker compose exec backend npx prisma generate

# ── Qualité ───────────────────────────────────────────────────────────────────

lint-back:
	docker compose exec backend npm run lint

lint-front:
	docker compose exec frontend npm run check

test-back:
	docker compose exec backend npm run test

# ── Nettoyage ─────────────────────────────────────────────────────────────────

clean:
	docker compose down -v --remove-orphans
