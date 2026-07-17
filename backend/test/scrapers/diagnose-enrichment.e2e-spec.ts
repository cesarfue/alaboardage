/**
 * Diagnostic script — for each `{ company, location }` entry recorded as a
 * miss in `backend/test/scrapers/baseline/*.json`, report:
 *  - what `resolveScope(location)` returns (scope or null)
 *  - if a scope is found, what `findEstablishment(company, scope)` returns
 *
 * Run via the jest-e2e harness (which handles the ts-node/prisma quirks):
 *
 *   cd backend
 *   DATABASE_URL="postgresql://alaboardage:alaboardage@localhost:5432/alaboardage" \
 *     npx jest --config ./test/jest-e2e.json diagnose-enrichment --runInBand
 *
 * The "test" only reads — nothing is written to the DB.
 */

jest.unmock('@prisma/adapter-pg');

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../../src/prisma/prisma.service';
import { EnrichmentService } from '../../src/enrichment/enrichment.service';

interface BaselineFile {
  board: string;
  missingCompanies?: { company: string; location: string }[];
}

describe('diagnose-enrichment', () => {
  jest.setTimeout(60_000);

  it('reports miss reasons for every baseline missingCompanies entry', async () => {
    const baselineDir = join(__dirname, 'baseline');
    const files = readdirSync(baselineDir).filter(
      (f) => f.endsWith('.json') && !f.startsWith('_'),
    );

    const cases: { board: string; company: string; location: string }[] = [];
    for (const f of files) {
      const parsed = JSON.parse(
        readFileSync(join(baselineDir, f), 'utf8'),
      ) as BaselineFile;
      for (const m of parsed.missingCompanies ?? []) {
        cases.push({ board: parsed.board, ...m });
      }
    }

    if (cases.length === 0) {
      console.warn('No missing companies to diagnose — baselines are clean.');
      return;
    }

    const prisma = new PrismaService();
    await prisma.onModuleInit();
    const enrichment = new EnrichmentService(prisma);
    enrichment.onModuleInit();

    // Access private helpers — this is a debug tool, not production code.
    const svc = enrichment as unknown as {
      resolveScope: (loc: string) => unknown;
      findEstablishment: (company: string, scope: unknown) => Promise<unknown>;
      simplifyCompanyName: (name: string) => string;
    };

    console.warn(`\n=== Diagnosing ${cases.length} failed enrichments ===\n`);
    let noScope = 0;
    let noMatch = 0;
    let wouldMatch = 0;

    for (const c of cases) {
      const scope = svc.resolveScope(c.location);
      const simplified = svc.simplifyCompanyName(c.company);
      let matchInfo = '(no scope, not attempted)';
      if (scope) {
        const found = await svc.findEstablishment(c.company, scope);
        if (found) {
          matchInfo = `MATCH ${JSON.stringify(found)}`;
          wouldMatch++;
        } else {
          matchInfo = 'no match';
          noMatch++;
        }
      } else {
        noScope++;
      }

      console.warn(
        `[${c.board.padEnd(13)}] ${c.company} | ${c.location}\n` +
          `    simplified: "${simplified}"\n` +
          `    scope     : ${JSON.stringify(scope)}\n` +
          `    result    : ${matchInfo}\n`,
      );
    }

    console.warn(
      `\nSummary: ${cases.length} cases — noScope=${noScope}, noMatch=${noMatch}, unexpectedMatch=${wouldMatch}\n`,
    );

    await prisma.onModuleDestroy();
    expect(cases.length).toBeGreaterThan(0);
  });
});
