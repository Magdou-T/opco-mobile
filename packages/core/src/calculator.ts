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
  DispositifEligible,
  VarianteBranche,
  PosteFinancement,
} from './types';

/** Texte de référence de la règle des 50 salariés (fonds mutualisés du PDC). */
export const REFERENCE_REGLE_50_SALARIES = 'art. L. 6332-17 du code du travail';

// ---------------------------------------------------------------------------
// Variantes de branche (barèmes spécifiques par convention collective)
// ---------------------------------------------------------------------------

/**
 * Résout la variante de branche applicable.
 * Priorité : choix manuel de l'utilisateur > IDCC détecté (SIREN) > aucune.
 */
export function resolveVarianteBranche(
  opco: OpcoData,
  state: Pick<WizardState, 'selectedBrancheId' | 'detectedIdcc'>,
): VarianteBranche | null {
  const variantes = opco.variantes_branche ?? [];
  if (variantes.length === 0) return null;

  if (state.selectedBrancheId) {
    const manual = variantes.find((v) => v.id === state.selectedBrancheId);
    if (manual) return manual;
  }

  if (state.detectedIdcc) {
    const idcc = state.detectedIdcc.padStart(4, '0');
    const byIdcc = variantes.find((v) => v.idcc.includes(idcc));
    if (byIdcc) return byIdcc;
  }

  return null;
}

/**
 * Applique une variante de branche au barème par défaut de l'OPCO.
 * Pure : retourne un nouvel OpcoData fusionné, sans muter les entrées.
 */
