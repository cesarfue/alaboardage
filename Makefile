.PHONY: up down build logs ps shell-back shell-front \
        migrate prisma-generate import-geo import-sirene \
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

# Télécharge le découpage administratif (non commité) — voir backend/scripts/import-communes.mjs
import-geo:
	node backend/scripts/import-communes.mjs

# Importe la base SIRENE géolocalisée dans Postgres (non commité, ~928 Mo) —
# voir backend/scripts/import-sirene.sh. Nécessite que `make up` tourne.
import-sirene:
	bash backend/scripts/import-sirene.sh

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
