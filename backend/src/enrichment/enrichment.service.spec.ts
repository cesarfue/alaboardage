// Mock Prisma generated client (prevents PrismaClient constructor from running)
jest.mock('../../generated/prisma/client', () => ({
  Prisma: { sql: (parts: TemplateStringsArray) => parts.join('') },
}));
// Mock PrismaService to avoid database connections
jest.mock('../prisma/prisma.service');

import { EnrichmentService } from './enrichment.service';
import { PrismaService } from '../prisma/prisma.service';

// Cast helper — the tests exercise a handful of private methods; keeping the
// production surface small keeps the class honest but complicates unit testing.
type ServicePrivates = {
  resolveScope: (loc: string) => unknown;
  simplifyCompanyName: (name: string) => string;
  findEstablishment: (name: string, scope: unknown) => Promise<unknown>;
  queryLocal: (name: string, scope: unknown) => Promise<unknown>;
  queryLocalFts: (name: string, scope: unknown) => Promise<unknown>;
};

function makeService(): { svc: EnrichmentService; priv: ServicePrivates } {
  const prisma = {} as PrismaService;
  const svc = new EnrichmentService(prisma);
  // Skip onModuleInit — it reads data/communes.json. We seed the maps
  // directly with the minimum needed by the tests.
  const priv = svc as unknown as ServicePrivates & {
    communeToScope: Map<string, { dep: string; reg: string }>;
    regionToCode: Map<string, string>;
    communePop: Map<string, number>;
  };
  priv.communeToScope.set('lyon', { dep: '69', reg: '84' });
  priv.regionToCode.set('auvergne rhone alpes', '84');
  return { svc, priv };
}

describe('EnrichmentService.resolveScope', () => {
  it('picks the commune when a known city is present', () => {
    const { priv } = makeService();
    expect(priv.resolveScope('Lyon, France')).toEqual({
      type: 'departement',
      code: '69',
    });
  });

  it('picks the region on region-only input', () => {
    const { priv } = makeService();
    expect(priv.resolveScope('Auvergne-Rhône-Alpes')).toEqual({
      type: 'region',
      code: '84',
    });
  });

  it('returns a national scope when only "France" is present', () => {
    const { priv } = makeService();
    expect(priv.resolveScope('France')).toEqual({ type: 'national' });
  });

  it('handles multi-city notation like "France et 6 autres"', () => {
    const { priv } = makeService();
    expect(priv.resolveScope('France et 6 autres')).toEqual({
      type: 'national',
    });
  });

  it('returns null on foreign locations', () => {
    const { priv } = makeService();
    expect(priv.resolveScope('Milan, Italy')).toBeNull();
  });

  it('extracts city before falling back to national', () => {
    const { priv } = makeService();
    // "Lyon, France" should resolve to Rhône (69), not the national fallback.
    expect(priv.resolveScope('Lyon, France')).toEqual({
      type: 'departement',
      code: '69',
    });
  });
});

describe('EnrichmentService.simplifyCompanyName', () => {
  it('strips common legal suffixes', () => {
    const { priv } = makeService();
    expect(priv.simplifyCompanyName('Acme France')).toBe('Acme');
    expect(priv.simplifyCompanyName('Acme SAS')).toBe('Acme');
    expect(priv.simplifyCompanyName('Acme SARL')).toBe('Acme');
  });

  it('strips institutional dash-suffixes', () => {
    const { priv } = makeService();
    expect(
      priv.simplifyCompanyName('École Pratique des Hautes Études - PSL'),
    ).toBe('École Pratique des Hautes Études');
    expect(priv.simplifyCompanyName('MyLab - CNRS')).toBe('MyLab');
    expect(priv.simplifyCompanyName('ESCP Extension')).toBe('ESCP');
  });

  it('strips a "Groupe" prefix', () => {
    const { priv } = makeService();
    expect(priv.simplifyCompanyName('Groupe Bertin')).toBe('Bertin');
  });

  it('is a no-op on clean names', () => {
    const { priv } = makeService();
    expect(priv.simplifyCompanyName('Bertin Technologies')).toBe(
      'Bertin Technologies',
    );
  });
});

describe('EnrichmentService.findEstablishment national guard', () => {
  it('skips national queries when the simplified name is a bare acronym', async () => {
    const { priv } = makeService();
    const fts = jest
      .fn<Promise<unknown>, [string, unknown]>()
      .mockResolvedValue(null);
    priv.queryLocalFts = fts;
    // Bypass queryLocal → queryLocalFts+trigram path — we only care that FTS
    // is never invoked at national scope for a bare acronym.
    priv.queryLocal = jest
      .fn()
      .mockImplementation((n: string, s: unknown) => priv.queryLocalFts(n, s));

    const result = await priv.findEstablishment('ESCP Extension', {
      type: 'national',
    });
    expect(result).toBeNull();
    // ESCP alone is < 6 chars and has no long word → guarded out.
    for (const call of fts.mock.calls) {
      expect(call[0]).not.toBe('ESCP');
    }
  });

  it('allows national FTS for specific names', async () => {
    const { priv } = makeService();
    const fts = jest
      .fn<Promise<unknown>, [string, unknown]>()
      .mockResolvedValue({ siret: '123', name: 'JOBS THAT MAKESENSE' });
    priv.queryLocalFts = fts;
    priv.queryLocal = jest
      .fn()
      .mockImplementation((n: string, s: unknown) => priv.queryLocalFts(n, s));

    const result = await priv.findEstablishment('Jobs that makesense', {
      type: 'national',
    });
    expect(result).not.toBeNull();
  });
});
