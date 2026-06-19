# Scrapers alaboardage

Documentation de l'architecture scraper pour les sessions futures.

## Architecture

### `BoardScraper` + configs `boards/`

Le scraper générique vit dans `backend/src/scraper/board.scraper.ts`.
Chaque board est une config TypeScript dans `backend/src/scraper/boards/<name>.config.ts`
qui implémente `BoardConfig` (définie dans `types.ts`).

`ScraperService` (`scraper.service.ts`) est l'orchestrateur : pour chaque `JobSource`,
il instancie `BoardScraper` avec la config correspondante, ou dispatch vers `WTTJScraper`
pour WTTJ.

### Flux d'exécution `BoardScraper.search()`

1. Ouvre un `BrowserContext` Playwright avec un user-agent Chrome.
2. Boucle `while (jobs.length < limit)` :
   - Construit l'URL paginée via `buildBoardUrl(offset)`.
   - `page.goto()` + `waitForSelector(card)` (15 s max).
   - Si `boardPageAction` défini : s'exécute une seule fois (dismiss cookie, etc.).
   - Parse les cards via Cheerio (`extractCards` + `parseCard`).
   - Si `descriptionFromCard: true` : description prise dans la card (ex. Glassdoor).
   - Sinon : fetches des pages de détail par batches de 10 (parallèle).
   - Délai randomisé **entre pages** (1-3 s, configurable via `pageDelayMs`).
   - Délai léger **entre batches de descriptions** (300-800 ms).
   - Break si `singlePage || singlePageOnly || cards.length === 0`.
3. Ferme le contexte.

### `WTTJScraper` (Algolia API)

WTTJ a remplacé sa page de recherche publique par un funnel auth-gaté en 2025.
Le scraper utilise l'API Algolia embeddée (credentials dans `wttj.scraper.ts`).
Pas de Playwright — requêtes `fetch` directes vers Algolia.

`wttj.config.ts` est **obsolète** (conservé pour référence historique, sélecteurs cassés).

## Boards connus et leur état

| Board | Source | État | Pagination | Notes |
|---|---|---|---|---|
| Hellowork | `HELLOWORK` | OK | multi-page | Cookie banner auto-dismissed |
| LinkedIn | `LINKEDIN` | OK | multi-page | `pageDelayMs: 3000` pour anti-bot |
| JTMS | `JTMS` | OK | multi-page | Location corrigée (single + multi-city) |
| Jeunes d'Avenirs | `JEUNESDAVENIR` | OK | multi-page | GTM JSON pour company/city/date |
| WTTJ | `WTTJ` | OK | multi-page | Via Algolia API (pas BoardScraper) |
| Glassdoor | `GLASSDOOR` | Dégradé | `singlePageOnly` | 30 résultats, desc snippet (~200c), pas de pagination |
| Indeed | `INDEED` | Dégradé | `singlePageOnly` | Page 1 OK (16 résultats), page 2+ bloquée anti-bot |

## Ajouter un nouveau board

### 1. Créer le fichier de config

```
backend/src/scraper/boards/<name>.config.ts
```

Template minimal :

```ts
import type { BoardConfig } from '../types';

export const MYBOARD: BoardConfig = {
  name: 'MyBoard',
  baseUrl: 'https://www.myboard.fr',
  boardPath: '/jobs',        // chemin de la page de liste
  jobPath: '/job/{id}',      // chemin d'une offre (avec {id})
  selectors: {
    card:      { selects: 'div.job-card', returns: { kind: 'html' } },
    id:        { selects: 'div.job-card', returns: { kind: 'attribute', name: 'data-id' } },
    title:     { selects: 'h3.job-title', returns: { kind: 'text' } },
    company:   { selects: '.company-name', returns: { kind: 'text' } },
    location:  { selects: '.job-location', returns: { kind: 'text' } },
    description: { selects: '#job-description', returns: { kind: 'text' } },
    datePosted: { selects: 'time', returns: { kind: 'attribute', name: 'datetime' } },
  },
  urlParams: {
    query: 'q',       // nom du param URL pour la recherche
    location: 'l',    // nom du param URL pour la localisation
    offset: 'page',   // nom du param URL pour la pagination
  },
};
```

