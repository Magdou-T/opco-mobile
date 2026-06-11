// ============================================================
// Construit backend/sources/opco-sources.json en EXTRAYANT les
// source_url officielles des 11 fichiers packages/core/data/opcos/*.json.
// Aucune URL inventée : tout vient des données sourcées du core.
// Usage : node scripts/build-sources.mjs
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.dirname(__dirname);
const monorepoRoot = path.dirname(backendDir);
const opcoDataDir = path.join(monorepoRoot, 'packages', 'core', 'data', 'opcos');
const outDir = path.join(backendDir, 'sources');

// Champs chiffrés dont on suit la source_url (mêmes champs que le pipeline).
const NUMERIC_FIELDS = [
  'cout_horaire_inter',
  'cout_horaire_intra',
  'cout_horaire_metier',
  'prise_en_charge_salaires',
  'frais_transport',
  'frais_hebergement',
  'frais_restauration',
  'frais_annexes_pourcentage',
  'budget_annuel_max',
];

const files = fs
  .readdirSync(opcoDataDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

const sources = {};

for (const file of files) {
  const opco = JSON.parse(fs.readFileSync(path.join(opcoDataDir, file), 'utf-8'));
  const main = opco.url_finance_page;

  // URLs par champ uniquement quand elles diffèrent de la page principale.
  const fieldUrls = {};
  for (const field of NUMERIC_FIELDS) {
    const sv = opco[field];
    if (sv && typeof sv === 'object' && typeof sv.source_url === 'string' && sv.source_url && sv.source_url !== main) {
      fieldUrls[field] = sv.source_url;
    }
  }

  // Toutes les URLs distinctes à scraper pour cet OPCO.
  const allUrls = [...new Set([main, ...Object.values(fieldUrls)])].filter(Boolean);

  sources[opco.slug] = {
    slug: opco.slug,
    name: opco.name,
    url_finance_page: main,
    field_urls: fieldUrls,
    scrape_urls: allUrls,
  };
}

fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'opco-sources.json');
fs.writeFileSync(outPath, JSON.stringify(sources, null, 2) + '\n', 'utf-8');
console.log(`OK ${outPath} (${Object.keys(sources).length} OPCO)`);
