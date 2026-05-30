export function helloworkDate(text: string): string {
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
