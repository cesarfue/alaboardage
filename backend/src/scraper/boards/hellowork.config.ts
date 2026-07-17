import type { BoardConfig } from '../types';
import { handleSpelledDate, helloworkDescription } from '../transforms';

export const HELLOWORK: BoardConfig = {
  name: 'Hellowork',
  baseUrl: 'https://www.hellowork.com/fr-fr',
  boardPath: '/emploi/recherche.html',
  jobPath: '/emplois/{id}.html',
  selectors: {
    card: {
      selects: "li[data-id-storage-target='item']",
      returns: { kind: 'html' },
    },
    id: {
      selects: "li[data-id-storage-target='item']",
      returns: { kind: 'attribute', name: 'data-id-storage-item-id' },
    },
    title: {
      selects: 'h3.inline p:first-of-type',
      returns: { kind: 'text' },
    },
    company: {
      selects: 'h3.inline p:last-of-type',
      returns: { kind: 'text' },
    },
    location: {
      selects: "div[data-cy='localisationCard']",
      returns: { kind: 'text' },
    },
    description: {
      // JSON-LD JobPosting is available on most detail pages; when it is not
      // (some aggregated offers), fall back to the visible "Détail du poste"
      // container. The transform detects which of the two it received.
      selects:
        'script[type="application/ld+json"]:contains("JobPosting"), [data-truncate-text-target="content"]',
      returns: { kind: 'html' },
      transforms: helloworkDescription,
    },
    datePosted: {
      selects: "div[class='tw-typo-s tw-text-grey-500 tw-pl-1 tw-pt-1']",
      returns: { kind: 'text' },
      transforms: handleSpelledDate,
    },
  },
  urlParams: {
    query: 'k',
    location: 'l',
    offset: 'p',
  },
  boardPageAction: async (page) => {
    const btn = page.locator('button#hw-cc-notice-accept-btn');
    try {
      await btn.click({ timeout: 5000 });
    } catch {
      // cookie banner already dismissed or absent
    }
  },
};
