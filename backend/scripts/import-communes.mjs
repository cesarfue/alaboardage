#!/usr/bin/env node
// Télécharge le découpage administratif (communes + régions) depuis
// geo.api.gouv.fr vers backend/data/communes.json. Ce fichier est chargé au
// démarrage par EnrichmentService pour résoudre une localisation en code
// département/région sans appeler l'API à chaque job (anti rate-limit).
//
// Non commité — relancer avec `make import-geo` sur une nouvelle machine.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const COMMUNES_URL =
  'https://geo.api.gouv.fr/communes?fields=nom,codeDepartement,codeRegion,population';
const REGIONS_URL = 'https://geo.api.gouv.fr/regions?fields=nom,code';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const outFile = join(outDir, 'communes.json');

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

const [communesRaw, regionsRaw] = await Promise.all([
  fetchJson(COMMUNES_URL),
  fetchJson(REGIONS_URL),
]);

const communes = communesRaw
  .filter((c) => c.codeDepartement && c.codeRegion)
  .map((c) => ({
    n: c.nom,
    d: c.codeDepartement,
    r: c.codeRegion,
    p: c.population ?? 0,
  }));

const regions = regionsRaw.map((r) => ({ n: r.nom, code: r.code }));

await mkdir(outDir, { recursive: true });
await writeFile(outFile, JSON.stringify({ communes, regions }));

console.log(
  `Wrote ${communes.length} communes, ${regions.length} regions → ${outFile}`,
);
