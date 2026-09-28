import { handleSpelledDate, htmlToText } from '../transforms';
import type { BoardConfig } from '../types';

export const JTMS: BoardConfig = {
  name: 'JobsThatMakeSense',
  baseUrl: 'https://jobs.makesense.org',
  boardPath: '/fr/s/jobs/{location}',
  jobPath: '/fr/jobs/{id}',
  locationPathTransform: (loc) =>
    loc
      .split(', ')
      .map((p) => p.replace(/ /g, '-'))
      .join('--'),
  selectors: {
    card: {
      selects: 'div.item',
      returns: { kind: 'html' },
    },
    id: {
      selects: 'a.job__link',
      returns: { kind: 'attribute', name: 'href' },
      transforms: (href) => href.split('?')[0].split('/').pop() ?? '',
    },
    title: {
      selects: 'h3.job__title',
      returns: { kind: 'text' },
    },
    company: {
      selects: 'span.job__company',
      returns: { kind: 'text' },
    },
    location: {
      // Single-city jobs use <address>; multi-city jobs render in div[name^="address-"].
      // Both selectors are needed; the first match wins (n defaults to [0,1]).
      // Strip the leading SVG title text ("Localisation") that Cheerio includes.
      selects: 'address, div[name^="address-"]',
      returns: { kind: 'text' },
      transforms: (t) =>
        t
          .replace(/^Localisation\s*/i, '')
          .replace(/\s+/g, ' ')
          .trim(),
    },
    description: {
      selects: 'main.job__main-content',
      returns: { kind: 'html' },
      transforms: htmlToText,
    },
    datePosted: {
      selects: 'span.job__date',
      returns: { kind: 'text' },
      transforms: handleSpelledDate,
    },
  },
  urlParams: {
    query: 's',
    location: '',
    offset: 'items_page',
  },
  // makesense pagine à partir de 0 : items_page=0 = page 1.
  offsetBase: 0,
};
