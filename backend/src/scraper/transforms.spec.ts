import {
  glassdoorAge,
  handleSpelledDate,
  jeunesdavenirsGtm,
  jeunesdavenirsId,
  linkedinId,
  parseDate,
} from './transforms';

describe('transforms', () => {
  describe('parseDate', () => {
    it('parses an ISO date string', () => {
      const d = parseDate('2024-03-15');
      expect(d).toBeInstanceOf(Date);
      expect(d.getUTCFullYear()).toBe(2024);
      expect(d.getUTCMonth()).toBe(2); // 0-indexed
      expect(d.getUTCDate()).toBe(15);
    });

    it('falls back to today for an invalid string', () => {
      const before = Date.now();
      const d = parseDate('not-a-date');
      expect(d.getTime()).toBeGreaterThanOrEqual(before - 1000);
    });
  });

  describe('linkedinId', () => {
    it('extracts the numeric id from a URN', () => {
      expect(linkedinId('urn:li:jobPosting:1234567890')).toBe('1234567890');
    });

    it('returns the whole string when there are no colons', () => {
      expect(linkedinId('1234567890')).toBe('1234567890');
    });
  });

  describe('glassdoorAge', () => {
    it('converts "9j" to a date 9 days ago', () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      today.setUTCDate(today.getUTCDate() - 9);
      expect(glassdoorAge('9j')).toBe(today.toISOString().slice(0, 10));
    });

    it('handles "30j+" by stripping the plus', () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      today.setUTCDate(today.getUTCDate() - 30);
      expect(glassdoorAge('30j+')).toBe(today.toISOString().slice(0, 10));
    });
  });

  describe('handleSpelledDate', () => {
    it('handles "Il y a 3 jours"', () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      today.setUTCDate(today.getUTCDate() - 3);
      expect(handleSpelledDate('Il y a 3 jours')).toBe(
        today.toISOString().slice(0, 10),
      );
    });

    it('handles "2 semaines"', () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      today.setUTCDate(today.getUTCDate() - 14);
      expect(handleSpelledDate('2 semaines')).toBe(
        today.toISOString().slice(0, 10),
      );
    });

    it('handles "1 mois"', () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      today.setUTCDate(today.getUTCDate() - 30);
      expect(handleSpelledDate('1 mois')).toBe(
        today.toISOString().slice(0, 10),
      );
    });

    it('returns today for an unrecognised format', () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      expect(handleSpelledDate('unknown format')).toBe(
        today.toISOString().slice(0, 10),
      );
    });
  });

  describe('jeunesdavenirsId', () => {
    it('extracts "i_<hex>" from a full path', () => {
      expect(
        jeunesdavenirsId('/offre/i_abc123def456'),
      ).toBe('i_abc123def456');
    });

    it('returns the raw href when the path does not match', () => {
      const raw = '/some-other-path/42';
      expect(jeunesdavenirsId(raw)).toBe(raw);
    });
  });

  describe('jeunesdavenirsGtm', () => {
    const json = JSON.stringify({
      product_data: [
        {
          product_company: 'Acme Corp',
          product_city: 'Paris',
          product_date: '2026-01-15',
        },
      ],
    });

    it('extracts product_company', () => {
      expect(jeunesdavenirsGtm('product_company')(json)).toBe('Acme Corp');
    });

    it('extracts product_city', () => {
      expect(jeunesdavenirsGtm('product_city')(json)).toBe('Paris');
    });

    it('extracts product_date', () => {
      expect(jeunesdavenirsGtm('product_date')(json)).toBe('2026-01-15');
    });

    it('returns empty string for invalid JSON', () => {
      expect(jeunesdavenirsGtm('product_company')('not-json')).toBe('');
    });

    it('returns empty string when field is missing', () => {
      const minimal = JSON.stringify({ product_data: [{}] });
      expect(jeunesdavenirsGtm('product_company')(minimal)).toBe('');
    });
  });
});
