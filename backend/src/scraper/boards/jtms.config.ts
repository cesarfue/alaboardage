import { parseDate } from '../transforms';
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
      transforms: (raw) => parseDate(raw).toISOString().slice(0, 10),
    },
  },
  urlParams: {
    query: 's',
    location: '',
    offset: 'items_page',
  },
};