export function applyVarianteBranche(opco: OpcoData, variante: VarianteBranche): OpcoData {
  // Une variante à plafond horaire fixe (sans barème dégressif propre) remplace le barème de l'OPCO :
  // hériter de ses seuils les ferait passer devant le plafond fixe de la branche.
  const plafondHoraireFixe = variante.cout_horaire_inter != null || variante.cout_horaire_metier != null;
  const heriteBaremeDegressif = !(plafondHoraireFixe && variante.cout_horaire_seuils == null);
  return {
    ...opco,
    cout_horaire_inter: variante.cout_horaire_inter ?? opco.cout_horaire_inter,
    cout_horaire_metier: variante.cout_horaire_metier ?? opco.cout_horaire_metier,
    cout_horaire_seuils: heriteBaremeDegressif
      ? (variante.cout_horaire_seuils ?? opco.cout_horaire_seuils)
      : undefined,
    cout_horaire_seuils_mode: heriteBaremeDegressif
      ? (variante.cout_horaire_seuils_mode ?? opco.cout_horaire_seuils_mode)
      : undefined,
    prise_en_charge_salaires: variante.prise_en_charge_salaires ?? opco.prise_en_charge_salaires,
    prise_en_charge_salaires_mode:
      variante.prise_en_charge_salaires_mode ?? opco.prise_en_charge_salaires_mode,
    frais_transport: variante.frais_transport ?? opco.frais_transport,
    frais_hebergement: variante.frais_hebergement ?? opco.frais_hebergement,
    frais_restauration: variante.frais_restauration ?? opco.frais_restauration,
    budget_annuel_max: variante.budget_annuel_max ?? opco.budget_annuel_max,
    budget_annuel_portee: variante.budget_annuel_portee ?? opco.budget_annuel_portee,
    budget_annuel_description: variante.budget_annuel_description ?? opco.budget_annuel_description,
    plafonds_par_taille: variante.plafonds_par_taille ?? opco.plafonds_par_taille,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const arrondi = (n: number): number => Math.round(n * 100) / 100;

/** Build a single FundingLine. */
function line(
  poste: PosteFinancement,
  label: string,
  requested: number,
  funded: number,
  confidence: Confidence,
  sourceUrl: string,
  note?: string,
  details?: string[],
): FundingLine {
  return {
    poste,
    label,
    requestedAmount: arrondi(requested),
    fundedAmount: arrondi(funded),
    remainder: arrondi(requested - funded),
    confidence,
    sourceUrl,
    note,
    details,
  };
}

function resolvePlafondForSize(opco: OpcoData, size: CompanySize | null): PlafondTaille | null {
  if (!opco.plafonds_par_taille || !size) return null;
  return opco.plafonds_par_taille.find((p) => p.taille === size) ?? null;
}

/** true si l'entreprise compte 50 salariés ou plus. */
export function estEntreprise50Plus(size: CompanySize | null): boolean {
  return size === '50_299' || size === '300_plus';
}

/** Enveloppe publiée pour les entreprises de 50 salariés et plus (plan conventionnel ou volontaire). */
function enveloppe50Plus(opco: OpcoData, size: CompanySize | null): PlafondTaille | null {
  if (!estEntreprise50Plus(size)) return null;
  const plafond = resolvePlafondForSize(opco, size);
  return plafond?.budget_annuel_max != null && plafond.budget_annuel_max > 0 ? plafond : null;
}

/**
 * Determine the effective hourly ceiling for pedagogy costs.
 * Priority: 1. size-specific ceiling, 2. training-type ceiling, 3. null.
 */
function resolveHourlyCeiling(
  opco: OpcoData,
  state: WizardState,
): { ceiling: number | null; confidence: Confidence; sourceUrl: string } {
  const plafond = resolvePlafondForSize(opco, state.companySize);
  if (plafond?.cout_horaire_max != null) {
    return { ceiling: plafond.cout_horaire_max, confidence: 'exact', sourceUrl: opco.url_finance_page };
  }

  const isMetier =
    state.formationType === 'cqp' ||
    state.formationType === 'certification' ||
    state.formationType === 'habilitation';
  const sourcedCeiling = isMetier ? opco.cout_horaire_metier : opco.cout_horaire_inter;
  const fallback = isMetier ? opco.cout_horaire_inter : opco.cout_horaire_metier;
  const chosen = sourcedCeiling.value != null ? sourcedCeiling : fallback;

  return { ceiling: chosen.value, confidence: chosen.confidence, sourceUrl: chosen.source_url };
}

/** Applique le barème dégressif de l'OPCO (null si l'OPCO n'en publie pas). */
function financementDegressif(
  opco: OpcoData,
  heures: number,
  tauxDemande: number,
): { finance: number; details: string[] } | null {
  const seuils = [...(opco.cout_horaire_seuils ?? [])].sort(
    (a, b) => (a.max_heures ?? Infinity) - (b.max_heures ?? Infinity),
  );
  if (seuils.length === 0 || heures <= 0) return null;

  if ((opco.cout_horaire_seuils_mode ?? 'par_tranche') === 'selon_duree_totale') {
    const tranche =
      seuils.find((t) => t.max_heures != null && heures <= t.max_heures) ?? seuils[seuils.length - 1];
    const taux = Math.min(tauxDemande, tranche.valeur);
    return {
      finance: taux * heures,
      details: [
        `Barème selon la durée totale (${heures} h) : plafond ${tranche.valeur} €/h`,
        `Calcul : ${taux} €/h × ${heures} h = ${(taux * heures).toFixed(2)} €`,
      ],
    };
  }

  const details: string[] = [];
  let restant = heures;
  let borneBasse = 0;
  let finance = 0;
  for (const t of seuils) {
    if (restant <= 0) break;
    const largeur = t.max_heures == null ? restant : Math.max(0, t.max_heures - borneBasse);
    const h = Math.min(restant, largeur);
    if (h > 0) {
      const taux = Math.min(tauxDemande, t.valeur);
      finance += taux * h;
      details.push(
        `Tranche ${borneBasse}-${t.max_heures ?? '…'} h : ${h} h × ${taux} €/h (plafond ${t.valeur} €/h) = ${(taux * h).toFixed(2)} €`,
      );
      restant -= h;
    }
    if (t.max_heures != null) borneBasse = t.max_heures;
  }
  if (restant > 0) details.push(`${restant} h au-delà du dernier seuil publié : non financées`);
  return { finance, details };
}

// ---------------------------------------------------------------------------
// Individual line calculators
// ---------------------------------------------------------------------------

function calcPedagogy(
  opco: OpcoData,
  state: WizardState,
  warnings: string[],
  capPedagogie: number | null,
): { ligne: FundingLine; capApplique: boolean } {
  const hours = state.durationHours ?? 0;
  const userCostPerHour = state.pedagogyCostPerHour ?? 0;
  const requestedTotal = state.pedagogyCostTotal ?? userCostPerHour * hours;
  const details: string[] = [
    `Votre coût horaire : ${userCostPerHour} €/h × ${hours} h = ${(userCostPerHour * hours).toFixed(2)} €`,
  ];

  let funded: number;
  let confidence: Confidence;
  let sourceUrl: string;
  let note: string;

  const degressif = financementDegressif(opco, hours, userCostPerHour);
  if (degressif) {
    funded = degressif.finance;
    confidence = opco.cout_horaire_inter.confidence;
    sourceUrl = opco.cout_horaire_inter.source_url;
    note = 'Barème dégressif selon la durée';
    details.push(...degressif.details);
    const reste = arrondi(userCostPerHour * hours - funded);
    if (reste > 0) {
      warnings.push(
        `Le barème dégressif de ${opco.name} laisse un reste à charge de ${reste.toFixed(2)} € sur les coûts pédagogiques.`,
      );
    }
  } else {
    const ceilingInfo = resolveHourlyCeiling(opco, state);
    sourceUrl = ceilingInfo.sourceUrl;
    if (ceilingInfo.ceiling != null) {
      const ceiling = ceilingInfo.ceiling;
      confidence = ceilingInfo.confidence;
      funded = Math.min(userCostPerHour, ceiling) * hours;
      note = `Plafond horaire : ${ceiling} €/h`;
      details.push(`Plafond horaire ${opco.name} : ${ceiling} €/h`);
      if (userCostPerHour > ceiling) {
        const reste = (userCostPerHour - ceiling) * hours;
        details.push(`⚠ Votre coût (${userCostPerHour} €/h) dépasse le plafond → taux appliqué : ${ceiling} €/h`);
        details.push(`Calcul : ${ceiling} €/h × ${hours} h = ${(ceiling * hours).toFixed(2)} €`);
        details.push(`Reste à charge sur ce poste : ${reste.toFixed(2)} €`);
        warnings.push(
          `Le coût horaire demandé (${userCostPerHour} €/h) dépasse le plafond ${opco.name} (${ceiling} €/h). ` +
            `Le reste à charge est de ${reste.toFixed(2)} €.`,
        );
      } else {
        details.push('Votre coût est dans le plafond → intégralement pris en charge');
        details.push(`Calcul : ${userCostPerHour} €/h × ${hours} h = ${(userCostPerHour * hours).toFixed(2)} €`);
      }
    } else {
      confidence = 'depends_on_branche';
      funded = userCostPerHour * hours;
      note = "Plafond horaire non renseigné — dépend de l'accord de branche";
      details.push(`Aucun plafond horaire officiel renseigné pour ${opco.name}`);
      details.push('Le montant réel dépend de votre accord de branche — contactez votre OPCO');
    }
  }

  let capApplique = false;
  if (capPedagogie != null && funded > capPedagogie) {
    details.push(`Plafond annuel applicable aux coûts pédagogiques : ${capPedagogie.toFixed(2)} €`);
    details.push(`Le montant calculé (${funded.toFixed(2)} €) dépasse ce plafond → ramené à ${capPedagogie.toFixed(2)} €`);
    funded = capPedagogie;
    capApplique = true;
    warnings.push(
      `Plafond annuel appliqué aux coûts pédagogiques : ${capPedagogie.toFixed(2)} € (salaires et frais annexes financés en plus).`,
    );
  }

  return {
    ligne: line('pedagogie', 'Coûts pédagogiques', requestedTotal, funded, confidence, sourceUrl, note, details),
    capApplique,
  };
}

function calcSalary(opco: OpcoData, state: WizardState, pedagogyFunded: number): FundingLine {
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
      note = rate != null ? `${rate}% des coûts pédagogiques pris en charge` : undefined;
      details.push(`Mode de calcul ${opco.name} : pourcentage des coûts pédagogiques`);
      if (rate != null) {
        details.push(`Taux : ${rate}% des coûts péda financés (${pedagogyFunded.toFixed(2)} €)`);
        details.push(`Calcul : ${pedagogyFunded.toFixed(2)} € × ${rate}% = ${funded.toFixed(2)} €`);
      }
      break;
    case 'selon_accord':
      note = "Montant dépendant de l'accord de branche";
      details.push(`${opco.name} ne publie pas de taux fixe pour les salaires`);
      details.push('Le montant dépend de votre convention collective / accord de branche');
      details.push('Contactez votre OPCO pour connaître le montant exact');
      break;
    case 'inclus_plafond_horaire':
      note = 'Prise en charge salaire incluse dans le plafond horaire pédagogique';
      details.push(`${opco.name} n'attribue pas de forfait salaire distinct`);
      details.push('La prise en charge est intégrée au plafond horaire pédagogique');
      details.push("Aucune ligne salaire séparée n'est donc calculée");
      break;
  }

  const effectiveConfidence: Confidence =
    mode === 'selon_accord' || mode === 'inclus_plafond_horaire' ? 'depends_on_branche' : confidence;

  return line('salaires', 'Prise en charge salaires', funded, funded, effectiveConfidence, sourceUrl, note, details);
}

function calcTransport(opco: OpcoData, state: WizardState): FundingLine {
  if (!state.needsTransport) return line('transport', 'Transport', 0, 0, 'exact', opco.url_finance_page);

  const days = state.trainingDays ?? 0;
  const rate = opco.frais_transport.value;
  const confidence = opco.frais_transport.confidence;
  const sourceUrl = opco.frais_transport.source_url;

  if (rate != null && rate > 0) {
    const funded = rate * days;
    return line('transport', 'Transport', funded, funded, confidence, sourceUrl, `${rate} €/jour × ${days} jours`, [
      `Forfait transport journalier ${opco.name} : ${rate} €/jour`,
      `Calcul : ${rate} €/jour × ${days} jours = ${funded.toFixed(2)} €`,
    ]);
  }

  return line('transport', 'Transport', 0, 0, 'depends_on_branche', sourceUrl, 'Montant transport selon accord de branche', [
    `${opco.name} ne publie pas de forfait transport fixe`,
    'Le montant dépend de votre accord de branche',
  ]);
}

function calcAccommodation(opco: OpcoData, state: WizardState): FundingLine {
  if (!state.needsAccommodation) return line('hebergement', 'Hébergement', 0, 0, 'exact', opco.url_finance_page);

  const nights = state.accommodationNights ?? 0;
  const userCostPerNight = state.accommodationCostPerNight ?? 0;
  const requested = userCostPerNight * nights;
  const ceiling = opco.frais_hebergement.value;
  const confidence = opco.frais_hebergement.confidence;
  const sourceUrl = opco.frais_hebergement.source_url;

  if (ceiling != null && ceiling > 0) {
    const funded = Math.min(userCostPerNight, ceiling) * nights;
    const details = [
      `Votre coût : ${userCostPerNight} €/nuit × ${nights} nuits = ${requested.toFixed(2)} €`,
      `Plafond hébergement ${opco.name} : ${ceiling} €/nuit`,
    ];
    if (userCostPerNight > ceiling) {
      details.push(`⚠ Votre coût dépasse le plafond → taux appliqué : ${ceiling} €/nuit`);
      details.push(`Calcul : ${ceiling} €/nuit × ${nights} nuits = ${funded.toFixed(2)} €`);
    } else {
      details.push('Votre coût est dans le plafond → intégralement pris en charge');
    }
    return line('hebergement', 'Hébergement', requested, funded, confidence, sourceUrl, `Plafond : ${ceiling} €/nuit`, details);
  }

  // Aucun plafond exploitable : jamais de montant inventé, le coût saisi reste entièrement à charge.
  if (ceiling === 0) {
    return line('hebergement', 'Hébergement', requested, 0, confidence, sourceUrl, `Hébergement non pris en charge par ${opco.name}`, [
      `${opco.name} ne finance pas l'hébergement dans ce cadre`,
    ]);
  }

  return line(
    'hebergement',
    'Hébergement',
    requested,
    0,
    'depends_on_branche',
    sourceUrl,
    "Plafond hébergement non publié : prise en charge selon l'accord de branche, à confirmer auprès de l'OPCO",
    [
      `${opco.name} ne publie pas de plafond hébergement`,
      "Aucun montant n'est compté tant que l'OPCO ne l'a pas confirmé",
    ],
  );
}

function calcMeals(opco: OpcoData, state: WizardState): FundingLine {
  if (!state.needsMeals) return line('restauration', 'Restauration', 0, 0, 'exact', opco.url_finance_page);

  const days = state.trainingDays ?? 0;
  const userCostPerDay = state.mealCostPerDay ?? 0;
  const requested = userCostPerDay * days;
  const rate = opco.frais_restauration.value;
  const confidence = opco.frais_restauration.confidence;
  const sourceUrl = opco.frais_restauration.source_url;

  if (rate != null && rate > 0) {
    // Le forfait plafonne la prise en charge, il ne la garantit pas : jamais plus que le coût déclaré.
    const tauxApplique = Math.min(userCostPerDay, rate);
    const funded = tauxApplique * days;
    const details = [`Forfait restauration ${opco.name} : ${rate} €/jour`];
    if (userCostPerDay < rate) {
      details.push(`Votre coût (${userCostPerDay} €/jour) est inférieur au forfait : prise en charge au coût réel`);
    }
    details.push(
      `Calcul : ${tauxApplique} €/jour × ${days} jours = ${funded.toFixed(2)} €`,
      requested > funded
        ? `Reste à charge : ${(requested - funded).toFixed(2)} €`
        : 'Intégralement couvert par le forfait',
    );
    return line('restauration', 'Restauration', requested, funded, confidence, sourceUrl, `${rate} €/jour × ${days} jours`, details);
  }

  return line('restauration', 'Restauration', 0, 0, 'depends_on_branche', sourceUrl, 'Montant restauration selon accord de branche', [
    `${opco.name} ne publie pas de forfait restauration fixe`,
    'Le montant dépend de votre accord de branche',
  ]);
}

function calcFraisAnnexesPourcentage(opco: OpcoData, pedagogyFunded: number): FundingLine | null {
  const pct = opco.frais_annexes_pourcentage.value;
  if (pct == null || pct <= 0) return null;

  const funded = pedagogyFunded * (pct / 100);
  return line(
    'frais_annexes',
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
      'Ce forfait couvre transport, hébergement et restauration',
    ],
  );
}

