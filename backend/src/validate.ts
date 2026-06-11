// ============================================================
// VALIDATE — garde-fous OBLIGATOIRES avant publication.
//
// 1. Schéma : chaque OPCO via OpcoDataSchema.parse (de @opco/core).
// 2. Bornes : sanityCheckOpco (de @opco/core).
// 3. Seuil de variation : un montant qui varie de plus de MAX_DELTA_PCT
//    (défaut 50 %) n'est PAS auto-publié -> needsReview + retour à
//    l'ancienne valeur (le plus sûr).
// 4. Non-régression : validateDataset (11 OPCO) + scénarios calculateFunding
//    représentatifs (un par mode de salaire + un cas plafond dépassé).
// ============================================================

import {
  OpcoDataSchema,
  calculateFunding,
  createInitialWizardState,
  sanityCheckOpco,
  validateDataset,
} from '@opco/core';
import type { OpcoData, WizardState } from '@opco/core';
import { NUMERIC_FIELDS, PLAFOND_FIELDS } from './types';
import type { NeedsReviewEntry, ValidationReport } from './types';
import { deepClone, getField } from './util';

export const DEFAULT_MAX_DELTA_PCT = 50;

export function getMaxDeltaPct(): number {
  const fromEnv = Number(process.env.MAX_DELTA_PCT);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_MAX_DELTA_PCT;
}

export interface ValidateInput {
  /** Dataset courant (avant corrections) — référence pour le seuil de variation. */
  current: OpcoData[];
  /** Dataset corrigé candidat à la publication. */
  corrected: OpcoData[];
  maxDeltaPct?: number;
}

// --- Seuil de variation ------------------------------------------------------

function deltaPct(oldV: number, newV: number): number {
  if (oldV === 0) return newV === 0 ? 0 : Infinity;
  return Math.abs((newV - oldV) / oldV) * 100;
}

/**
 * Applique le garde-fou de variation : tout changement hors seuil est REVENU
 * à l'ancienne valeur (SourcedValue complet restauré) et ajouté à needsReview.
 */
function applyDeltaGuard(
  current: OpcoData,
  corrected: OpcoData,
  maxDeltaPct: number,
  needsReview: NeedsReviewEntry[],
): OpcoData {
  const safe = deepClone(corrected);

  for (const field of NUMERIC_FIELDS) {
    const oldSv = getField(current, field);
    const newSv = getField(safe, field);
    const oldV = oldSv.value;
    const newV = newSv.value;
    if (oldV === newV) continue;

    let reason: string | null = null;
    if (oldV != null && newV != null) {
      const pct = deltaPct(oldV, newV);
      if (pct > maxDeltaPct) {
        reason = `Variation de ${pct === Infinity ? '∞' : pct.toFixed(1)} % > seuil ${maxDeltaPct} %`;
      }
    } else if (oldV == null && newV != null) {
      // Pas de base de comparaison : prudence, revue humaine.
      reason = 'Nouveau montant sans valeur de référence (ancienne valeur null)';
    } else if (oldV != null && newV == null) {
      // Ne devrait pas arriver (correct ne supprime jamais) — ceinture+bretelles.
      reason = "Suppression de montant détectée (interdite par les règles de correction)";
    }

    if (reason) {
      needsReview.push({ slug: current.slug, field, oldValue: oldV, newValue: newV, reason });
      // Le plus sûr : conserver l'ancienne valeur publiée telle quelle.
      safe[field] = deepClone(oldSv);
    }
  }

  // Plafonds par taille (nombres nus) — appariés par INDEX, car certaines
  // tailles sont dupliquées (ex. Constructys : deux entrées less_11).
  (current.plafonds_par_taille ?? []).forEach((oldPlafond, idx) => {
    const newPlafond = (safe.plafonds_par_taille ?? [])[idx];
    if (!newPlafond || newPlafond.taille !== oldPlafond.taille) return;
    for (const sub of PLAFOND_FIELDS) {
      const oldV = oldPlafond[sub];
      const newV = newPlafond[sub];
      if (oldV === newV) continue;
      const field = `plafonds_par_taille[${idx}:${oldPlafond.taille}].${sub}`;

      let reason: string | null = null;
      if (oldV != null && newV != null && deltaPct(oldV, newV) > maxDeltaPct) {
        reason = `Variation de ${deltaPct(oldV, newV).toFixed(1)} % > seuil ${maxDeltaPct} %`;
      } else if (oldV == null && newV != null) {
        reason = 'Nouveau plafond sans valeur de référence';
      } else if (oldV != null && newV == null) {
        reason = 'Suppression de plafond détectée';
      }

      if (reason) {
        needsReview.push({ slug: current.slug, field, oldValue: oldV, newValue: newV, reason });
        newPlafond[sub] = oldV;
      }
    }
  });

  return safe;
}

// --- Scénarios de non-régression ---------------------------------------------

function scenarioState(slug: string, overrides: Partial<WizardState>): WizardState {
  return {
    ...createInitialWizardState(),
    opcoKnown: true,
    selectedOpcoSlug: slug,
    contractType: 'cdi',
    companySize: '11_49',
    formationNom: 'Scénario de non-régression',
    formationType: 'qualification',
    durationHours: 35,
    pedagogyCostPerHour: 30,
    pedagogyCostTotal: 30 * 35,
    trainingMode: 'presentiel',
    trainingDays: 5,
    ...overrides,
  };
}

