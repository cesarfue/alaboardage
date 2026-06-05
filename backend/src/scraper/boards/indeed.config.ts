/**
 * Indeed — Rapport de faisabilité (2026-06-05)
 *
 * Résultat : PARTIELLEMENT POSSIBLE (page 1 uniquement)
 *
 * Ce qui a été testé :
 * - Playwright headless + userAgent Chrome/124 sur fr.indeed.com/jobs
 * - Navigation vers la page 2 (start=10), avec et sans cookies de page 1
 * - Navigation organique via le lien "Suivant" trouvé dans le DOM
 * - RSS feed (fr.indeed.com/rss?q=...&l=...)
 * - Ancienne API publique (api.indeed.com/ads/apisearch)
 * - JSON-LD structured data sur les pages de détail (/viewjob?jk=ID)
 *
 * Résultats détaillés :
 * - Page 1 : HTTP 200, 16 job cards extraites sans blocage ni CAPTCHA.
 *   Requiert un waitForTimeout(5000) après domcontentloaded (rendu React côté client).
 * - Page 2+ : déclenche une page anti-bot ("Un instant…" / bot check) même
 *   après avoir visité page 1 (pas de session cookie suffisant). Redirect vers
 *   login ou challenge page.
 * - RSS feed : 404 — supprimé.
 * - API api.indeed.com : DNS inexistant — API publique entièrement désactivée.
 * - Page de détail (/viewjob?jk=ID) : charge normalement, expose un JSON-LD
 *   (schema.org JobPosting) avec datePosted, description HTML complète, salaire,
 *   employmentType, hiringOrganization, jobLocation.
 *
 * Sélecteurs CSS stables (vérifiés) :
 * - Card container : `.job_seen_beacon` (div englobant chaque offre)
 * - ID (data-jk) : `a[data-jk]` → attribut `data-jk`
 * - Titre : `[id^="jobTitle"]` (span dans le lien)
 * - Entreprise : `[data-testid="company-name"]`
 * - Localisation : `[data-testid="text-location"]`
 * - Date : absente de la card → extraire du JSON-LD `script[type="application/ld+json"]`
 *   sur la page de détail (champ `datePosted`)
 * - Description : `#jobDescriptionText` sur la page de détail
 * - URL de détail : https://fr.indeed.com/viewjob?jk={id}
 * - Pagination : `?start={offset*10}` (10 résultats par page, mais bloqué dès page 2)
 *
 * Blocages identifiés :
 * 1. Pagination bloquée dès la page 2 : anti-bot déclenché par le paramètre `start=10+`
 *    même avec un Referer et des cookies de session valides.
 * 2. Pas d'API publique disponible (RSS supprimé, api.indeed.com désactivé).
 * 3. Le rendu est côté client (React) : nécessite un délai de 5 s après domcontentloaded.
 *
 * Recommandation :
 * - Scraper la page 1 uniquement (16 offres par recherche). C'est fonctionnel pour
 *   un MVP — lancer plusieurs recherches avec des requêtes différentes si plus de
 *   résultats sont nécessaires.
 * - Récupérer datePosted et description depuis le JSON-LD de la page de détail
 *   plutôt que depuis la card (plus fiable et plus complet).
 * - Ne pas tenter de pagination automatique : risque de blocage de l'IP.
 * - Si la volumétrie devient un besoin, envisager un service tiers (ScraperAPI,
 *   Bright Data) ou l'API partenaire Indeed (nécessite contrat éditeur).
 */

import type { BoardConfig } from '../types';

/**
 * Config partielle — page 1 uniquement, date extraite du JSON-LD en page de détail.
 *
 * Note : le champ `datePosted` dans la card est absent ; le scraper devra surcharger
 * `fetchDescription` pour aussi parser le JSON-LD et en extraire la date.
 * Cette config suppose une adaptation du BoardScraper (hors scope de ce R&D).
 */
export const INDEED: BoardConfig = {
  name: 'Indeed',
  baseUrl: 'https://fr.indeed.com',
  boardPath: '/jobs',
  jobPath: '/viewjob?jk={id}',
  selectors: {
    card: {
      // Each offer is wrapped in a .job_seen_beacon div inside a <li>
      selects: '.job_seen_beacon',
      returns: { kind: 'html' },
    },
    id: {
      // The title link carries data-jk — the unique job key used in the detail URL
      selects: 'a[data-jk]',
      returns: { kind: 'attribute', name: 'data-jk' },
    },
    title: {
      selects: '[id^="jobTitle"]',
      returns: { kind: 'text' },
    },
    company: {
      selects: '[data-testid="company-name"]',
      returns: { kind: 'text' },
    },
    location: {
      selects: '[data-testid="text-location"]',
      returns: { kind: 'text' },
    },
    description: {
      // Full description on the detail page
      selects: '#jobDescriptionText',
      returns: { kind: 'text' },
    },
    datePosted: {
      // datePosted is NOT on the card; it lives in the JSON-LD on the detail page.
      // This selector is a placeholder — the current BoardScraper architecture
      // does not support JSON-LD extraction. Either extend the scraper or fall back
      // to today's date when datePosted is absent from the card.
      selects: 'script[type="application/ld+json"]',
      returns: { kind: 'text' },
    },
  },
  urlParams: {
    query: 'q',
    location: 'l',
    // offset in BoardScraper is incremented by 1 per page; Indeed uses start=N*10.
    // This mapping is wrong for Indeed (would need offset * 10).
    // For now, single-page scraping only — singlePage: true should be set in the request.
    offset: 'start',
  },
  boardPageAction: async (page) => {
    // Indeed renders job cards client-side; wait 5 s after domcontentloaded
    await page.waitForTimeout(5000);
  },
};