/** Lignes à 0 € quand le PDC mutualisé n'est pas accessible (50 salariés et plus). */
function lignesPdcFerme(opco: OpcoData, state: WizardState): FundingLine[] {
  const hours = state.durationHours ?? 0;
  const requested = state.pedagogyCostTotal ?? (state.pedagogyCostPerHour ?? 0) * hours;
  const note = 'Fonds mutualisés réservés aux entreprises de moins de 50 salariés';
  const details = [
    `Les fonds mutualisés de ${opco.name} pour le plan de développement des compétences sont réservés aux entreprises de moins de 50 salariés (${REFERENCE_REGLE_50_SALARIES}).`,
    `${opco.name} ne publie pas d'enveloppe conventionnelle ou volontaire pour votre taille d'entreprise : aucun financement n'est estimé sur ce dispositif.`,
  ];
  const lignes = [
    line('pedagogie', 'Coûts pédagogiques', requested, 0, 'exact', opco.url_finance_page, note, details),
    line('salaires', 'Prise en charge salaires', 0, 0, 'exact', opco.url_finance_page, note),
  ];
  if (state.needsAccommodation) {
    lignes.push(
      line('hebergement', 'Hébergement', (state.accommodationCostPerNight ?? 0) * (state.accommodationNights ?? 0), 0, 'exact', opco.url_finance_page, note),
    );
  }
  if (state.needsMeals) {
    lignes.push(
      line('restauration', 'Restauration', (state.mealCostPerDay ?? 0) * (state.trainingDays ?? 0), 0, 'exact', opco.url_finance_page, note),
    );
  }
  return lignes;
}

