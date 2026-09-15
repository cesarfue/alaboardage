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
  displayJobPath?: string;
  selectors: Selectors;
  urlParams: UrlParameters;
  locationPathTransform?: (location: string) => string;
  descriptionFromCard?: boolean;
  boardPageAction?: (page: Page) => Promise<void>;
  // Valeur du paramètre d'offset pour la 1re page (défaut : params.offset).
  // Mettre 0 pour les boards qui paginent à partir de 0 (ex. JTMS items_page).
  offsetBase?: number;
  // Minimum delay in ms between paginated page fetches (default: 1000).
  // Boards with aggressive anti-bot measures should set a higher value.
  pageDelayMs?: number;
  // When true, always scrape only a single page regardless of the request's
  // singlePage flag. Use for boards where pagination triggers anti-bot measures
  // (e.g. Indeed) or where multi-page scraping is structurally impossible.
  singlePageOnly?: boolean;
}
