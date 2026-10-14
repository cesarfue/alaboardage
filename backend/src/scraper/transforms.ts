import { load } from 'cheerio';

/**
 * Block-level tags become newlines; <li> items become bullet lines.
 */
export function htmlToText(html: string): string {
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
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
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
  const days = parseInt(normalized, 10);
  if (Number.isNaN(days)) return '';
  return daysAgo(days);
}

export function handleSpelledDate(text: string): string {
  const normalized = text.trim().toLowerCase();
  if (normalized.includes("aujourd'hui") || normalized.includes('today'))
    return daysAgo(0);
  if (normalized.includes('hier') || normalized.includes('yesterday'))
    return daysAgo(1);

  const n = extractNumber(normalized);
  if (normalized.includes('semaine') || normalized.includes('week'))
    return daysAgo(n * 7);
  if (normalized.includes('jour') || normalized.includes('day'))
    return daysAgo(n);
  if (normalized.includes('mois') || normalized.includes('month'))
    return daysAgo(n * 30);

  return '';
}

function daysAgo(days: number): string {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCDate(day.getUTCDate() - days);
  return day.toISOString().slice(0, 10);
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

export function parseDate(text: string): Date | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