// ---------------------------------------------------------------------------
// Warnings, conditions, next steps
// ---------------------------------------------------------------------------

function generateWarnings(
  opco: OpcoData,
  state: WizardState,
  lines: FundingLine[],
  budgetCapApplied: boolean,
): string[] {
  const warnings: string[] = [];

  if (opco.quota_horaire_min != null && state.durationHours != null && state.durationHours < opco.quota_horaire_min) {
    warnings.push(
      `La durée de formation (${state.durationHours}h) est inférieure au minimum requis par ${opco.name} (${opco.quota_horaire_min}h). ` +
        'La prise en charge pourrait être refusée.',
    );
  }

  const plafond = resolvePlafondForSize(opco, state.companySize);
  if (plafond?.quota_horaire_max != null && state.durationHours != null && state.durationHours > plafond.quota_horaire_max) {
    warnings.push(
      `La durée de formation (${state.durationHours}h) dépasse le plafond horaire pour votre taille d'entreprise ` +
        `(${plafond.quota_horaire_max}h). Les heures au-delà ne seront pas prises en charge.`,
    );
  }

  if (plafond == null && opco.quota_horaire_max != null && state.durationHours != null && state.durationHours > opco.quota_horaire_max) {
    warnings.push(`La durée de formation (${state.durationHours}h) dépasse le plafond horaire ${opco.name} (${opco.quota_horaire_max}h).`);
  }

  if (opco.priorite_tpe_pme && state.companySize === '300_plus') {
    warnings.push(
      `${opco.name} priorise les TPE/PME. Les entreprises de 300+ salariés peuvent avoir des prises en charge réduites ` +
        'ou des enveloppes limitées.',
    );
  }

  if (lines.some((l) => l.confidence === 'depends_on_branche' && l.fundedAmount > 0)) {
    warnings.push(
      'Certains montants dépendent de votre accord de branche et peuvent varier. ' +
        `Contactez ${opco.name} pour confirmation.`,
    );
  }

  if (budgetCapApplied) {
    if ((opco.budget_annuel_portee ?? 'global') === 'pedagogie') {
      // Salaires et frais annexes sont financés en plus (cf. calcPedagogy) : le total n'est pas plafonné.
      warnings.push(`Le plafond budgétaire annuel de ${opco.name} a été appliqué aux coûts pédagogiques.`);
    } else {
      warnings.push(`Le plafond budgétaire annuel de ${opco.name} a été appliqué. Le montant total finançable est plafonné.`);
    }
  }

  return warnings;
}