Options utiles :
- `descriptionFromCard: true` — description dans la card (pas de fetch détail)
- `singlePageOnly: true` — une seule page toujours (anti-bot ou scroll infini)
- `offsetBase: 0` — si la pagination commence à 0 plutôt que 1
- `pageDelayMs: 3000` — délai minimum entre pages (défaut 1000)
- `locationPathTransform` — si la localisation va dans le chemin URL (ex. JTMS)
- `boardPageAction` — action Playwright exécutée une fois sur la première page (dismiss cookie, etc.)

### 2. Ajouter le `JobSource` Prisma

Dans `prisma/schema.prisma`, ajouter la valeur à l'enum `JobSource`, puis :

```bash
npx prisma generate
npx prisma migrate dev --name add-myboard-source
```

### 3. Enregistrer dans `ScraperService`

Dans `scraper.service.ts`, importer et ajouter dans `configFor()` :

```ts
case JobSource.MYBOARD:
  return MYBOARD;
```

### 4. Écrire un test e2e

Créer `backend/test/scrapers/<name>.e2e-spec.ts` en suivant le pattern existant.
Toujours marquer les tests live avec `.skip` et le commentaire `// integration test — requires network`.

## Tester un scraper manuellement

```bash
cd backend

# WTTJ (Algolia, pas de browser)
node_modules/.bin/ts-node --project tsconfig.json test-wttj-temp.ts

# Board générique (nécessite Playwright installé)
node_modules/.bin/ts-node --project tsconfig.json test-board-temp.ts <hellowork|linkedin|jtms|jeunesdavenir|glassdoor>
```

Pour un test rapide ad hoc, créer un fichier `test-<name>-temp.ts` à la racine de `backend/`
(non commité) qui appelle directement le scraper.

### Lancer les tests unitaires (sans réseau)

```bash
cd backend
node_modules/.bin/jest --verbose
```

### Lancer un test e2e (avec réseau)

Retirer `.skip` dans le fichier `.e2e-spec.ts` concerné, puis :

```bash
cd backend
node_modules/.bin/jest --config ./test/jest-e2e.json --testPathPatterns=<name>
```

## Pièges connus

### Sélecteurs fragiles

- **Glassdoor** : `EmployerProfile_compactEmployerName__9MGcV` contient un hash CSS-modules qui peut changer à tout moment. À surveiller.
- **JTMS** : les offres multi-villes utilisent `div[name^="address-"]` au lieu de `<address>`. Les deux doivent être sélectionnés.
- **LinkedIn** : le sélecteur `time.job-search-card__listdate` peut manquer si la card est "récente" (LinkedIn utilise un sélecteur alternatif `time.job-search-card__listdate--new`). Actuellement non géré — `datePosted` tombe sur `new Date()`.

### Rate limiting / anti-bot

- **Indeed** : page 2+ déclenche un bot-check. `singlePageOnly: true` dans la config. 16 résultats max par recherche.
- **Glassdoor** : pages détail bloquées ("Humans only"). Description depuis la card seulement (~200 chars).
- **LinkedIn** : `pageDelayMs: 3000` + délai random. Ne pas réduire le délai.
- **WTTJ** : Algolia credentials publics — pas de rate limit strict connu, mais ne pas abuser.

### Rendu côté client

- **Indeed** : nécessite `waitForTimeout(5000)` après domcontentloaded (React).
- **LinkedIn, JTMS, Glassdoor** : `waitForSelector(card, timeout: 15000)` suffit.

### Prisma `generated/`

Le dossier `generated/` est produit par `npx prisma generate` — il n'est pas committé.
Dans un nouveau worktree, lancer `npm install && npx prisma generate` avant les tests.
