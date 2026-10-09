import type { BoardConfig } from '../types';
import { htmlToText, linkedinId } from '../transforms';

export const LINKEDIN: BoardConfig = {
  name: 'LinkedIn',
  baseUrl: 'https://www.linkedin.com',
  boardPath: '/jobs-guest/jobs/api/seeMoreJobPostings/search?',
  jobPath: '/jobs-guest/jobs/api/jobPosting/{id}',
  displayJobPath: '/jobs/view/{id}',
  selectors: {
    card: {
      selects: 'div.base-search-card',
      returns: { kind: 'html' },
    },
    id: {
      selects: 'div.base-search-card',
      returns: { kind: 'attribute', name: 'data-entity-urn' },
      transforms: linkedinId,
    },
    title: {
      selects: 'h3.base-search-card__title',
      returns: { kind: 'text' },
    },
    company: {
      selects: 'h4.base-search-card__subtitle a',
      returns: { kind: 'text' },
    },
    location: {
      selects: 'span.job-search-card__location',
      returns: { kind: 'text' },
    },
    description: {
      selects: 'div.show-more-less-html__markup',
      returns: { kind: 'html' },
      transforms: htmlToText,
    },
    datePosted: {
      selects: 'time.job-search-card__listdate',
      returns: { kind: 'attribute', name: 'datetime' },
    },
  },
  urlParams: {
    query: 'keywords',
    location: 'location',
    offset: 'start',
  },
  offsetBase: 0,
  offsetStep: 10,
  // LinkedIn flags rapid sequential requests; use a longer inter-page delay.
  pageDelayMs: 3000,
};
