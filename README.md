# Alaboardage

Agrégateur d'offres d'emploi : scrape plusieurs boards (Hellowork, LinkedIn, JobsThatMakeSense, Jeunes d'Avenirs, Glassdoor, Welcome to the Jungle), centralise les résultats en base, les score selon des compétences déclarées, et les affiche sur une carte.

Application mono-utilisateur, pensée pour l'auto-hébergement (VPS perso ou machine locale) : pas de compte, pas de connexion, une seule instance sert une seule personne.

## Stack

- **Backend** : NestJS 11, Prisma 7 (driver adapter `pg`), PostgreSQL 16. Scraping via Playwright.
- **Frontend** : SvelteKit 5 (runes), Tailwind CSS 4, shadcn-svelte, MapLibre GL.
- Développement entièrement conteneurisé via Docker Compose.

## Prérequis

- Docker et Docker Compose.
- `make` (optionnel — chaque cible du Makefile a un équivalent `docker compose` direct, listé plus bas).

## Installation

1. Cloner le repo.
2. Copier le fichier d'exemple d'environnement :
   ```bash
   cp .env.example .env
   ```
   Les valeurs par défaut suffisent pour un premier lancement — il n'y a ni compte à créer ni clé à obtenir auprès d'un service tiers.

## Lancer le projet

Une seule commande démarre tout — Postgres, backend, frontend et Prisma Studio :

```bash
make up
```

(équivalent sans `make` : `docker compose up -d`)

Le backend applique le schéma Prisma au démarrage du conteneur (`prisma db push`) ; il n'y a pas de migration à lancer à la main pour avoir une base à jour.

Une fois les conteneurs démarrés :

| Service        | URL                     |
|----------------|-------------------------|
| Frontend       | http://localhost:5173   |
| Backend (API)  | http://localhost:3000   |
| Prisma Studio  | http://localhost:5555   |

## Scraping automatique

Le rafraîchissement périodique des recherches sauvegardées (fréquence et activation) se règle depuis l'onglet Paramètres de l'application, pas par variable d'environnement — le réglage est stocké en base et prend effet sans redémarrage. Pour une instance qu'on ne laisse pas tourner en continu (usage ponctuel sur un poste personnel), il se désactive et chaque recherche se rafraîchit alors à la demande, via le bouton de rafraîchissement de son onglet.

## Commandes utiles

| Commande             | Effet                                                   |
|----------------------|------------------------------------------------------------|
| `make up`            | Démarre tous les services (en arrière-plan)              |
| `make up-build`      | Démarre en reconstruisant les images                     |
| `make down`          | Arrête les services                                       |
| `make re`            | Redémarre (`down` puis `up`)                              |
| `make logs`          | Suit les logs de tous les services                        |
| `make ps`            | État des conteneurs                                       |
| `make shell-back`    | Ouvre un shell dans le conteneur backend                  |
| `make shell-front`   | Ouvre un shell dans le conteneur frontend                 |
| `make lint-back`     | Lint backend                                              |
| `make lint-front`    | Typecheck frontend (`svelte-check`)                       |
| `make test-back`     | Tests backend (Jest)                                      |
| `make clean`         | Arrête les services et supprime les volumes (reset complet, base de données incluse) |

## Vérifications avant de pousser

```bash
bash scripts/ci-local.sh
```

Reproduit les checks de la CI (lint + tests backend, lint + typecheck frontend). Ce script tourne sur l'hôte, pas dans les conteneurs : il faut avoir installé les dépendances en local au moins une fois dans `backend/` et `frontend/` (`npm install`) pour qu'il fonctionne.