function generateConditions(opco: OpcoData, state: WizardState): string[] {
  const conditions: string[] = [`Être à jour des cotisations auprès de ${opco.name}.`];
  if (opco.processus_approbation) conditions.push(opco.processus_approbation);
  if (state.formationType === 'vae' && opco.vae_possible) {
    conditions.push("VAE : la formation doit être éligible au dispositif VAE de l'OPCO.");
  }
  if (opco.duree_min_formation) conditions.push(`Durée minimale de formation : ${opco.duree_min_formation}.`);
  return conditions;
}

function generateNextSteps(opco: OpcoData): { label: string; url: string }[] {
  const steps = [{ label: `Consulter les critères de financement ${opco.name}`, url: opco.url_finance_page }];
  if (opco.email_contact) steps.push({ label: `Contacter ${opco.name} par email`, url: `mailto:${opco.email_contact}` });
  return steps;
}

// ---------------------------------------------------------------------------
// Dispositifs complémentaires (cumuls d'enveloppes)
// ---------------------------------------------------------------------------

/**
 * Évalue les dispositifs complémentaires de l'OPCO pour la situation donnée.
 * Un dispositif en % est calculé sur le RESTE à financer (sur le coût complet
 * s'il est « alternatif » au PDC). Les forfaits restent théoriques ; l'enveloppe
 * globale est plafonnée au coût par calculateFunding.
 */
