import type { Page } from 'playwright';

export type RuleReturns =
  | { kind: 'text' }
  | { kind: 'attribute'; name: string }
  | { kind: 'html' };

export interface Rule {
  selects: string;
  n?: [number, number];
  returns: RuleReturns;
  transforms?: (raw: string) => string;
}

export interface Selectors {
  card: Rule;
  id: Rule;
  title: Rule;
  company: Rule;
  location: Rule;
  description: Rule;
  datePosted: Rule;
}

export interface UrlParameters {
  query?: string;
  location?: string;
  offset?: string;
}

export interface BoardConfig {
  name: string;
  baseUrl: string;
  boardPath: string;
  jobPath: string;
  selectors: Selectors;
  urlParams: UrlParameters;
  locationPathTransform?: (location: string) => string;
  /** When true, description is extracted from the card HTML instead of fetching the job detail page. */
  descriptionFromCard?: boolean;
  boardPageAction?: (page: Page) => Promise<void>;
}