/**
 * ~5 scénarios calculateFunding représentatifs : un par mode de salaire
 * (euro_par_heure, pourcentage_pedagogique, selon_accord, inclus_plafond_horaire)
 * + un cas où le coût horaire dépasse le plafond.
 * Vérifie qu'aucun ne lève et que les totaux restent plausibles (≥ 0, finis).
 */
export function runFundingScenarios(opcos: OpcoData[], issues: string[]): void {
  const bySlug = new Map(opcos.map((o) => [o.slug, o]));
  const byMode = (mode: OpcoData['prise_en_charge_salaires_mode']) =>
    opcos.find((o) => o.prise_en_charge_salaires_mode === mode);

  const scenarios: { label: string; opco: OpcoData | undefined; state: (slug: string) => WizardState }[] = [
    {
      label: 'salaires euro_par_heure',
      opco: byMode('euro_par_heure'),
      state: (slug) => scenarioState(slug, {}),
    },
    {
      label: 'salaires pourcentage_pedagogique',
      // Aucun des 11 OPCO actuels n'utilise ce mode : on l'exerce sur une
      // copie (calculateFunding est une fonction pure -> aucune mutation).
      opco: (() => {
        const base = bySlug.get('akto') ?? opcos[0];
        if (!base) return undefined;
        const clone = deepClone(base);
        clone.prise_en_charge_salaires_mode = 'pourcentage_pedagogique';
        return clone;
      })(),
      state: (slug) => scenarioState(slug, {}),
    },
    {
      label: 'salaires selon_accord',
      opco: byMode('selon_accord'),
      state: (slug) => scenarioState(slug, {}),
    },
    {
      label: 'salaires inclus_plafond_horaire',
      // Mode possible dans le schéma mais pas forcément présent dans les
      // données du moment : on l'exerce sur une copie si aucun OPCO réel
      // ne l'utilise (calculateFunding est pure -> aucune mutation).
      opco: (() => {
        const real = byMode('inclus_plafond_horaire');
        if (real) return real;
        const base = opcos[0];
        if (!base) return undefined;
        const clone = deepClone(base);
        clone.prise_en_charge_salaires_mode = 'inclus_plafond_horaire';
        return clone;
      })(),
      state: (slug) => scenarioState(slug, {}),
    },
    {
      label: 'plafond horaire dépassé',
      // Coût demandé volontairement très au-dessus des plafonds publiés.
      opco: opcos.find((o) => o.cout_horaire_inter.value != null) ?? opcos[0],
      state: (slug) =>
        scenarioState(slug, { pedagogyCostPerHour: 150, pedagogyCostTotal: 150 * 35, needsTransport: true, transportMode: 'train' }),
    },
  ];

  for (const s of scenarios) {
    if (!s.opco) {
      issues.push(`Scénario "${s.label}" : aucun OPCO correspondant dans le dataset.`);
      continue;
    }
    try {
      const result = calculateFunding(s.opco, s.state(s.opco.slug));
      const totals = [result.totalRequested, result.totalFunded, result.totalRemainder];
      if (totals.some((t) => !Number.isFinite(t))) {
        issues.push(`Scénario "${s.label}" (${s.opco.slug}) : total non fini (${totals.join(', ')}).`);
      }
      if (result.totalFunded < 0 || result.totalRequested < 0) {
        issues.push(`Scénario "${s.label}" (${s.opco.slug}) : total négatif (funded=${result.totalFunded}).`);
      }
    } catch (err) {
      issues.push(`Scénario "${s.label}" (${s.opco?.slug}) : calculateFunding a levé : ${(err as Error).message}`);
    }
  }
}

// --- Validation complète ------------------------------------------------------

export function validatePipeline(input: ValidateInput): ValidationReport {
  const maxDeltaPct = input.maxDeltaPct ?? getMaxDeltaPct();
  const issues: string[] = [];
  const needsReview: NeedsReviewEntry[] = [];

  const currentBySlug = new Map(input.current.map((o) => [o.slug, o]));

  // 3) Seuil de variation (avant schéma : on publie les valeurs sûres).
  const safeOpcos = input.corrected.map((corrected) => {
    const current = currentBySlug.get(corrected.slug);
    if (!current) {
      issues.push(`OPCO inconnu dans le dataset courant : ${corrected.slug}`);
      return corrected;
    }
    return applyDeltaGuard(current, corrected, maxDeltaPct, needsReview);
  });

  // 1) Schéma + 2) bornes, OPCO par OPCO.
  for (const opco of safeOpcos) {
    const parsed = OpcoDataSchema.safeParse(opco);
    if (!parsed.success) {
      issues.push(`${opco.slug}: schéma invalide — ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' ; ')}`);
      continue;
    }
    for (const problem of sanityCheckOpco(parsed.data)) {
      issues.push(`Borne hors limites : ${problem}`);
    }
  }

  // 4) Non-régression : dataset complet (11 OPCO) + scénarios de calcul.
  try {
    validateDataset(
      { version: 1, generatedAt: new Date().toISOString(), opcos: safeOpcos },
      { minOpcoCount: 11 },
    );
  } catch (err) {
    issues.push(`validateDataset a rejeté le dataset : ${(err as Error).message}`);
  }

  runFundingScenarios(safeOpcos, issues);

  return { ok: issues.length === 0, issues, needsReview, opcos: safeOpcos };
}
