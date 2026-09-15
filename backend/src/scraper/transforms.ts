import { load } from 'cheerio';

/**
 * Convert a Hellowork description HTML snippet to plain text.
 * Block-level tags become newlines; <li> items become bullet lines.
 */
function htmlToText(html: string): string {
  const $ = load(html);
  $('br').replaceWith('\n');
  $('li').each((_, el) => {
    const text = $(el).text().trim();
    $(el).replaceWith(`- ${text}\n`);
  });
  $('p, h1, h2, h3, h4, ul, ol').each((_, el) => {
    $(el).replaceWith($(el).text() + '\n\n');
  });
  return $.root()
    .text()
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract the Hellowork description from either the JSON-LD JobPosting script
 * tag (preferred, available on most detail pages) or, as a fallback, the
 * `[data-truncate-text-target="content"]` div rendered directly in the HTML
 * for offers that ship without JSON-LD (aggregated / external listings).
 *
 * Input is the outerHTML of a matched element from the combined selector in
 * `hellowork.config.ts`.
 */
export function helloworkDescription(raw: string): string {
  try {
    const $ = load(raw);
    // JSON-LD path: the wrapper is a <script> whose text is the JSON payload.
    const script = $('script[type="application/ld+json"]').first();
    if (script.length) {
      const data = JSON.parse(script.text()) as {
        '@type'?: string;
        description?: string;
      };
      if (data['@type'] === 'JobPosting' && data.description) {
        return htmlToText(data.description);
      }
      return '';
    }
    // HTML fallback: raw is the outerHTML of the description container.
    return htmlToText(raw);
  } catch {
    return '';
  }
}

export function jeunesdavenirsGtm(
  field: 'product_company' | 'product_city' | 'product_date',
): (raw: string) => string {
  return (raw: string) => {
    try {
      const data = JSON.parse(raw) as {
        product_data: Record<string, string>[];
      };
      return data.product_data?.[0]?.[field] ?? '';
    } catch {
      return '';
    }
  };
}

export function jeunesdavenirsId(href: string): string {
  const match = href.match(/\/offre\/([a-z]_[a-z0-9]+)$/i);
  return match?.[1] ?? href;
}

export function glassdoorAge(text: string): string {
  const normalized = text.trim().toLowerCase().replace('+', '');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const days = parseInt(normalized, 10);
  if (!Number.isNaN(days)) today.setUTCDate(today.getUTCDate() - days);
  return today.toISOString().slice(0, 10);
}

export function handleSpelledDate(text: string): string {
  const normalized = text.trim().toLowerCase();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const n = extractNumber(normalized);
  if (normalized.includes('semaine') || normalized.includes('week')) {
    today.setUTCDate(today.getUTCDate() - n * 7);
  } else if (normalized.includes('jour') || normalized.includes('day')) {
    today.setUTCDate(today.getUTCDate() - n);
  } else if (normalized.includes('mois') || normalized.includes('month')) {
    today.setUTCDate(today.getUTCDate() - n * 30);
  }

  return today.toISOString().slice(0, 10);
}

function extractNumber(text: string): number {
  for (const word of text.split(/\s+/)) {
    const parsed = parseInt(word, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 1;
}

export function linkedinId(text: string): string {
  const parts = text.split(':');
  return parts[parts.length - 1] ?? '';
}

export function parseDate(text: string): Date {
  const trimmed = text.trim();
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return new Date();
}
