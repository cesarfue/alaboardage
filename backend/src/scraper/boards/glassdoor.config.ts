import type { BoardConfig } from '../types';
import { glassdoorAge } from '../transforms';

/*
 * Glassdoor scraper — France, all jobs (not filtered by query/location).
 *
 * Limitations:
 * - The board URL is a pre-built slug that encodes location (IN86 = France) and
 *   keyword. Glassdoor does not expose a public search API with simple query params,
 *   so dynamic filtering by query/location is not supported through this config.
 * - Job detail pages are blocked by Glassdoor's anti-bot wall ("Humans only").
 *   Descriptions are taken from the short snippet embedded in each card
 *   (~150 chars, may be truncated). Full descriptions are not available.
 * - Pagination beyond page 1 is not supported (JS-driven infinite scroll).
 * - 30 cards are returned per page.
 */

export const GLASSDOOR: BoardConfig = {
  name: 'Glassdoor',
  baseUrl: 'https://www.glassdoor.fr',
  boardPath: '/Emploi/france-developpeur-emplois-SRCH_IL.0,6_IN86_KO7,18.htm',
  jobPath: '/job-listing/job.htm?jl={id}',
  descriptionFromCard: true,
  selectors: {
    card: {
      selects: '[data-test="jobListing"]',
      returns: { kind: 'html' },
    },
    id: {
      selects: '[data-test="jobListing"]',
      returns: { kind: 'attribute', name: 'data-jobid' },
    },
    title: {
      selects: '[data-test="job-title"]',
      returns: { kind: 'text' },
    },
    company: {
      selects: '.EmployerProfile_compactEmployerName__9MGcV',
      returns: { kind: 'text' },
    },
    location: {
      selects: '[data-test="emp-location"]',
      returns: { kind: 'text' },
    },
    description: {
      // Short snippet (~150 chars) embedded in the card. Full description
      // is unavailable because Glassdoor blocks headless detail page fetches.
      selects: '[data-test="descSnippet"]',
      returns: { kind: 'text' },
    },
    datePosted: {
      // Format: "9j", "25j", "30j+" — compact French day-ago notation.
      selects: '[data-test="job-age"]',
      returns: { kind: 'text' },
      transforms: glassdoorAge,
    },
  },
  urlParams: {
    // No dynamic query/location params — URL is a static slug.
  },
  // Glassdoor uses JS-driven infinite scroll; there is no URL-based next page.
  singlePageOnly: true,
};
