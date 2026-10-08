// ============================================================
// Tests unitaires du pipeline : verify / correct / validate / publish.
// Aucun réseau, aucune IA : tout est déterministe.
// ============================================================

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EMBEDDED_OPCOS, calculateFunding, createInitialWizardState, getEmbeddedOpcoBySlug } from '@opco/core';
import type { OpcoData } from '@opco/core';
import { diffOpco } from '../src/verify';
import { applyCorrections } from '../src/correct';
import { validatePipeline, runFundingScenarios } from '../src/validate';
import { publishDataset, verifyPublishedSha } from '../src/publish';
import { simulateExtractionFromCurrent } from '../src/extract';
import { parseRobots, htmlToText } from '../src/scrape';
import { deepClone, sha256Hex, downgradeConfidence } from '../src/util';
import type { ExtractionResult } from '../src/types';

// Fixture découplée des données réelles : on part d'un OPCO embarqué mais on
// ÉPINGLE les valeurs que les tests supposent (les données vivantes évoluent
// au fil des vérifications de sources ; les tests unitaires, eux, doivent
// rester déterministes).
const atlas = (): OpcoData => {
  const o = deepClone(getEmbeddedOpcoBySlug('atlas')!);
  o.cout_horaire_inter = { value: 25, confidence: 'depends_on_branche', source_url: 'https://example.test/criteres' };
  o.cout_horaire_metier = { value: 10, confidence: 'estimated', source_url: 'https://example.test/criteres' };
  o.frais_transport = { value: null, confidence: 'depends_on_branche', source_url: 'https://example.test/criteres' };
  o.budget_annuel_max = { value: 8000, confidence: 'depends_on_branche', source_url: 'https://example.test/criteres' };
  if (o.plafonds_par_taille?.[0]) o.plafonds_par_taille[0].budget_annuel_max = 8000;
  return o;
};

// Les données réelles n'ont plus de tailles en double (le schéma v4 les
// interdit) : on fabrique le cas pour tester l'appariement par occurrence
// de diffOpco / applyCorrections. Le tableau est entièrement synthétique : il
// ne dépend pas du contenu des données de Constructys, réécrites au fil des
// vérifications de sources.
const constructysAvecDoublon = (): OpcoData => {
  const o = deepClone(getEmbeddedOpcoBySlug('constructys')!);
  o.plafonds_par_taille = [
    { taille: 'less_11', cout_horaire_max: 24, budget_annuel_max: 3500, quota_horaire_max: null, description: 'Bâtiment <11 (fixture)' },
    { taille: 'less_11', cout_horaire_max: 24, budget_annuel_max: 4000, quota_horaire_max: null, description: 'Travaux publics <11 (fixture)' },
    { taille: '11_49', cout_horaire_max: 19, budget_annuel_max: 6000, quota_horaire_max: null, description: 'Bâtiment 11-49 (fixture)' },
  ];
  return o;
};

function identityExtraction(opco: OpcoData): ExtractionResult {
  return simulateExtractionFromCurrent(opco as unknown as { slug: string });
}

// --- VERIFY -------------------------------------------------------------------

