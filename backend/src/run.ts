// ============================================================
// Orchestrateur CLI du pipeline auto-correctif :
//
//   SCRAPE -> EXTRACT (IA) -> VERIFY -> CORRECT -> VALIDATE -> PUBLISH
//
// Usage :
//   node --import tsx src/run.ts --dry-run   (défaut, AUCUN réseau/IA)
//   node --import tsx src/run.ts --live      (scrape réel + IA, requiert ANTHROPIC_API_KEY)
//
// Dry-run : cycle complet sur EMBEDDED_OPCOS avec extraction simulée
// (identité + mutations factices CONTRÔLÉES pour exercer verify/correct/
// validate), publication dans datasets/_drafts/ (le seed n'est jamais touché).
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMBEDDED_OPCOS } from '@opco/core';
import type { OpcoData } from '@opco/core';
import { scrapeOpco } from './scrape';
import { extractAmounts, hasApiKey, simulateExtractionFromCurrent, getExtractModel, getVerifyModel } from './extract';
import { diffOpco, reviewDiffsWithModel, summarizeDiff } from './verify';
import { applyCorrections, formatChangelog } from './correct';
import { getMaxDeltaPct, validatePipeline } from './validate';
import { publishDataset, verifyPublishedSha } from './publish';
import { deepClone } from './util';
import type { ChangelogEntry, ExtractionResult, OpcoDiff, OpcoSources, RunReport } from './types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.dirname(__dirname);
const monorepoRoot = path.dirname(backendDir);
const datasetsDir = path.join(monorepoRoot, 'datasets');
const draftsDir = path.join(datasetsDir, '_drafts');
const outDir = path.join(backendDir, 'out');
const sourcesPath = path.join(backendDir, 'sources', 'opco-sources.json');
const cacheDir = path.join(backendDir, 'cache');

// --- Mutations factices CONTRÔLÉES du dry-run --------------------------------
// Elles n'existent que pour démontrer le cycle complet sans réseau ni IA :
//  - atlas.cout_horaire_inter : +12 % -> doit être AUTO-APPLIQUÉ (sous le seuil).
//  - atlas.budget_annuel_max  : +100 % -> doit partir en needsReview et être
//    REVENU à l'ancienne valeur par le garde-fou de variation.
//  - opcommerce.cout_horaire_inter : retiré de l'extraction -> not_found ->
//    rétrogradation de la confiance, valeur conservée.
function applyDryRunMutations(slug: string, extraction: ExtractionResult): ExtractionResult {
  const mutated = deepClone(extraction);

  if (slug === 'atlas') {
    const inter = mutated.fields.find((f) => f.field === 'cout_horaire_inter');
    if (inter && inter.value != null) {
      inter.value = Math.round(inter.value * 1.12 * 100) / 100; // +12 % (< seuil 50 %)
      inter.confidence = 'exact';
      inter.quote = '[dry-run] mutation contrôlée : simule une hausse tarifaire de 12 % publiée par la source';
    }
    const budget = mutated.fields.find((f) => f.field === 'budget_annuel_max');
    if (budget && budget.value != null) {
      budget.value = budget.value * 2; // +100 % (> seuil) -> needsReview attendu
      budget.confidence = 'exact';
      budget.quote = '[dry-run] mutation contrôlée : simule un doublement suspect du plafond annuel';
    }
  }

  if (slug === 'opcommerce') {
    mutated.fields = mutated.fields.filter((f) => f.field !== 'cout_horaire_inter');
  }

  return mutated;
}

// --- Chargement du dataset courant -------------------------------------------

/** Dataset de référence : datasets/latest.json (brut) sinon EMBEDDED_OPCOS. */
function loadCurrentOpcos(mode: 'dry-run' | 'live'): OpcoData[] {
  if (mode === 'live') {
    const latestPath = path.join(datasetsDir, 'latest.json');
    if (fs.existsSync(latestPath)) {
      const raw = JSON.parse(fs.readFileSync(latestPath, 'utf-8'));
      if (Array.isArray(raw?.opcos) && raw.opcos.length > 0) {
        return raw.opcos as OpcoData[];
      }
    }
  }
  // Dry-run : EMBEDDED_OPCOS est le dataset courant de référence.
  return deepClone(EMBEDDED_OPCOS);
}

function loadSources(): OpcoSources {
  if (!fs.existsSync(sourcesPath)) {
    throw new Error(`Fichier sources manquant : ${sourcesPath}. Lancez d'abord : npm run build-sources`);
  }
  return JSON.parse(fs.readFileSync(sourcesPath, 'utf-8')) as OpcoSources;
}

// --- Pipeline -----------------------------------------------------------------