function evaluateDispositifs(
  opco: OpcoData,
  state: WizardState,
  pedagogyRequested: number,
  pedagogyFunded: number,
): DispositifEligible[] {
  const results: DispositifEligible[] = [];

  for (const d of opco.dispositifs_complementaires ?? []) {
    if (d.tailles_eligibles != null && state.companySize != null && !d.tailles_eligibles.includes(state.companySize)) {
      continue;
    }

    let montantEstime: number | null = null;
    if (d.pourcentage_couts != null) {
      const base = d.cumul === 'alternatif' ? pedagogyRequested : Math.max(0, pedagogyRequested - pedagogyFunded);
      if (pedagogyRequested > 0) {
        montantEstime = base * (d.pourcentage_couts / 100);
        if (d.montant_max != null) montantEstime = Math.min(montantEstime, d.montant_max);
      }
    } else if (d.montant_max != null) {
      switch (d.unite) {
        case 'par_heure':
          montantEstime = state.durationHours != null ? d.montant_max * state.durationHours : null;
          break;
        case 'par_jour':
          montantEstime = state.trainingDays != null ? d.montant_max * state.trainingDays : null;
          break;
        default:
          montantEstime = d.montant_max;
      }
    }

    results.push({
      id: d.id,
      nom: d.nom,
      cumul: d.cumul,
      montantEstime: montantEstime != null ? arrondi(montantEstime) : null,
      description: d.description,
      conditions: d.conditions,
      demarches: d.demarches,
      publics: d.publics,
      confidence: d.confidence,
      sourceUrl: d.source_url,
    });
  }

  return results;
}