describe('verify.diffOpco', () => {
  it('extraction identité -> tout unchanged', () => {
    const opco = atlas();
    const diff = diffOpco(opco, identityExtraction(opco));
    expect(diff.diffs.length).toBeGreaterThan(0);
    expect(diff.diffs.every((d) => d.status === 'unchanged')).toBe(true);
  });

  it('détecte modified avec ancienne/nouvelle valeur', () => {
    const opco = atlas();
    const ext = identityExtraction(opco);
    const inter = ext.fields.find((f) => f.field === 'cout_horaire_inter')!;
    inter.value = 30;
    const diff = diffOpco(opco, ext);
    const d = diff.diffs.find((x) => x.field === 'cout_horaire_inter')!;
    expect(d.status).toBe('modified');
    expect(d.oldValue).toBe(25);
    expect(d.newValue).toBe(30);
  });

  it('détecte new quand le courant est null', () => {
    const opco = atlas(); // frais_transport.value === null
    const ext = identityExtraction(opco);
    const transport = ext.fields.find((f) => f.field === 'frais_transport')!;
    transport.value = 10;
    const d = diffOpco(opco, ext).diffs.find((x) => x.field === 'frais_transport')!;
    expect(d.status).toBe('new');
  });

  it('détecte not_found quand le champ manque dans l’extraction', () => {
    const opco = atlas();
    const ext = identityExtraction(opco);
    ext.fields = ext.fields.filter((f) => f.field !== 'cout_horaire_inter');
    const d = diffOpco(opco, ext).diffs.find((x) => x.field === 'cout_horaire_inter')!;
    expect(d.status).toBe('not_found');
    expect(d.oldValue).toBe(25);
  });

  it('valeur extraite null alors que le montant publié existe -> not_found (jamais modified), valeur conservée', () => {
    const opco = atlas(); // cout_horaire_inter = 25
    const ext = identityExtraction(opco);
    ext.fields.find((f) => f.field === 'cout_horaire_inter')!.value = null;
    const diff = diffOpco(opco, ext);
    const d = diff.diffs.find((x) => x.field === 'cout_horaire_inter')!;
    expect(d.status).toBe('not_found');
    expect(d.oldValue).toBe(25);
    expect(d.newValue).toBeNull();
    // Classé modified, le montant serait effacé par applyCorrections.
    const { opco: out } = applyCorrections(opco, diff, { now: new Date(2026, 5, 10) });
    expect(out.cout_horaire_inter.value).toBe(25);
  });

  it('plafond extrait null alors que le plafond publié existe -> not_found (jamais modified)', () => {
    const opco = atlas();
    opco.plafonds_par_taille = [
      { taille: 'less_11', cout_horaire_max: 20, budget_annuel_max: 8000, quota_horaire_max: null, description: 'Moins de 11 (fixture)' },
    ];
    const ext = identityExtraction(opco);
    ext.plafonds_par_taille[0].budget_annuel_max = null;
    const d = diffOpco(opco, ext).diffs.find((x) => x.field === 'plafonds_par_taille[0:less_11].budget_annuel_max')!;
    expect(d.status).toBe('not_found');
    expect(d.oldValue).toBe(8000);
  });

  it('compare les plafonds_par_taille (clé indexée)', () => {
    const opco = atlas();
    const ext = identityExtraction(opco);
    const p = ext.plafonds_par_taille.find((x) => x.taille === 'less_11')!;
    p.budget_annuel_max = 9000;
    const d = diffOpco(opco, ext).diffs.find((x) => x.field === 'plafonds_par_taille[0:less_11].budget_annuel_max')!;
    expect(d.status).toBe('modified');
    expect(d.oldValue).toBe(8000);
    expect(d.newValue).toBe(9000);
  });

  it('tailles dupliquées : appariement par occurrence -> tout unchanged', () => {
    const constructys = constructysAvecDoublon();
    const diff = diffOpco(constructys, identityExtraction(constructys));
    expect(diff.diffs.every((d) => d.status === 'unchanged')).toBe(true);
  });

  it('tailles dupliquées : une modification ne touche que la bonne occurrence', () => {
    const constructys = constructysAvecDoublon();
    const ext = identityExtraction(constructys);
    // Deux entrées less_11 (idx 0 et idx 1, fixture) : on modifie la 2e.
    const less11 = ext.plafonds_par_taille.filter((p) => p.taille === 'less_11');
    expect(less11.length).toBeGreaterThan(1);
    const ancienBudget = less11[1].budget_annuel_max!;
    less11[1].budget_annuel_max = ancienBudget + 100;

    const diff = diffOpco(constructys, ext);
    const modified = diff.diffs.filter((d) => d.status !== 'unchanged');
    expect(modified).toHaveLength(1);
    expect(modified[0].field).toBe('plafonds_par_taille[1:less_11].budget_annuel_max');

    const { opco: out } = applyCorrections(constructys, diff, { now: new Date(2026, 5, 10) });
    expect(out.plafonds_par_taille![0].budget_annuel_max).toBe(constructys.plafonds_par_taille![0].budget_annuel_max); // intact
    expect(out.plafonds_par_taille![1].budget_annuel_max).toBe(ancienBudget + 100); // bonne occurrence corrigée
  });
});

