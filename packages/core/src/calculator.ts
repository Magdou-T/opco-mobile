// ============================================================
// OPCO Funding Calculation Engine
// Pure function: no side effects, no I/O, fully deterministic.
// ============================================================

import type {
  OpcoData,
  WizardState,
  FundingResult,
  FundingLine,
  Confidence,
  CompanySize,
  PlafondTaille,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick the stricter (least certain) confidence level. */
function leastConfident(a: Confidence, b: Confidence): Confidence {
  const order: Confidence[] = ['exact', 'estimated', 'depends_on_branche'];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

/** Safely clamp a value to [0, cap]. Returns the capped value. */
function clamp(value: number, cap: number | null | undefined): number {
  if (cap == null || cap <= 0) return value;
  return Math.min(value, cap);
}

/** Build a single FundingLine. */
function line(
  label: string,
  requested: number,
  funded: number,
  confidence: Confidence,
  sourceUrl: string,
  note?: string,
  details?: string[],
): FundingLine {
  return {
    label,
    requestedAmount: Math.round(requested * 100) / 100,
    fundedAmount: Math.round(funded * 100) / 100,
    remainder: Math.round((requested - funded) * 100) / 100,
    confidence,
    sourceUrl,
    note,
    details,
  };
}

// ---------------------------------------------------------------------------
// Size-based plafond resolution
// ---------------------------------------------------------------------------

function resolvePlafondForSize(
  opco: OpcoData,
  size: CompanySize | null,
): PlafondTaille | null {
  if (!opco.plafonds_par_taille || !size) return null;
  return opco.plafonds_par_taille.find((p) => p.taille === size) ?? null;
}

/**
 * Determine the effective hourly ceiling for pedagogy costs.
 *
 * Priority:
 *   1. Size-specific ceiling from plafonds_par_taille
 *   2. Training-type ceiling (cout_horaire_metier for métier, cout_horaire_inter otherwise)
 *   3. Null (no ceiling known) -> depends_on_branche
 */
function resolveHourlyCeiling(
  opco: OpcoData,
  state: WizardState,
): { ceiling: number | null; confidence: Confidence; sourceUrl: string } {
  // 1. Size-specific override (e.g. OPCO EP: 25€/h for 1-2 sal, 30€/h for 11-49)
  const plafond = resolvePlafondForSize(opco, state.companySize);
  if (plafond?.cout_horaire_max != null) {
    return {
      ceiling: plafond.cout_horaire_max,
      confidence: 'exact',
      sourceUrl: opco.url_finance_page,
    };
  }

  // 2. Training-type ceiling
  const isMetier =
    state.formationType === 'cqp' ||
    state.formationType === 'certification' ||
    state.formationType === 'habilitation';

  const sourcedCeiling = isMetier
    ? opco.cout_horaire_metier
    : opco.cout_horaire_inter;

  // Fallback: if the chosen type has no ceiling, try the other
  const fallback = isMetier
    ? opco.cout_horaire_inter
    : opco.cout_horaire_metier;

  const chosen = sourcedCeiling.value != null ? sourcedCeiling : fallback;

  return {
    ceiling: chosen.value,
    confidence: chosen.confidence,
    sourceUrl: chosen.source_url,
  };
}

// ---------------------------------------------------------------------------
// Individual line calculators
// ---------------------------------------------------------------------------

function calcPedagogy(
  opco: OpcoData,
  state: WizardState,
  warnings: string[],
): FundingLine {
  const hours = state.durationHours ?? 0;
  const userCostPerHour = state.pedagogyCostPerHour ?? 0;
  const requestedTotal = state.pedagogyCostTotal ?? userCostPerHour * hours;
  const details: string[] = [];

  const { ceiling, confidence: ceilingConfidence, sourceUrl } =
    resolveHourlyCeiling(opco, state);

  let effectiveRate: number;
  let confidence: Confidence;

  details.push(`Votre coût horaire : ${userCostPerHour} €/h × ${hours}h = ${(userCostPerHour * hours).toFixed(2)} €`);

  if (ceiling != null) {
    effectiveRate = Math.min(userCostPerHour, ceiling);
    confidence = ceilingConfidence;
    details.push(`Plafond horaire ${opco.name} : ${ceiling} €/h`);

    if (userCostPerHour > ceiling) {
      details.push(`⚠ Votre coût (${userCostPerHour} €/h) dépasse le plafond → taux appliqué : ${ceiling} €/h`);
      details.push(`Calcul : ${ceiling} €/h × ${hours}h = ${(ceiling * hours).toFixed(2)} €`);
      details.push(`Reste à charge sur ce poste : ${((userCostPerHour - ceiling) * hours).toFixed(2)} €`);
      warnings.push(
        `Le coût horaire demandé (${userCostPerHour} €/h) dépasse le plafond ${opco.name} (${ceiling} €/h). ` +
          `Le reste à charge est de ${((userCostPerHour - ceiling) * hours).toFixed(2)} €.`,
      );
    } else {
      details.push(`Votre coût est dans le plafond → intégralement pris en charge`);
      details.push(`Calcul : ${userCostPerHour} €/h × ${hours}h = ${(userCostPerHour * hours).toFixed(2)} €`);
    }
  } else {
    // No ceiling known — use user's cost but flag uncertainty
    effectiveRate = userCostPerHour;
    confidence = 'depends_on_branche';
    details.push(`Aucun plafond horaire officiel renseigné pour ${opco.name}`);
    details.push(`Le montant réel dépend de votre accord de branche — contactez votre OPCO`);
  }

  let funded = effectiveRate * hours;

  // Apply size-specific annual budget cap first
  const plafond = resolvePlafondForSize(opco, state.companySize);
  if (plafond?.budget_annuel_max != null && funded > plafond.budget_annuel_max) {
    details.push(`Plafond annuel pour votre taille d'entreprise : ${plafond.budget_annuel_max} € (${plafond.description})`);
    details.push(`Le montant calculé (${funded.toFixed(2)} €) dépasse ce plafond → ramené à ${plafond.budget_annuel_max} €`);
    funded = plafond.budget_annuel_max;
    warnings.push(
      `Plafond annuel spécifique taille entreprise appliqué : ${plafond.budget_annuel_max} € (${plafond.description}).`,
    );
  }

  return line(
    'Coûts pédagogiques',
    requestedTotal,
    funded,
    confidence,
    sourceUrl,
    ceiling != null
      ? `Plafond horaire : ${ceiling} €/h`
      : 'Plafond horaire non renseigné — dépend de l\'accord de branche',
    details,
  );
}

function calcSalary(
  opco: OpcoData,
  state: WizardState,
  pedagogyFunded: number,
): FundingLine {
  const hours = state.durationHours ?? 0;
  const mode = opco.prise_en_charge_salaires_mode;
  const rate = opco.prise_en_charge_salaires.value;
  const confidence = opco.prise_en_charge_salaires.confidence;
  const sourceUrl = opco.prise_en_charge_salaires.source_url;
  const details: string[] = [];

  let funded = 0;
  let note: string | undefined;

  switch (mode) {
    case 'euro_par_heure':
      funded = (rate ?? 0) * hours;
      note = rate != null ? `${rate} €/h × ${hours}h` : undefined;
      details.push(`Mode de calcul ${opco.name} : forfait horaire`);
      if (rate != null) {
        details.push(`Taux de prise en charge : ${rate} €/h`);
        details.push(`Calcul : ${rate} €/h × ${hours}h = ${funded.toFixed(2)} €`);
      }
      break;

    case 'pourcentage_pedagogique':
      funded = pedagogyFunded * ((rate ?? 0) / 100);
      note = rate != null
        ? `${rate}% des coûts pédagogiques pris en charge`
        : undefined;
      details.push(`Mode de calcul ${opco.name} : pourcentage des coûts pédagogiques`);
      if (rate != null) {
        details.push(`Taux : ${rate}% des coûts péda financés (${pedagogyFunded.toFixed(2)} €)`);
        details.push(`Calcul : ${pedagogyFunded.toFixed(2)} € × ${rate}% = ${funded.toFixed(2)} €`);
      }
      break;

    case 'selon_accord':
      funded = 0;
      note = 'Montant dépendant de l\'accord de branche';
      details.push(`${opco.name} ne publie pas de taux fixe pour les salaires`);
      details.push(`Le montant dépend de votre convention collective / accord de branche`);
      details.push(`Contactez votre OPCO pour connaître le montant exact`);
      break;

    case 'inclus_plafond_horaire':
      funded = 0;
      note = 'Prise en charge salaire incluse dans le plafond horaire pédagogique';
      details.push(`${opco.name} n'attribue pas de forfait salaire distinct`);
      details.push(`La prise en charge est intégrée au plafond horaire pédagogique`);
      details.push(`Aucune ligne salaire séparée n'est donc calculée`);
      break;
  }

  const effectiveConfidence: Confidence =
    mode === 'selon_accord' || mode === 'inclus_plafond_horaire'
      ? 'depends_on_branche'
      : confidence;

  return line(
    'Prise en charge salaires',
    funded,
    funded,
    effectiveConfidence,
    sourceUrl,
    note,
    details,
  );
}

function calcTransport(
  opco: OpcoData,
  state: WizardState,
): FundingLine {
  if (!state.needsTransport) {
    return line('Transport', 0, 0, 'exact', opco.url_finance_page);
  }

  const days = state.trainingDays ?? 0;
  const rate = opco.frais_transport.value;
  const confidence = opco.frais_transport.confidence;
  const sourceUrl = opco.frais_transport.source_url;

  if (rate != null && rate > 0) {
    const funded = rate * days;
    return line(
      'Transport',
      funded,
      funded,
      confidence,
      sourceUrl,
      `${rate} €/jour × ${days} jours`,
      [
        `Forfait transport journalier ${opco.name} : ${rate} €/jour`,
        `Calcul : ${rate} €/jour × ${days} jours = ${funded.toFixed(2)} €`,
      ],
    );
  }

  return line(
    'Transport',
    0,
    0,
    'depends_on_branche',
    sourceUrl,
    'Montant transport selon accord de branche',
    [
      `${opco.name} ne publie pas de forfait transport fixe`,
      `Le montant dépend de votre accord de branche`,
    ],
  );
}

function calcAccommodation(
  opco: OpcoData,
  state: WizardState,
): FundingLine {
  if (!state.needsAccommodation) {
    return line('Hébergement', 0, 0, 'exact', opco.url_finance_page);
  }

  const nights = state.accommodationNights ?? 0;
  const userCostPerNight = state.accommodationCostPerNight ?? 0;
  const requested = userCostPerNight * nights;

  const ceiling = opco.frais_hebergement.value;
  const confidence = opco.frais_hebergement.confidence;
  const sourceUrl = opco.frais_hebergement.source_url;

  if (ceiling != null && ceiling > 0) {
    const effectiveNight = Math.min(userCostPerNight, ceiling);
    const funded = effectiveNight * nights;
    const details = [
      `Votre coût : ${userCostPerNight} €/nuit × ${nights} nuits = ${requested.toFixed(2)} €`,
      `Plafond hébergement ${opco.name} : ${ceiling} €/nuit`,
    ];
    if (userCostPerNight > ceiling) {
      details.push(`⚠ Votre coût dépasse le plafond → taux appliqué : ${ceiling} €/nuit`);
      details.push(`Calcul : ${ceiling} €/nuit × ${nights} nuits = ${funded.toFixed(2)} €`);
    } else {
      details.push(`Votre coût est dans le plafond → intégralement pris en charge`);
    }
    return line(
      'Hébergement',
      requested,
      funded,
      confidence,
      sourceUrl,
      `Plafond : ${ceiling} €/nuit`,
      details,
    );
  }

  return line(
    'Hébergement',
    requested,
    requested,
    'depends_on_branche',
    sourceUrl,
    'Plafond hébergement non renseigné — dépend de l\'accord de branche',
    [
      `${opco.name} ne publie pas de plafond hébergement fixe`,
      `Le montant affiché est basé sur votre estimation et reste à confirmer`,
    ],
  );
}

function calcMeals(
  opco: OpcoData,
  state: WizardState,
): FundingLine {
  if (!state.needsMeals) {
    return line('Restauration', 0, 0, 'exact', opco.url_finance_page);
  }

  const days = state.trainingDays ?? 0;
  const userCostPerDay = state.mealCostPerDay ?? 0;
  const requested = userCostPerDay * days;

  const rate = opco.frais_restauration.value;
  const confidence = opco.frais_restauration.confidence;
  const sourceUrl = opco.frais_restauration.source_url;

  if (rate != null && rate > 0) {
    const funded = rate * days;
    return line(
      'Restauration',
      requested,
      funded,
      confidence,
      sourceUrl,
      `${rate} €/jour × ${days} jours`,
      [
        `Forfait restauration ${opco.name} : ${rate} €/jour`,
        `Calcul : ${rate} €/jour × ${days} jours = ${funded.toFixed(2)} €`,
        requested > funded
          ? `Reste à charge : ${(requested - funded).toFixed(2)} €`
          : `Intégralement couvert par le forfait`,
      ],
    );
  }

  return line(
    'Restauration',
    0,
    0,
    'depends_on_branche',
    sourceUrl,
    'Montant restauration selon accord de branche',
    [
      `${opco.name} ne publie pas de forfait restauration fixe`,
      `Le montant dépend de votre accord de branche`,
    ],
  );
}

function calcFraisAnnexesPourcentage(
  opco: OpcoData,
  pedagogyFunded: number,
): FundingLine | null {
  const pct = opco.frais_annexes_pourcentage.value;
  if (pct == null || pct <= 0) return null;

  const funded = pedagogyFunded * (pct / 100);
  return line(
    'Frais annexes (forfait %)',
    funded,
    funded,
    opco.frais_annexes_pourcentage.confidence,
    opco.frais_annexes_pourcentage.source_url,
    `${pct}% des coûts pédagogiques`,
    [
      `${opco.name} utilise un forfait global pour les frais annexes`,
      `Taux : ${pct}% des coûts pédagogiques financés`,
      `Calcul : ${pedagogyFunded.toFixed(2)} € × ${pct}% = ${funded.toFixed(2)} €`,
      `Ce forfait couvre transport, hébergement et restauration`,
    ],
  );
}

// ---------------------------------------------------------------------------
// Warnings generator
// ---------------------------------------------------------------------------

function generateWarnings(
  opco: OpcoData,
  state: WizardState,
  lines: FundingLine[],
  budgetCapApplied: boolean,
): string[] {
  const warnings: string[] = [];

  // Duration below OPCO minimum
  if (
    opco.quota_horaire_min != null &&
    state.durationHours != null &&
    state.durationHours < opco.quota_horaire_min
  ) {
    warnings.push(
      `La durée de formation (${state.durationHours}h) est inférieure au minimum requis par ${opco.name} (${opco.quota_horaire_min}h). ` +
        `La prise en charge pourrait être refusée.`,
    );
  }

  // Duration above OPCO maximum (size-specific)
  const plafond = resolvePlafondForSize(opco, state.companySize);
  if (
    plafond?.quota_horaire_max != null &&
    state.durationHours != null &&
    state.durationHours > plafond.quota_horaire_max
  ) {
    warnings.push(
      `La durée de formation (${state.durationHours}h) dépasse le plafond horaire pour votre taille d'entreprise ` +
        `(${plafond.quota_horaire_max}h). Les heures au-delà ne seront pas prises en charge.`,
    );
  }

  // General hour quota max
  if (
    plafond == null &&
    opco.quota_horaire_max != null &&
    state.durationHours != null &&
    state.durationHours > opco.quota_horaire_max
  ) {
    warnings.push(
      `La durée de formation (${state.durationHours}h) dépasse le plafond horaire ${opco.name} (${opco.quota_horaire_max}h).`,
    );
  }

  // Large company + OPCO prioritizes TPE/PME
  if (opco.priorite_tpe_pme && state.companySize === '300_plus') {
    warnings.push(
      `${opco.name} priorise les TPE/PME. Les entreprises de 300+ salariés peuvent avoir des prises en charge réduites ` +
        `ou des enveloppes limitées.`,
    );
  }

  // Any line has depends_on_branche
  const brancheLines = lines.filter(
    (l) => l.confidence === 'depends_on_branche' && l.fundedAmount > 0,
  );
  if (brancheLines.length > 0) {
    warnings.push(
      `Certains montants dépendent de votre accord de branche et peuvent varier. ` +
        `Contactez ${opco.name} pour confirmation.`,
    );
  }

  // Budget cap applied
  if (budgetCapApplied) {
    warnings.push(
      `Le plafond budgétaire annuel de ${opco.name} a été appliqué. Le montant total finançable est plafonné.`,
    );
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Conditions & next steps
// ---------------------------------------------------------------------------

function generateConditions(opco: OpcoData, state: WizardState): string[] {
  const conditions: string[] = [];

  conditions.push(`Être à jour des cotisations auprès de ${opco.name}.`);

  if (opco.processus_approbation) {
    conditions.push(opco.processus_approbation);
  }

  if (state.formationType === 'vae' && opco.vae_possible) {
    conditions.push('VAE : la formation doit être éligible au dispositif VAE de l\'OPCO.');
  }

  if (opco.duree_min_formation) {
    conditions.push(`Durée minimale de formation : ${opco.duree_min_formation}.`);
  }

  return conditions;
}

function generateNextSteps(opco: OpcoData): { label: string; url: string }[] {
  const steps: { label: string; url: string }[] = [];

  steps.push({
    label: `Consulter les critères de financement ${opco.name}`,
    url: opco.url_finance_page,
  });

  if (opco.email_contact) {
    steps.push({
      label: `Contacter ${opco.name} par email`,
      url: `mailto:${opco.email_contact}`,
    });
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Main calculation function
// ---------------------------------------------------------------------------

/**
 * Calculate OPCO funding estimate.
 *
 * This is a **pure function**: given the same OpcoData and WizardState it will
 * always return the same FundingResult. It performs no I/O and throws no
 * exceptions (invalid inputs yield zero-funded lines with appropriate warnings).
 */
export function calculateFunding(
  opcoData: OpcoData,
  state: WizardState,
): FundingResult {
  const earlyWarnings: string[] = [];

  // ---- 1. Pedagogy ----
  const pedagogyLine = calcPedagogy(opcoData, state, earlyWarnings);

  // ---- 2. Salary ----
  const salaryLine = calcSalary(opcoData, state, pedagogyLine.fundedAmount);

  // ---- 3. Ancillary costs ----
  // If the OPCO uses a global % for ancillary (e.g. Atlas 8%), use that model
  // instead of individual transport/accommodation/meals lines.
  const usePercentageModel =
    opcoData.frais_annexes_pourcentage.value != null &&
    opcoData.frais_annexes_pourcentage.value > 0;

  const ancillaryLines: FundingLine[] = [];

  if (usePercentageModel) {
    const pctLine = calcFraisAnnexesPourcentage(
      opcoData,
      pedagogyLine.fundedAmount,
    );
    if (pctLine) ancillaryLines.push(pctLine);

    // Still show zero-lines for transparency if user requested these
    if (state.needsTransport) {
      ancillaryLines.push(
        line(
          'Transport',
          0,
          0,
          'exact',
          opcoData.url_finance_page,
          'Inclus dans le forfait frais annexes (%)',
        ),
      );
    }
    if (state.needsAccommodation) {
      ancillaryLines.push(
        line(
          'Hébergement',
          0,
          0,
          'exact',
          opcoData.url_finance_page,
          'Inclus dans le forfait frais annexes (%)',
        ),
      );
    }
    if (state.needsMeals) {
      ancillaryLines.push(
        line(
          'Restauration',
          0,
          0,
          'exact',
          opcoData.url_finance_page,
          'Inclus dans le forfait frais annexes (%)',
        ),
      );
    }
  } else {
    ancillaryLines.push(calcTransport(opcoData, state));
    ancillaryLines.push(calcAccommodation(opcoData, state));
    ancillaryLines.push(calcMeals(opcoData, state));
  }

  // ---- 4. Assemble all lines ----
  const allLines: FundingLine[] = [pedagogyLine, salaryLine, ...ancillaryLines];

  // ---- 5. Totals ----
  let totalRequested = allLines.reduce((s, l) => s + l.requestedAmount, 0);
  let totalFunded = allLines.reduce((s, l) => s + l.fundedAmount, 0);

  // ---- 6. Global annual budget cap ----
  let budgetCapApplied = false;
  let budgetCapAmount: number | null = null;

  // Size-specific cap takes priority over global cap
  const plafond = resolvePlafondForSize(opcoData, state.companySize);
  const effectiveCap =
    plafond?.budget_annuel_max ?? opcoData.budget_annuel_max.value;

  if (effectiveCap != null && effectiveCap > 0 && totalFunded > effectiveCap) {
    // Proportionally reduce all funded amounts to fit under the cap
    const ratio = effectiveCap / totalFunded;
    for (const l of allLines) {
      l.fundedAmount = Math.round(l.fundedAmount * ratio * 100) / 100;
      l.remainder = Math.round((l.requestedAmount - l.fundedAmount) * 100) / 100;
    }
    totalFunded = effectiveCap;
    budgetCapApplied = true;
    budgetCapAmount = effectiveCap;
  }

  const totalRemainder = Math.round((totalRequested - totalFunded) * 100) / 100;

  // ---- 7. Warnings ----
  const warnings = [
    ...earlyWarnings,
    ...generateWarnings(opcoData, state, allLines, budgetCapApplied),
  ];

  // ---- 8. Conditions & next steps ----
  const conditions = generateConditions(opcoData, state);
  const nextSteps = generateNextSteps(opcoData);

  return {
    opcoName: opcoData.name,
    opcoSlug: opcoData.slug,
    opcoEmail: opcoData.email_contact,
    opcoUrl: opcoData.url_finance_page,
    lines: allLines,
    totalRequested: Math.round(totalRequested * 100) / 100,
    totalFunded: Math.round(totalFunded * 100) / 100,
    totalRemainder,
    budgetCapApplied,
    budgetCapAmount,
    warnings,
    conditions,
    nextSteps,
    delaiValidation: opcoData.delai_validation,
    modePaiement: opcoData.mode_paiement,
  };
}