async function runPipeline(mode: 'dry-run' | 'live'): Promise<RunReport> {
  const startedAt = new Date().toISOString();
  const dryRun = mode === 'dry-run';
  const sources = loadSources();
  const current = loadCurrentOpcos(mode);

  console.log(`\n=== Pipeline OPCO (${mode}) — ${startedAt} ===`);
  console.log(`Modèles : EXTRACT_MODEL=${getExtractModel()} | VERIFY_MODEL=${getVerifyModel()}`);
  console.log(`Seuil de variation MAX_DELTA_PCT=${getMaxDeltaPct()} %`);
  console.log(`OPCO à traiter : ${current.length}\n`);

  const diffs: OpcoDiff[] = [];
  const corrected: OpcoData[] = [];
  const changelog: ChangelogEntry[] = [];
  const now = new Date();

  for (const opco of current) {
    const source = sources[opco.slug];
    if (!source) {
      console.warn(`[run] Pas de sources pour ${opco.slug} — OPCO conservé tel quel.`);
      corrected.push(deepClone(opco));
      continue;
    }

    // 1) SCRAPE (dry-run : aucun réseau)
    const scraped = await scrapeOpco(opco.slug, source, { dryRun, cacheDir });

    // 2) EXTRACT (dry-run : simulation identité + mutations contrôlées ; live : IA)
    let extraction: ExtractionResult;
    if (dryRun) {
      extraction = applyDryRunMutations(opco.slug, simulateExtractionFromCurrent(opco as unknown as { slug: string }));
    } else {
      if (scraped.pages.length === 0) {
        console.warn(`[run] ${opco.slug}: aucune page scrapée — extraction vide (tout sera "not_found", confiances rétrogradées).`);
        extraction = { slug: opco.slug, fields: [], plafonds_par_taille: [] };
      } else {
        extraction = await extractAmounts(opco.slug, scraped);
      }
    }

    // 3) VERIFY
    const diff = diffOpco(opco, extraction);
    diffs.push(diff);
    console.log(`  ${summarizeDiff(diff)}`);

    // 4) CORRECT
    const result = applyCorrections(opco, diff, { now });
    corrected.push(result.opco);
    changelog.push(...result.changelog);
  }

  // Revue consultative IA des écarts (live uniquement, gatée derrière la clé).
  if (!dryRun && hasApiKey()) {
    try {
      console.log('\n--- Revue IA des écarts (consultative) ---');
      console.log(await reviewDiffsWithModel(diffs));
    } catch (err) {
      console.warn(`[run] Revue IA des écarts échouée (non bloquant) : ${(err as Error).message}`);
    }
  }

  // 5) VALIDATE (garde-fous obligatoires)
  const validation = validatePipeline({ current, corrected });

  console.log('\n--- VALIDATE ---');
  console.log(`ok=${validation.ok} | issues=${validation.issues.length} | needsReview=${validation.needsReview.length}`);
  for (const issue of validation.issues) console.log(`  [ISSUE] ${issue}`);
  for (const r of validation.needsReview) {
    console.log(`  [REVIEW] ${r.slug}.${r.field} : ${r.oldValue} -> ${r.newValue} (${r.reason}) — ancienne valeur conservée`);
  }

  // Changelog lisible (chaque changement journalisé, jamais d'écrasement silencieux).
  const changelogLines = formatChangelog(changelog);
  const reviewLines = validation.needsReview.map(
    (r) => `[${r.slug}] ${r.field} : changement ${r.oldValue} -> ${r.newValue} NON publié (${r.reason})`,
  );
  console.log('\n--- CHANGELOG ---');
  if (changelogLines.length === 0 && reviewLines.length === 0) console.log('  (aucun changement)');
  for (const line of [...changelogLines, ...reviewLines]) console.log(`  ${line}`);

  // 6) PUBLISH
  let published = null;
  if (!validation.ok) {
    console.error('\n[run] VALIDATION ÉCHOUÉE — publication ANNULÉE.');
  } else {
    const target = dryRun ? draftsDir : datasetsDir;
    published = publishDataset(validation.opcos, {
      datasetsDir,
      outDir: target,
      changelog: [...changelogLines, ...reviewLines],
    });
    const shaCheck = verifyPublishedSha(target);
    console.log('\n--- PUBLISH ---');
    console.log(`  Dossier      : ${target}${dryRun ? '  (dry-run : le seed datasets/ n\'est pas touché)' : ''}`);
    console.log(`  Version      : v${published.version} (${published.files.versioned})`);
    console.log(`  opcoCount    : ${published.opcoCount}`);
    console.log(`  sha256       : ${published.sha256}`);
    console.log(`  sha256 check : ${shaCheck.ok ? 'OK (manifest == octets exacts de latest.json)' : `ÉCHEC (${shaCheck.expected} != ${shaCheck.actual})`}`);
    if (!shaCheck.ok) throw new Error('Incohérence sha256 après publication');
  }

  const report: RunReport = {
    mode,
    startedAt,
    diffs,
    changelog,
    needsReview: validation.needsReview,
    issues: validation.issues,
    published,
  };

  // Rapport machine pour la CI (création de PR si needsReview non vide).
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\nRapport écrit : ${path.join(outDir, 'report.json')}`);

  return report;
}

// --- CLI ------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const mode: 'dry-run' | 'live' = live ? 'live' : 'dry-run';

  if (live && !hasApiKey()) {
    console.error('Le mode --live requiert ANTHROPIC_API_KEY (extraction IA). Utilisez --dry-run sans clé.');
    process.exit(1);
  }

  const report = await runPipeline(mode);

  if (report.issues.length > 0) {
    process.exit(1); // validation échouée -> échec CI
  }
  console.log(
    report.needsReview.length > 0
      ? `\nTerminé avec ${report.needsReview.length} changement(s) à revoir manuellement (non publiés).`
      : '\nTerminé sans intervention requise.',
  );
}

main().catch((err) => {
  console.error('[run] Échec du pipeline :', err);
  process.exit(1);
});