// --- CORRECT -------------------------------------------------------------------

describe('correct.applyCorrections', () => {
  const now = new Date(2026, 5, 10); // 10/06/2026

  it('modified -> value mise à jour, confidence exact, note datée, changelog', () => {
    const opco = atlas();
    const ext = identityExtraction(opco);
    ext.fields.find((f) => f.field === 'cout_horaire_inter')!.value = 30;
    const { opco: out, changelog } = applyCorrections(opco, diffOpco(opco, ext), { now });

    expect(out.cout_horaire_inter.value).toBe(30);
    expect(out.cout_horaire_inter.confidence).toBe('exact');
    expect(out.cout_horaire_inter.note).toContain('10/06/2026');
    expect(out.cout_horaire_inter.note).toContain('25'); // ancienne valeur journalisée
    const entry = changelog.find((c) => c.field === 'cout_horaire_inter');
    expect(entry?.action).toBe('updated');
    expect(entry?.oldValue).toBe(25);
    expect(entry?.newValue).toBe(30);
  });

  it('not_found -> valeur CONSERVÉE, confiance rétrogradée, note « non confirmé »', () => {
    const opco = atlas();
    // cout_horaire_afest? Non suivi. On utilise cout_horaire_metier (estimated).
    const ext = identityExtraction(opco);
    ext.fields = ext.fields.filter((f) => f.field !== 'cout_horaire_metier');
    const { opco: out, changelog } = applyCorrections(opco, diffOpco(opco, ext), { now });

    expect(out.cout_horaire_metier.value).toBe(10); // jamais supprimé
    expect(out.cout_horaire_metier.confidence).toBe('depends_on_branche'); // estimated -> depends
    expect(out.cout_horaire_metier.note).toContain('Non confirmé au 10/06/2026');
    expect(changelog.find((c) => c.field === 'cout_horaire_metier')?.action).toBe('confidence_downgraded');
  });

  it('chaîne de rétrogradation exact -> estimated -> depends_on_branche', () => {
    expect(downgradeConfidence('exact')).toBe('estimated');
    expect(downgradeConfidence('estimated')).toBe('depends_on_branche');
    expect(downgradeConfidence('depends_on_branche')).toBe('depends_on_branche');
  });

  it('unchanged confirmé exact -> consolide la confiance avec note datée', () => {
    const opco = atlas(); // cout_horaire_inter: depends_on_branche, 25
    const ext = identityExtraction(opco);
    ext.fields.find((f) => f.field === 'cout_horaire_inter')!.confidence = 'exact';
    const { opco: out, changelog } = applyCorrections(opco, diffOpco(opco, ext), { now });
    expect(out.cout_horaire_inter.value).toBe(25);
    expect(out.cout_horaire_inter.confidence).toBe('exact');
    expect(changelog.find((c) => c.field === 'cout_horaire_inter')?.action).toBe('confirmed');
  });

  it('extraction identité -> aucun changement, changelog vide', () => {
    const opco = atlas();
    const { opco: out, changelog } = applyCorrections(opco, diffOpco(opco, identityExtraction(opco)), { now });
    expect(changelog).toHaveLength(0);
    expect(out.cout_horaire_inter).toEqual(opco.cout_horaire_inter);
  });
});

// --- VALIDATE -----------------------------------------------------------------

