/**
 * @deprecated This config is no longer used.
 *
 * WTTJ replaced its public search page with an auth-gated funnel in 2025.
 * The scraper was rewritten to use the Algolia API exposed in window.env
 * (see wttj.scraper.ts). ScraperService routes JobSource.WTTJ directly to
 * WTTJScraper — BoardScraper + this config are never called for WTTJ.
 *
 * Kept for historical reference; selectors below are stale and will not work.
 */

import type { BoardConfig } from '../types';

export const WTTJ: BoardConfig = {
  name: 'WelcomeToTheJungle',
  baseUrl: 'https://www.welcometothejungle.com',
  boardPath: '/fr/jobs?',
  jobPath: '{id}',
  selectors: {
    card: {
      selects: "li[data-testid='search-results-list-item-wrapper']",
      returns: { kind: 'html' },
    },
    id: {
      selects: 'a',
      returns: { kind: 'attribute', name: 'href' },
    },
    title: {
      selects: "div[role='mark']",
      returns: { kind: 'text' },
    },
    company: {
      selects: 'span.wui-text',
      returns: { kind: 'text' },
    },
    location: {
      selects: "i[name='location'] + span > span",
      returns: { kind: 'text' },
    },
    description: {
      selects: 'div#the-position-section',
      returns: { kind: 'text' },
    },
    datePosted: {
      selects: 'time',
      returns: { kind: 'attribute', name: 'datetime' },
    },
  },
  urlParams: {
    query: 'query',
    location: 'aroundQuery',
    offset: 'page',
  },
};
