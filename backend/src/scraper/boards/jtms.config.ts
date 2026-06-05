import { handleSpelledDate } from '../transforms';
import type { BoardConfig } from '../types';

export const JTMS: BoardConfig = {
  name: 'JobsThatMakeSense',
  baseUrl: 'https://jobs.makesense.org',
  boardPath: '/fr/s/jobs?',
  jobPath: '{id}',
  selectors: {
    card: {
      selects: 'div.item',
      returns: { kind: 'html' },
    },
    id: {
      selects: 'a',
      returns: { kind: 'attribute', name: 'href' },
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
      selects: 'address',
      returns: { kind: 'text' },
    },
    description: {
      selects: 'div.job__content',
      returns: { kind: 'text' },
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
};