describe('validate.validatePipeline', () => {
  // Version qui serait publiée après datasets/manifest.json (version 3).
  const version = 4;

  it('dataset embarqué inchangé -> ok, aucun needsReview', () => {
    const current = deepClone(EMBEDDED_OPCOS);
    const report = validatePipeline({ current, corrected: deepClone(current), version });
    expect(report.ok).toBe(true);
    expect(report.issues).toHaveLength(0);
    expect(report.needsReview).toHaveLength(0);
    expect(report.opcos).toHaveLength(11);
  });

  it('variation > MAX_DELTA_PCT -> needsReview + retour à l’ancienne valeur', () => {
    const current = deepClone(EMBEDDED_OPCOS);
    // Épingle une valeur de référence (les données vivantes peuvent être null).
    current.find((o) => o.slug === 'atlas')!.budget_annuel_max.value = 8000;
    const corrected = deepClone(current);
    const a = corrected.find((o) => o.slug === 'atlas')!;
    a.budget_annuel_max.value = 16000; // 8000 -> 16000 = +100 %

    const report = validatePipeline({ current, corrected, maxDeltaPct: 50, version });
    expect(report.ok).toBe(true); // pas une erreur : changement mis de côté
    const review = report.needsReview.find((r) => r.slug === 'atlas' && r.field === 'budget_annuel_max');
    expect(review).toBeDefined();
    expect(review!.newValue).toBe(16000);
    const published = report.opcos.find((o) => o.slug === 'atlas')!;
    expect(published.budget_annuel_max.value).toBe(8000); // ancienne valeur conservée
  });

  it('variation sous le seuil -> auto-publiée sans review', () => {
    const current = deepClone(EMBEDDED_OPCOS);
    current.find((o) => o.slug === 'atlas')!.cout_horaire_inter.value = 25;
    const corrected = deepClone(current);
    corrected.find((o) => o.slug === 'atlas')!.cout_horaire_inter.value = 28; // +12 %
    const report = validatePipeline({ current, corrected, maxDeltaPct: 50, version });
    expect(report.needsReview).toHaveLength(0);
    expect(report.opcos.find((o) => o.slug === 'atlas')!.cout_horaire_inter.value).toBe(28);
  });

  it('variation exactement égale au seuil -> auto-publiée (le seuil est inclus)', () => {
    const current = deepClone(EMBEDDED_OPCOS);
    current.find((o) => o.slug === 'atlas')!.cout_horaire_inter.value = 20;
    const corrected = deepClone(current);
    corrected.find((o) => o.slug === 'atlas')!.cout_horaire_inter.value = 30; // 20 -> 30 = +50 % exactement
    const report = validatePipeline({ current, corrected, maxDeltaPct: 50, version });
    expect(report.issues).toEqual([]);
    expect(report.needsReview).toHaveLength(0);
    expect(report.opcos.find((o) => o.slug === 'atlas')!.cout_horaire_inter.value).toBe(30);
  });

  it('plafond par taille hors seuil -> needsReview et ancienne valeur ramenée ; au seuil exact -> publié', () => {
    const current = deepClone(EMBEDDED_OPCOS);
    current.find((o) => o.slug === 'atlas')!.plafonds_par_taille = [
      { taille: 'less_11', cout_horaire_max: 20, budget_annuel_max: 8000, quota_horaire_max: null, description: 'Moins de 11 (fixture)' },
      { taille: '11_49', cout_horaire_max: 20, budget_annuel_max: 8000, quota_horaire_max: null, description: '11 à 49 (fixture)' },
    ];
    const corrected = deepClone(current);
    const plafonds = corrected.find((o) => o.slug === 'atlas')!.plafonds_par_taille!;
    plafonds[0].budget_annuel_max = 16000; // +100 % : hors seuil
    plafonds[1].budget_annuel_max = 12000; // +50 % exactement : dans le seuil

    const report = validatePipeline({ current, corrected, maxDeltaPct: 50, version });
    expect(report.issues).toEqual([]);
    expect(report.needsReview).toEqual([
      expect.objectContaining({ slug: 'atlas', field: 'plafonds_par_taille[0:less_11].budget_annuel_max', oldValue: 8000, newValue: 16000 }),
    ]);
    const publies = report.opcos.find((o) => o.slug === 'atlas')!.plafonds_par_taille!;
    expect(publies[0].budget_annuel_max).toBe(8000); // ancienne valeur ramenée
    expect(publies[1].budget_annuel_max).toBe(12000); // variation au seuil : publiée
  });

  it('nouveau montant sans référence (null -> valeur) -> needsReview, pas auto-publié', () => {
    const current = deepClone(EMBEDDED_OPCOS);
    const corrected = deepClone(current);
    corrected.find((o) => o.slug === 'atlas')!.frais_transport.value = 12;
    const report = validatePipeline({ current, corrected, maxDeltaPct: 50, version });
    expect(report.needsReview.some((r) => r.field === 'frais_transport')).toBe(true);
    expect(report.opcos.find((o) => o.slug === 'atlas')!.frais_transport.value).toBeNull();
  });

  it('montant hors bornes -> issue bloquante', () => {
    const current = deepClone(EMBEDDED_OPCOS);
    current.find((o) => o.slug === 'atlas')!.cout_horaire_inter.value = 25;
    const corrected = deepClone(current);
    // 250 €/h > borne 200 de sanityCheckOpco mais variation sous seuil impossible…
    // -> on force avec un seuil élevé pour atteindre le sanity check.
    corrected.find((o) => o.slug === 'atlas')!.cout_horaire_inter.value = 250;
    const report = validatePipeline({ current, corrected, maxDeltaPct: 10_000, version });
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.includes('cout_horaire_inter'))).toBe(true);
  });

  it('dataset de 10 OPCO -> rejeté par validateDataset (11 OPCO exigés)', () => {
    const current = deepClone(EMBEDDED_OPCOS).slice(0, 10);
    const report = validatePipeline({ current, corrected: deepClone(current), version });
    expect(report.ok).toBe(false);
    expect(report.issues).toContainEqual(expect.stringContaining('Dataset incomplet : 10 OPCO, minimum attendu 11'));
  });

  it('valide le dataset avec la version qui sera publiée, et non une version écrite en dur', () => {
    const current = deepClone(EMBEDDED_OPCOS);
    expect(validatePipeline({ current, corrected: deepClone(current), version }).issues).toEqual([]);
    // Une version impossible (0) est refusée : preuve que la version transmise est bien celle que l'on valide.
    const report = validatePipeline({ current, corrected: deepClone(current), version: 0 });
    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([expect.stringMatching(/^validateDataset a rejeté le dataset : [\s\S]*"version"/)]);
  });

  it('scénarios calculateFunding : aucun ne lève, totaux plausibles', () => {
    const issues: string[] = [];
    runFundingScenarios(deepClone(EMBEDDED_OPCOS), issues);
    expect(issues).toEqual([]);
  });

  it('scénarios : un total négatif (plafond horaire négatif dans les données) est signalé', () => {
    const opcos = deepClone(EMBEDDED_OPCOS);
    for (const o of opcos) {
      o.cout_horaire_inter.value = -10;
      for (const p of o.plafonds_par_taille ?? []) p.cout_horaire_max = -10;
    }
    const issues: string[] = [];
    runFundingScenarios(opcos, issues);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.includes('total négatif'))).toBe(true);
  });

  it("scénarios : un total nul (budget annuel publié à 0) n'est pas une anomalie", () => {
    const opcos = deepClone(EMBEDDED_OPCOS);
    for (const o of opcos) {
      o.budget_annuel_max.value = 0;
      o.budget_annuel_portee = 'global';
      for (const p of o.plafonds_par_taille ?? []) p.budget_annuel_max = 0;
    }
    // Prémisse : avec un budget à 0, la prise en charge calculée est bien nulle.
    const akto = opcos.find((o) => o.slug === 'akto')!;
    const etat = {
      ...createInitialWizardState(),
      opcoKnown: true,
      selectedOpcoSlug: akto.slug,
      contractType: 'cdi' as const,
      companySize: '11_49' as const,
      formationNom: 'Total nul',
      formationType: 'qualification' as const,
      durationHours: 35,
      pedagogyCostPerHour: 30,
      pedagogyCostTotal: 30 * 35,
      trainingMode: 'presentiel' as const,
      trainingDays: 5,
    };
    expect(calculateFunding(akto, etat).totalFunded).toBe(0);

    const issues: string[] = [];
    runFundingScenarios(opcos, issues);
    expect(issues).toEqual([]);
  });
});

