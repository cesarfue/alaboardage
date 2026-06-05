import type { BoardConfig } from '../types';
import { jeunesdavenirsGtm, jeunesdavenirsId } from '../transforms';

export const JEUNESDAVENIR: BoardConfig = {
  name: "Jeunes d'Avenirs",
  baseUrl: 'https://jeunesdavenirs-recrut.fr',
  // Extra fixed params are baked into the path so the URL builder can append
  // what[search], where[search] and page on top of them.
  boardPath:
    '/offres?what%5Btype%5D=&where%5Bperimeter%5D=&publicationDateRange=All',
  jobPath: '/offre/{id}',
  selectors: {
    // Each card is a div.mb-6 that wraps a job offer link.
    // ":has()" is supported by Cheerio ≥1.0.
    card: {
      selects: 'div.mb-6:has(a[data-testid="offer-link"])',
      returns: { kind: 'html' },
    },
    // The href contains the full path; we strip it down to "i_<hex>" which is
    // then placed into jobPath via buildJobUrl.
    id: {
      selects: 'a[data-testid="offer-link"]',
      returns: { kind: 'attribute', name: 'href' },
      transforms: jeunesdavenirsId,
    },
    title: {
      selects: 'a[data-testid="offer-link"]',
      returns: { kind: 'text' },
    },
    // Company, city and date are reliably encoded in the GTM JSON attribute,
    // which avoids fragile positional CSS selectors that shift with optional
    // fields (remote work badge, salary badge).
    company: {
      selects: 'a[data-testid="offer-link"]',
      returns: { kind: 'attribute', name: 'data-gtm-product-click-param' },
      transforms: jeunesdavenirsGtm('product_company'),
    },
    location: {
      selects: 'a[data-testid="offer-link"]',
      returns: { kind: 'attribute', name: 'data-gtm-product-click-param' },
      transforms: jeunesdavenirsGtm('product_city'),
    },
    // product_date is already ISO (YYYY-MM-DD) — parseDate handles it directly.
    datePosted: {
      selects: 'a[data-testid="offer-link"]',
      returns: { kind: 'attribute', name: 'data-gtm-product-click-param' },
      transforms: jeunesdavenirsGtm('product_date'),
    },
    // Description is fetched from the job detail page.
    description: {
      selects: 'div.wysiwyg',
      returns: { kind: 'text' },
    },
  },
  urlParams: {
    query: 'what[search]',
    location: 'where[search]',
    offset: 'page',
  },
};