/** Construit la liste ordonnée des démarches concrètes. */
function generateDemarches(opco: OpcoData, dispositifs: DispositifEligible[]): string[] {
  const steps: string[] = [
    `Vérifier que votre entreprise est à jour de ses cotisations auprès de ${opco.name}.`,
    "Demander un devis et le programme détaillé à l'organisme de formation (certifié Qualiopi).",
  ];
  steps.push(
    opco.processus_approbation ||
      `Déposer la demande de prise en charge sur l'espace entreprise ${opco.name}, AVANT le début de la formation.`,
  );
  if (typeof opco.delai_validation === 'string' && opco.delai_validation) {
    steps.push(`Délai : ${opco.delai_validation}`);
  }
  steps.push("Attendre l'accord de prise en charge AVANT de démarrer la formation (sous réserve de fonds disponibles).");
  const cumulables = dispositifs.filter((d) => d.cumul !== 'alternatif');
  if (cumulables.length > 0) {
    steps.push(
      `Demander en parallèle les financements complémentaires éligibles : ${cumulables.map((d) => d.nom).join(', ')} (voir conditions de chaque dispositif).`,
    );
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Main calculation function
// ---------------------------------------------------------------------------

/**
 * Calculate OPCO funding estimate (plan de développement des compétences).
 * Pure function: same OpcoData + WizardState → same FundingResult.
 */
export function calculateFunding(rawOpcoData: OpcoData, state: WizardState): FundingResult {
  const earlyWarnings: string[] = [];

  // ---- 0. Barème de branche (variante) ----
  const variante = resolveVarianteBranche(rawOpcoData, state);
  const opcoData = variante ? applyVarianteBranche(rawOpcoData, variante) : rawOpcoData;
  const brancheAppliquee = variante?.branche_nom ?? null;
  if (!variante && (rawOpcoData.variantes_branche?.length ?? 0) > 0) {
    earlyWarnings.push(
      `Barème général ${rawOpcoData.name} appliqué : votre branche professionnelle peut prévoir des montants différents ` +
        `(souvent supérieurs). Sélectionnez votre branche professionnelle ou vérifiez les règles de votre branche sur ${rawOpcoData.url_finance_page}`,
    );
  }

  // ---- 1. Règle des 50 salariés ----
  const grandeEntreprise = estEntreprise50Plus(state.companySize);
  const enveloppeGrande = enveloppe50Plus(opcoData, state.companySize);
  const pdcFerme = grandeEntreprise && enveloppeGrande == null;

  // ---- 2. Plafond annuel restant ----
  const budgetDejaConsomme = Math.max(0, state.budgetDejaConsomme ?? 0);
  const plafond = resolvePlafondForSize(opcoData, state.companySize);
  const annualCap = plafond?.budget_annuel_max ?? (grandeEntreprise ? null : opcoData.budget_annuel_max.value);
  const capRestant = annualCap != null && annualCap > 0 ? Math.max(0, annualCap - budgetDejaConsomme) : null;
  const portee = opcoData.budget_annuel_portee ?? 'global';

  // ---- 3. Lignes ----
  let allLines: FundingLine[];
  let capPedagogieApplique = false;
  if (pdcFerme) {
    allLines = lignesPdcFerme(opcoData, state);
  } else {
    const { ligne: pedagogyLine, capApplique } = calcPedagogy(
      opcoData,
      state,
      earlyWarnings,
      portee === 'pedagogie' ? capRestant : null,
    );
    capPedagogieApplique = capApplique;
    const salaryLine = calcSalary(opcoData, state, pedagogyLine.fundedAmount);

    const usePercentageModel =
      opcoData.frais_annexes_pourcentage.value != null && opcoData.frais_annexes_pourcentage.value > 0;
    const ancillaryLines: FundingLine[] = [];
    if (usePercentageModel) {
      const pctLine = calcFraisAnnexesPourcentage(opcoData, pedagogyLine.fundedAmount);
      if (pctLine) ancillaryLines.push(pctLine);
      const inclus = 'Inclus dans le forfait frais annexes (%)';
      if (state.needsTransport) ancillaryLines.push(line('transport', 'Transport', 0, 0, 'exact', opcoData.url_finance_page, inclus));
      if (state.needsAccommodation) ancillaryLines.push(line('hebergement', 'Hébergement', 0, 0, 'exact', opcoData.url_finance_page, inclus));
      if (state.needsMeals) ancillaryLines.push(line('restauration', 'Restauration', 0, 0, 'exact', opcoData.url_finance_page, inclus));
    } else {
      ancillaryLines.push(calcTransport(opcoData, state));
      ancillaryLines.push(calcAccommodation(opcoData, state));
      ancillaryLines.push(calcMeals(opcoData, state));
    }
    allLines = [pedagogyLine, salaryLine, ...ancillaryLines];
  }

  // ---- 4. Totaux et plafond global ----
  const totalRequested = allLines.reduce((s, l) => s + l.requestedAmount, 0);
  let totalFunded = allLines.reduce((s, l) => s + l.fundedAmount, 0);
  let budgetCapApplied = capPedagogieApplique;
  let budgetCapAmount: number | null = capPedagogieApplique ? capRestant : null;

  if (!pdcFerme && portee === 'global' && capRestant != null && totalFunded > capRestant) {
    const ratio = capRestant > 0 ? capRestant / totalFunded : 0;
    for (const l of allLines) {
      l.fundedAmount = arrondi(l.fundedAmount * ratio);
      l.remainder = arrondi(l.requestedAmount - l.fundedAmount);
    }
    totalFunded = capRestant;
    budgetCapApplied = true;
    budgetCapAmount = capRestant;
  }

  const totalRemainder = arrondi(totalRequested - totalFunded);

  // ---- 5. Dispositifs complémentaires (enveloppe plafonnée au coût) ----
  const pedagogyLine = allLines.find((l) => l.poste === 'pedagogie')!;
  const dispositifsComplementaires = evaluateDispositifs(
    opcoData,
    state,
    pedagogyLine.requestedAmount,
    pedagogyLine.fundedAmount,
  );
  const cumulable = dispositifsComplementaires
    .filter((d) => d.cumul !== 'alternatif')
    .reduce((s, d) => s + (d.montantEstime ?? 0), 0);
  const enveloppeMaxPotentielle = arrondi(Math.min(totalRequested, totalFunded + cumulable));

  // ---- 6. Warnings ----
  const warnings = [...earlyWarnings, ...generateWarnings(opcoData, state, allLines, budgetCapApplied)];
  if (pdcFerme) {
    warnings.unshift(
      `Règle légale : les fonds mutualisés de ${opcoData.name} pour le plan de développement des compétences sont réservés ` +
        `aux entreprises de moins de 50 salariés (${REFERENCE_REGLE_50_SALARIES}). Aucune prise en charge n'est estimée sur ces fonds.`,
      `Pistes pour votre entreprise : contributions conventionnelles ou versements volontaires auprès de ${opcoData.name} ` +
        '(selon votre branche), alternance, période de reconversion, actions collectives, et les autres aides identifiées.',
    );
  }
  if (enveloppeGrande) {
    warnings.push(
      `Entreprise de 50 salariés et plus : ${enveloppeGrande.description} Ces fonds (conventionnels ou volontaires) ` +
        'dépendent de votre branche et restent soumis aux fonds disponibles.',
    );
  }
  if (!pdcFerme && budgetDejaConsomme > 0 && annualCap != null && annualCap > 0) {
    warnings.push(
      `Budget déjà consommé cette année (${budgetDejaConsomme.toFixed(0)} €) déduit du plafond annuel ` +
        `(${annualCap.toFixed(0)} €) : enveloppe restante ${Math.max(0, annualCap - budgetDejaConsomme).toFixed(0)} €.`,
    );
    if (annualCap - budgetDejaConsomme <= 0) {
      warnings.push(
        `Votre enveloppe annuelle ${opcoData.name} est épuisée. Examinez les financements complémentaires ci-dessous ou attendez l'année suivante.`,
      );
    }
  }
  if (dispositifsComplementaires.some((d) => d.cumul !== 'alternatif' && d.montantEstime == null)) {
    warnings.push(
      "Certains financements complémentaires ne sont pas chiffrables à l'avance : l'enveloppe maximale réelle peut être supérieure à l'estimation.",
    );
  }

  // ---- 7. Conditions, démarches & next steps ----
  const dispositifPrincipal = pdcFerme
    ? 'Plan de développement des compétences — fonds mutualisés non accessibles (50 salariés et plus)'
    : enveloppeGrande
      ? 'Plan de développement des compétences (fonds conventionnels ou volontaires, 50 salariés et plus)'
      : 'Plan de développement des compétences (fonds mutualisés OPCO)';

  return {
    opcoName: opcoData.name,
    opcoSlug: opcoData.slug,
    opcoEmail: opcoData.email_contact,
    opcoUrl: opcoData.url_finance_page,
    dispositifPrincipal,
    brancheAppliquee,
    lines: allLines,
    totalRequested: arrondi(totalRequested),
    totalFunded: arrondi(totalFunded),
    totalRemainder,
    budgetCapApplied,
    budgetCapAmount,
    budgetDejaConsomme,
    dispositifsComplementaires,
    enveloppeMaxPotentielle,
    warnings,
    conditions: generateConditions(opcoData, state),
    demarches: generateDemarches(opcoData, dispositifsComplementaires),
    nextSteps: generateNextSteps(opcoData),
    delaiValidation: opcoData.delai_validation,
    modePaiement: opcoData.mode_paiement,
  };
}