// --- PUBLISH ------------------------------------------------------------------

describe('publish.publishDataset', () => {
  it('écrit v<N>/latest/manifest, incrémente la version, sha256 = octets exacts', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'opco-publish-'));
    const opcos = deepClone(EMBEDDED_OPCOS);

    const r1 = publishDataset(opcos, { datasetsDir: tmp, changelog: ['test 1'] });
    expect(r1.version).toBe(1);
    expect(fs.existsSync(path.join(tmp, 'v1.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'latest.json'))).toBe(true);

    const latestBytes = fs.readFileSync(path.join(tmp, 'latest.json'));
    expect(r1.sha256).toBe(sha256Hex(latestBytes));
    expect(verifyPublishedSha(tmp).ok).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf-8'));
    expect(manifest).toMatchObject({ version: 1, sha256: r1.sha256, opcoCount: 11, changelog: ['test 1'] });

    // latest.json doit avoir le format exact {version, generatedAt, opcos}
    const dataset = JSON.parse(latestBytes.toString('utf-8'));
    expect(Object.keys(dataset)).toEqual(['version', 'generatedAt', 'opcos']);
    expect(dataset.opcos).toHaveLength(11);

    const r2 = publishDataset(opcos, { datasetsDir: tmp, changelog: ['test 2'] });
    expect(r2.version).toBe(2);
    expect(fs.existsSync(path.join(tmp, 'v2.json'))).toBe(true);

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('outDir séparé (mode _drafts) : le dossier de référence n’est pas modifié', () => {
    const ref = fs.mkdtempSync(path.join(os.tmpdir(), 'opco-ref-'));
    const drafts = path.join(ref, '_drafts');
    publishDataset(deepClone(EMBEDDED_OPCOS), { datasetsDir: ref, outDir: drafts, changelog: [] });
    expect(fs.existsSync(path.join(drafts, 'latest.json'))).toBe(true);
    expect(fs.existsSync(path.join(ref, 'latest.json'))).toBe(false); // référence intacte
    fs.rmSync(ref, { recursive: true, force: true });
  });
});

// --- SCRAPE (helpers purs) ------------------------------------------------------

describe('scrape helpers', () => {
  it('parseRobots applique les sections * et OPCO-Funding-Bot', () => {
    const robots = ['User-agent: *', 'Disallow: /admin', '', 'User-agent: OPCO-Funding-Bot', 'Disallow: /private', '', 'User-agent: GoogleBot', 'Disallow: /'].join('\n');
    expect(parseRobots(robots)).toEqual(['/admin', '/private']);
  });

  it('htmlToText retire scripts/nav et normalise les espaces', () => {
    const html = '<html><body><nav>menu</nav><script>x()</script><p>Plafond :   25 €/h</p></body></html>';
    const text = htmlToText(html);
    expect(text).toContain('Plafond : 25 €/h');
    expect(text).not.toContain('menu');
    expect(text).not.toContain('x()');
  });
});
