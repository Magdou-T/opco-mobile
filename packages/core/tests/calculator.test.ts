import { describe, it, expect } from 'vitest';
import { calculateFunding, applyVarianteBranche } from '../src/calculator';
import type { AlerteOpco, DispositifComplementaire, OpcoData, PlafondTaille, VarianteBranche, WizardState } from '../src/types';
import { makeOpco, makeFormationState } from './fixtures';

describe('calculateFunding — coûts pédagogiques', () => {
  it('finance intégralement quand le coût est sous le plafond horaire', () => {
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' } });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 30 });
    const r = calculateFunding(opco, state);
    const peda = r.lines.find((l) => l.label === 'Coûts pédagogiques')!;
    expect(peda.requestedAmount).toBe(3000);
    expect(peda.fundedAmount).toBe(3000); // 30€/h sous le plafond 40€/h
    expect(peda.remainder).toBe(0);
  });

  it('plafonne au plafond horaire et laisse un reste à charge', () => {
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' } });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 50 });
    const r = calculateFunding(opco, state);
    const peda = r.lines.find((l) => l.label === 'Coûts pédagogiques')!;
    expect(peda.fundedAmount).toBe(4000); // 40€/h × 100h
    expect(peda.remainder).toBe(1000); // (50-40) × 100
    expect(r.warnings.some((w) => w.includes('dépasse le plafond'))).toBe(true);
  });

  it('marque depends_on_branche quand aucun plafond horaire connu, sans compter de montant faute de budget annuel publié', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: null, confidence: 'depends_on_branche', source_url: 'x' },
      cout_horaire_metier: { value: null, confidence: 'depends_on_branche', source_url: 'x' },
    });
    const state = makeFormationState({ durationHours: 50, pedagogyCostPerHour: 25 });
    const r = calculateFunding(opco, state);
    const peda = r.lines.find((l) => l.label === 'Coûts pédagogiques')!;
    expect(peda.confidence).toBe('depends_on_branche');
    expect(peda.requestedAmount).toBe(1250);
    // Ni plafond horaire ni budget annuel publiés : rien ne borne le montant, il n'est donc pas compté comme financé
    // (avant la tâche 8a, le coût saisi entier était financé).
    expect(peda.fundedAmount).toBe(0);
  });
});

describe('calculateFunding — prise en charge salaires', () => {
  it('mode euro_par_heure', () => {
    const opco = makeOpco({
      prise_en_charge_salaires: { value: 12, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'euro_par_heure',
    });
    const state = makeFormationState({ durationHours: 100 });
    const r = calculateFunding(opco, state);
    const sal = r.lines.find((l) => l.label === 'Prise en charge salaires')!;
    expect(sal.fundedAmount).toBe(1200); // 12€/h × 100h
  });

  it('mode pourcentage_pedagogique (% des coûts péda financés)', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires: { value: 50, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'pourcentage_pedagogique',
    });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 30 });
    const r = calculateFunding(opco, state);
    const sal = r.lines.find((l) => l.label === 'Prise en charge salaires')!;
    expect(sal.fundedAmount).toBe(1500); // 50% de 3000€
  });

  it('mode selon_accord → 0 et depends_on_branche', () => {
    const opco = makeOpco({ prise_en_charge_salaires_mode: 'selon_accord' });
    const state = makeFormationState({ durationHours: 100 });
    const r = calculateFunding(opco, state);
    const sal = r.lines.find((l) => l.label === 'Prise en charge salaires')!;
    expect(sal.fundedAmount).toBe(0);
    expect(sal.confidence).toBe('depends_on_branche');
  });
});

describe('calculateFunding — prise en charge des salaires propre à la taille d\'entreprise', () => {
  const plafondTaille = (taille: PlafondTaille['taille'], over: Partial<PlafondTaille> = {}): PlafondTaille => ({
    taille,
    cout_horaire_max: null,
    budget_annuel_max: null,
    quota_horaire_max: null,
    description: `Plafond ${taille}`,
    ...over,
  });
  // Barème de type Constructys : 15 €/h sous 11 salariés, 10 €/h de 11 à 49, rien au-delà.
  const opcoSalairesParTaille = (plafonds: PlafondTaille[]): OpcoData =>
    makeOpco({
      prise_en_charge_salaires: { value: 15, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      plafonds_par_taille: plafonds,
    });
  const taillesConstructys = () => [
    plafondTaille('less_11', { prise_en_charge_salaires_horaire: 15 }),
    plafondTaille('11_49', { prise_en_charge_salaires_horaire: 10 }),
  ];
  const salaires = (opco: OpcoData, companySize: WizardState['companySize']) =>
    calculateFunding(opco, makeFormationState({ companySize, durationHours: 100 })).lines.find((l) => l.poste === 'salaires')!;

  it('moins de 11 salariés : 15 €/h', () => {
    const sal = salaires(opcoSalairesParTaille(taillesConstructys()), 'less_11');
    expect(sal.fundedAmount).toBe(1500);
    expect(sal.note).toBe('15 €/h × 100h');
  });

  it('de 11 à 49 salariés : 10 €/h, avec le détail du taux propre à la taille', () => {
    const sal = salaires(opcoSalairesParTaille(taillesConstructys()), '11_49');
    expect(sal.fundedAmount).toBe(1000);
    expect(sal.note).toBe('10 €/h × 100h');
    expect(sal.details).toContain('Taux propre à votre taille d\'entreprise : 10 €/h');
    expect(sal.details).toContain('Calcul : 10 €/h × 100h = 1000.00 €');
  });

  it('une taille à null : aucune prise en charge des salaires, avec la note explicative', () => {
    const opco = opcoSalairesParTaille([
      plafondTaille('less_11', { prise_en_charge_salaires_horaire: 15 }),
      plafondTaille('11_49', { prise_en_charge_salaires_horaire: null }),
    ]);
    const sal = salaires(opco, '11_49');
    expect(sal.fundedAmount).toBe(0);
    expect(sal.requestedAmount).toBe(0);
    expect(sal.note).toBe('Pas de prise en charge des salaires pour cette taille d\'entreprise');
    expect(sal.details?.some((d) => d.startsWith('Taux propre à votre taille'))).toBe(false);
  });

  it('une taille sans taux propre garde le taux de l\'OPCO', () => {
    const opco = opcoSalairesParTaille([plafondTaille('less_11', { prise_en_charge_salaires_horaire: 15 }), plafondTaille('11_49')]);
    const sal = salaires(opco, '11_49');
    expect(sal.fundedAmount).toBe(1500); // 15 €/h de l'OPCO × 100 h
    expect(sal.details?.some((d) => d.startsWith('Taux propre à votre taille'))).toBe(false);
  });

  it('une taille absente de plafonds_par_taille, une taille inconnue ou aucun plafond : taux de l\'OPCO', () => {
    const seulementTpe = opcoSalairesParTaille([plafondTaille('less_11', { prise_en_charge_salaires_horaire: 10 })]);
    expect(salaires(seulementTpe, '11_49').fundedAmount).toBe(1500); // aucune entrée pour 11-49 : 15 €/h de l'OPCO
    expect(salaires(seulementTpe, null).fundedAmount).toBe(1500); // taille inconnue : aucun plafond ne s'applique
    expect(salaires(opcoSalairesParTaille([]), 'less_11').fundedAmount).toBe(1500);
  });

  it('un taux propre à 0 €/h est un taux (et non l\'absence de prise en charge)', () => {
    const opco = opcoSalairesParTaille([plafondTaille('less_11', { prise_en_charge_salaires_horaire: 0 })]);
    const sal = salaires(opco, 'less_11');
    expect(sal.fundedAmount).toBe(0);
    expect(sal.note).toBe('0 €/h × 100h');
  });

  it('le taux propre à la taille ne concerne que le mode euro_par_heure', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires: { value: 50, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'pourcentage_pedagogique',
      plafonds_par_taille: [plafondTaille('less_11', { prise_en_charge_salaires_horaire: 15 })],
    });
    const sal = calculateFunding(opco, makeFormationState({ companySize: 'less_11', durationHours: 100, pedagogyCostPerHour: 30 }))
      .lines.find((l) => l.poste === 'salaires')!;
    expect(sal.fundedAmount).toBe(1500); // 50 % de 3000 € de coûts pédagogiques, inchangé
  });
});

describe('calculateFunding — plafonds & caps', () => {
  it('applique un plafond par taille d’entreprise', () => {
    const opco = makeOpco({
      plafonds_par_taille: [
        { taille: 'less_11', cout_horaire_max: 25, budget_annuel_max: 1500, quota_horaire_max: null, description: 'TPE' },
      ],
    });
    const state = makeFormationState({ companySize: 'less_11', durationHours: 100, pedagogyCostPerHour: 50 });
    const r = calculateFunding(opco, state);
    const peda = r.lines.find((l) => l.label === 'Coûts pédagogiques')!;
    // 25€/h × 100h = 2500 → ramené au budget annuel 1500
    expect(peda.fundedAmount).toBe(1500);
  });

  it('applique le cap budgétaire annuel global proportionnellement', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires: { value: 12, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      budget_annuel_max: { value: 2000, confidence: 'exact', source_url: 'x' },
    });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 40 });
    const r = calculateFunding(opco, state);
    // péda 4000 + salaire 1200 = 5200 > cap 2000 → total ramené à 2000
    expect(r.totalFunded).toBe(2000);
    expect(r.budgetCapApplied).toBe(true);
  });

  it('avertit une entreprise 300+ quand l’OPCO priorise les TPE/PME', () => {
    const opco = makeOpco({ priorite_tpe_pme: true });
    const state = makeFormationState({ companySize: '300_plus' });
    const r = calculateFunding(opco, state);
    expect(r.warnings.some((w) => w.includes('priorise les TPE/PME'))).toBe(true);
  });
});

describe('calculateFunding — V2.1 : PDC, budget consommé, cumuls', () => {
  it('le type non_certifiante utilise le plafond inter (PDC)', () => {
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' } });
    const state = makeFormationState({ formationType: 'non_certifiante', durationHours: 20, pedagogyCostPerHour: 50 });
    const r = calculateFunding(opco, state);
    const peda = r.lines.find((l) => l.label === 'Coûts pédagogiques')!;
    expect(peda.fundedAmount).toBe(800); // plafonné à 40€/h × 20h
    expect(r.dispositifPrincipal).toContain('Plan de développement des compétences');
  });

  it('déduit le budget déjà consommé du plafond annuel', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      budget_annuel_max: { value: 2000, confidence: 'exact', source_url: 'x' },
    });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 30, budgetDejaConsomme: 1500 });
    const r = calculateFunding(opco, state);
    // 3000 € calculés, plafond restant 2000-1500=500 €
    expect(r.totalFunded).toBe(500);
    expect(r.budgetCapApplied).toBe(true);
    expect(r.budgetDejaConsomme).toBe(1500);
    expect(r.warnings.some((w) => w.includes('déjà consommé'))).toBe(true);
  });

  it('enveloppe épuisée → 0 financé + warning explicite', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      budget_annuel_max: { value: 2000, confidence: 'exact', source_url: 'x' },
    });
    const state = makeFormationState({ budgetDejaConsomme: 2500 });
    const r = calculateFunding(opco, state);
    expect(r.totalFunded).toBe(0);
    expect(r.warnings.some((w) => w.includes('épuisée'))).toBe(true);
  });

  it('filtre les dispositifs par taille et calcule l’enveloppe max potentielle', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      dispositifs_complementaires: [
        {
          id: 'boost', nom: 'Boost', cumul: 'additif',
          montant_max: 750, unite: 'par_dossier', pourcentage_couts: 50,
          description: 'd', conditions: ['c'], demarches: 'm',
          tailles_eligibles: ['less_11', '11_49'], publics: null,
          confidence: 'exact', source_url: 'x',
        },
        {
          id: 'grands-comptes', nom: 'GC', cumul: 'additif',
          montant_max: 5000, unite: 'par_an', pourcentage_couts: null,
          description: 'd', conditions: ['c'], demarches: 'm',
          tailles_eligibles: ['300_plus'], publics: null,
          confidence: 'exact', source_url: 'x',
        },
        {
          id: 'catalogue', nom: 'Catalogue', cumul: 'alternatif',
          montant_max: null, unite: null, pourcentage_couts: 100,
          description: 'd', conditions: ['c'], demarches: 'm',
          tailles_eligibles: null, publics: null,
          confidence: 'exact', source_url: 'x',
        },
      ],
    });
    const state = makeFormationState({ companySize: 'less_11', durationHours: 100, pedagogyCostPerHour: 30 });
    const r = calculateFunding(opco, state);

    // grands-comptes (300_plus) exclu ; boost et catalogue retenus
    expect(r.dispositifsComplementaires.map((d) => d.id).sort()).toEqual(['boost', 'catalogue']);
    // boost : PDC couvre déjà 100 % (30 €/h sous le plafond 40 €/h) → reste 0 → 0 €
    expect(r.dispositifsComplementaires.find((d) => d.id === 'boost')!.montantEstime).toBe(0);
    // l'enveloppe est plafonnée au coût : 3000
    expect(r.enveloppeMaxPotentielle).toBe(3000);
  });

  it('forfait par_heure × durée pour les dispositifs hors budget', () => {
    const opco = makeOpco({
      dispositifs_complementaires: [{
        id: 'transition', nom: 'Transition', cumul: 'hors_budget',
        montant_max: 32, unite: 'par_heure', pourcentage_couts: null,
        description: 'd', conditions: ['c'], demarches: 'm',
        tailles_eligibles: null, publics: null,
        confidence: 'exact', source_url: 'x',
      }],
    });
    const state = makeFormationState({ durationHours: 50 });
    const r = calculateFunding(opco, state);
    expect(r.dispositifsComplementaires[0].montantEstime).toBe(1600); // 32 × 50h
  });

  it('génère des démarches concrètes ordonnées', () => {
    const opco = makeOpco();
    const r = calculateFunding(opco, makeFormationState());
    expect(r.demarches.length).toBeGreaterThanOrEqual(4);
    expect(r.demarches[0]).toContain('cotisations');
    expect(r.demarches.some((d) => d.includes('AVANT'))).toBe(true);
  });
});

describe('calculateFunding — barèmes par branche (variantes)', () => {
  const opcoAvecVariantes = () =>
    makeOpco({
      cout_horaire_inter: { value: 30, confidence: 'depends_on_branche', source_url: 'x' },
      budget_annuel_max: { value: 2500, confidence: 'depends_on_branche', source_url: 'x' },
      variantes_branche: [
        {
          id: 'organismes-de-formation',
          branche_nom: 'Organismes de formation',
          idcc: ['1516'],
          source_url: 'https://example.test/of',
          confidence: 'exact',
          cout_horaire_inter: { value: 60, confidence: 'exact', source_url: 'x' },
          prise_en_charge_salaires: { value: 15, confidence: 'exact', source_url: 'x' },
          prise_en_charge_salaires_mode: 'euro_par_heure',
          budget_annuel_max: { value: 4500, confidence: 'exact', source_url: 'x' },
        },
      ],
    });

  it('applique le barème de branche quand l’IDCC détecté correspond', () => {
    const state = makeFormationState({ detectedIdcc: '1516', durationHours: 100, pedagogyCostPerHour: 50 });
    const r = calculateFunding(opcoAvecVariantes(), state);
    expect(r.brancheAppliquee).toBe('Organismes de formation');
    // Pédagogie 50€/h sous plafond branche 60 → 5000 ; salaire 15€/h × 100h = 1500.
    // Total 6500 > cap branche 4500 → réduit proportionnellement, total = 4500.
    expect(r.totalFunded).toBe(4500);
    expect(r.budgetCapApplied).toBe(true);
    expect(r.budgetCapAmount).toBe(4500); // cap de la BRANCHE, pas le 2500 général
    const sal = r.lines.find((l) => l.label === 'Prise en charge salaires')!;
    expect(sal.requestedAmount).toBe(1500); // 15€/h × 100h (avant cap)
  });

  it('normalise l’IDCC court (padding 4 chiffres)', () => {
    const state = makeFormationState({ detectedIdcc: '1516', durationHours: 10, pedagogyCostPerHour: 10 });
    const r = calculateFunding(opcoAvecVariantes(), { ...state, detectedIdcc: '1516' });
    expect(r.brancheAppliquee).toBe('Organismes de formation');
  });

  it('le choix manuel de branche prime sur l’IDCC détecté', () => {
    const opco = opcoAvecVariantes();
    opco.variantes_branche!.push({
      id: 'autre-branche',
      branche_nom: 'Autre branche',
      idcc: ['9999'],
      source_url: 'x',
      confidence: 'exact',
      budget_annuel_max: { value: 1000, confidence: 'exact', source_url: 'x' },
    });
    const state = makeFormationState({
      detectedIdcc: '1516',
      selectedBrancheId: 'autre-branche',
      durationHours: 100,
      pedagogyCostPerHour: 30,
    });
    const r = calculateFunding(opco, state);
    expect(r.brancheAppliquee).toBe('Autre branche');
    expect(r.totalFunded).toBe(1000); // cap de la branche choisie manuellement
  });

  it('sans correspondance : barème général + warning explicite', () => {
    const state = makeFormationState({ detectedIdcc: '0042', durationHours: 100, pedagogyCostPerHour: 30 });
    const r = calculateFunding(opcoAvecVariantes(), state);
    expect(r.brancheAppliquee).toBeNull();
    expect(r.totalFunded).toBe(2500); // cap général
    expect(r.warnings.some((w) => w.includes('Barème général'))).toBe(true);
  });

  it('le warning de barème général ne cite aucune étape de l\'application', () => {
    // Le texte est affiché par l'app mobile et par le site, dont les étapes n'ont pas les mêmes noms.
    const state = makeFormationState({ detectedIdcc: '0042', durationHours: 100, pedagogyCostPerHour: 30 });
    const r = calculateFunding(opcoAvecVariantes(), state);
    const warning = r.warnings.find((w) => w.includes('Barème général'))!;
    expect(warning).toContain('Sélectionnez votre branche professionnelle ou vérifiez');
    expect(warning).not.toContain('étape');
  });

  it('les champs non surchargés héritent du barème général', () => {
    const opco = opcoAvecVariantes();
    // La variante OF ne surcharge pas frais_restauration
    opco.frais_restauration = { value: 19, confidence: 'exact', source_url: 'x' };
    const state = makeFormationState({
      detectedIdcc: '1516',
      durationHours: 10,
      pedagogyCostPerHour: 10,
      needsMeals: true,
      mealCostPerDay: 25,
      trainingDays: 2,
    });
    const r = calculateFunding(opco, state);
    const repas = r.lines.find((l) => l.label === 'Restauration')!;
    expect(repas.fundedAmount).toBe(38); // 19€ hérité × 2 jours
  });
});

describe('calculateFunding — forfait de frais annexes (%) et variante de branche', () => {
  const LIBELLE_FORFAIT = 'Frais annexes (forfait %)';
  const forfaitVariante = (value: number | null) => ({ value, confidence: 'exact' as const, source_url: 'https://exemple.fr' });
  const opcoForfaitBatiment = (variante: Partial<VarianteBranche> = {}): OpcoData =>
    makeOpco({
      frais_annexes_pourcentage: { value: 8, confidence: 'exact', source_url: 'x' },
      frais_restauration: { value: 20, confidence: 'exact', source_url: 'x' },
      variantes_branche: [
        {
          id: 'travaux-publics',
          branche_nom: 'Travaux publics',
          idcc: ['1702'],
          source_url: 'https://exemple.fr',
          confidence: 'exact',
          frais_annexes_pourcentage: forfaitVariante(null),
          ...variante,
        },
      ],
    });
  const etat = (over: Parameters<typeof makeFormationState>[0] = {}) =>
    makeFormationState({ durationHours: 100, pedagogyCostPerHour: 30, needsMeals: true, mealCostPerDay: 15, trainingDays: 2, ...over });

  it('sans IDCC : le forfait en % de l\'OPCO s\'applique', () => {
    const r = calculateFunding(opcoForfaitBatiment(), etat());
    const forfait = r.lines.filter((l) => l.label === LIBELLE_FORFAIT);
    expect(forfait).toHaveLength(1);
    expect(forfait[0].fundedAmount).toBe(240); // 8 % de 3000 € de coûts pédagogiques
  });

  it('une variante dont le forfait est null ne reçoit pas celui de l\'OPCO : aucune ligne de forfait', () => {
    const r = calculateFunding(opcoForfaitBatiment(), etat({ detectedIdcc: '1702' }));
    expect(r.brancheAppliquee).toBe('Travaux publics');
    expect(r.lines.filter((l) => l.label === LIBELLE_FORFAIT)).toHaveLength(0);
  });

  it('une variante sans forfait en % ne finance plus les frais annexes ligne par ligne : retour au calcul par poste', () => {
    const r = calculateFunding(opcoForfaitBatiment(), etat({ detectedIdcc: '1702' }));
    const repas = r.lines.find((l) => l.poste === 'restauration')!;
    expect(repas.fundedAmount).toBe(30); // forfait repas 20 €/jour, coût déclaré 15 €/jour × 2 jours
    expect(repas.note).not.toContain('forfait frais annexes');
  });

  it('une variante peut remplacer le taux du forfait', () => {
    const r = calculateFunding(opcoForfaitBatiment({ frais_annexes_pourcentage: forfaitVariante(4) }), etat({ detectedIdcc: '1702' }));
    expect(r.lines.find((l) => l.label === LIBELLE_FORFAIT)!.fundedAmount).toBe(120); // 4 % de 3000 €
  });

  it('une variante qui ne dit rien du forfait hérite de celui de l\'OPCO', () => {
    const opco = opcoForfaitBatiment();
    delete opco.variantes_branche![0].frais_annexes_pourcentage;
    const r = calculateFunding(opco, etat({ detectedIdcc: '1702' }));
    expect(r.lines.find((l) => l.label === LIBELLE_FORFAIT)!.fundedAmount).toBe(240);
  });

  it('applyVarianteBranche : le forfait de la variante remplace celui de l\'OPCO sans le muter', () => {
    const opco = opcoForfaitBatiment();
    const fusionne = applyVarianteBranche(opco, opco.variantes_branche![0]);
    expect(fusionne.frais_annexes_pourcentage.value).toBeNull();
    expect(opco.frais_annexes_pourcentage.value).toBe(8);
  });
});

describe('calculateFunding — règle des 50 salariés', () => {
  it('50+ sans enveloppe publiée : PDC mutualisé à 0 € et explication', () => {
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' } });
    const state = makeFormationState({ companySize: '50_299', durationHours: 100, pedagogyCostPerHour: 30, pedagogyCostTotal: 3000 });
    const r = calculateFunding(opco, state);
    const peda = r.lines.find((l) => l.poste === 'pedagogie')!;
    expect(peda.requestedAmount).toBe(3000);
    expect(peda.fundedAmount).toBe(0);
    expect(r.totalFunded).toBe(0);
    expect(r.warnings.some((w) => w.includes('moins de 50 salariés'))).toBe(true);
    expect(r.dispositifPrincipal).toContain('non accessibles');
  });

  it('50+ avec enveloppe publiée : calcul appliqué avec cette enveloppe', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      plafonds_par_taille: [
        { taille: '50_299', cout_horaire_max: null, budget_annuel_max: 1000, quota_horaire_max: null, description: 'Plan conventionnel 50+.' },
      ],
    });
    const state = makeFormationState({ companySize: '50_299', durationHours: 100, pedagogyCostPerHour: 30 });
    const r = calculateFunding(opco, state);
    expect(r.totalFunded).toBe(1000);
    expect(r.warnings.some((w) => w.includes('50 salariés et plus'))).toBe(true);
  });
});

describe('calculateFunding — barème dégressif', () => {
  const seuils = [
    { max_heures: 105, valeur: 65 },
    { max_heures: null, valeur: 15 },
  ];

  it('par tranche : chaque tranche d\'heures à son taux', () => {
    const opco = makeOpco({ cout_horaire_seuils: seuils, cout_horaire_seuils_mode: 'par_tranche' });
    const state = makeFormationState({ durationHours: 140, pedagogyCostPerHour: 40 });
    const r = calculateFunding(opco, state);
    // 105 h × min(40, 65) + 35 h × min(40, 15) = 4200 + 525
    expect(r.lines.find((l) => l.poste === 'pedagogie')!.fundedAmount).toBe(4725);
  });

  it('selon la durée totale : un seul taux', () => {
    const opco = makeOpco({ cout_horaire_seuils: seuils, cout_horaire_seuils_mode: 'selon_duree_totale' });
    const state = makeFormationState({ durationHours: 140, pedagogyCostPerHour: 40 });
    const r = calculateFunding(opco, state);
    // 140 h > 105 h → 15 €/h × 140 h
    expect(r.lines.find((l) => l.poste === 'pedagogie')!.fundedAmount).toBe(2100);
  });

  it('un coût décimal entièrement financé ne produit pas d\'avertissement de reste à charge (bruit d\'arrondi)', () => {
    const opco = makeOpco({
      cout_horaire_seuils: [
        { max_heures: 105, valeur: 65 },
        { max_heures: null, valeur: 50 },
      ],
      cout_horaire_seuils_mode: 'par_tranche',
    });
    // 105 h × 33.33 + 1 h × 33.33 : la somme flottante des tranches diffère de 33.33 × 106 d'environ 5e-13
    const state = makeFormationState({ durationHours: 106, pedagogyCostPerHour: 33.33 });
    const r = calculateFunding(opco, state);
    const peda = r.lines.find((l) => l.poste === 'pedagogie')!;
    expect(peda.fundedAmount).toBe(3532.98);
    expect(peda.remainder).toBe(0);
    expect(r.warnings.some((w) => w.includes('laisse un reste à charge'))).toBe(false);
  });

  it('avertit d\'un vrai reste à charge quand le barème ne finance pas tout', () => {
    const opco = makeOpco({ cout_horaire_seuils: seuils, cout_horaire_seuils_mode: 'par_tranche' });
    const state = makeFormationState({ durationHours: 140, pedagogyCostPerHour: 40 });
    const r = calculateFunding(opco, state);
    // coût 5600 − financé 4725
    expect(r.warnings.some((w) => w.includes('laisse un reste à charge de 875.00 €'))).toBe(true);
  });

  describe('variante de branche et barème dégressif de l\'OPCO', () => {
    const opcoAvecVariante = (variante: Partial<VarianteBranche>): OpcoData =>
      makeOpco({
        cout_horaire_seuils: seuils,
        cout_horaire_seuils_mode: 'par_tranche',
        variantes_branche: [
          { id: 'branche-test', branche_nom: 'Branche test', idcc: ['1234'], source_url: 'x', confidence: 'exact', ...variante },
        ],
      });
    const pedagogieFinancee = (opco: OpcoData, formationType: 'qualification' | 'cqp' = 'qualification') =>
      calculateFunding(
        opco,
        makeFormationState({ detectedIdcc: '1234', formationType, durationHours: 140, pedagogyCostPerHour: 40 }),
      ).lines.find((l) => l.poste === 'pedagogie')!.fundedAmount;

    it('une variante à plafond horaire fixe n\'hérite pas du barème dégressif de l\'OPCO', () => {
      const opco = opcoAvecVariante({ cout_horaire_inter: { value: 20, confidence: 'exact', source_url: 'x' } });
      // plafond fixe de la variante : 140 h × 20 €/h = 2800 (et non 4725 selon le barème dégressif de l'OPCO)
      expect(pedagogieFinancee(opco)).toBe(2800);
    });

    it('une variante à plafond horaire métier n\'hérite pas non plus du barème dégressif', () => {
      const opco = opcoAvecVariante({ cout_horaire_metier: { value: 25, confidence: 'exact', source_url: 'x' } });
      expect(pedagogieFinancee(opco, 'cqp')).toBe(3500); // 140 h × 25 €/h
    });

    it('applyVarianteBranche ne reprend ni les seuils ni leur mode quand la variante fixe un plafond horaire', () => {
      const opco = opcoAvecVariante({ cout_horaire_inter: { value: 20, confidence: 'exact', source_url: 'x' } });
      const fusionne = applyVarianteBranche(opco, opco.variantes_branche![0]);
      expect(fusionne.cout_horaire_seuils).toBeUndefined();
      expect(fusionne.cout_horaire_seuils_mode).toBeUndefined();
      expect(opco.cout_horaire_seuils).toEqual(seuils); // l'OPCO d'origine n'est pas muté
      expect(opco.cout_horaire_seuils_mode).toBe('par_tranche');
    });

    it('une variante sans plafond horaire hérite du barème dégressif de l\'OPCO', () => {
      const opco = opcoAvecVariante({ budget_annuel_max: { value: 100000, confidence: 'exact', source_url: 'x' } });
      expect(pedagogieFinancee(opco)).toBe(4725); // 105 h × 40 + 35 h × 15, comme sans variante
    });

    it('une variante qui publie ses propres seuils utilise ses seuils', () => {
      const opco = opcoAvecVariante({
        cout_horaire_inter: { value: 20, confidence: 'exact', source_url: 'x' },
        cout_horaire_seuils: [{ max_heures: null, valeur: 10 }],
        cout_horaire_seuils_mode: 'par_tranche',
      });
      expect(pedagogieFinancee(opco)).toBe(1400); // 140 h × min(40, 10)
    });
  });
});

describe('calculateFunding — barème dégressif réservé aux formations certifiantes', () => {
  const seuils = [
    { max_heures: 105, valeur: 65 },
    { max_heures: null, valeur: 15 },
  ];
  const BAREME = 7350; // 105 h × 65 + 35 h × 15 (coût demandé 70 €/h, au-dessus des deux plafonds)
  const PLAFOND_HABITUEL = 5600; // 140 h × 40 €/h
  const opcoCertifiant = (over: Partial<OpcoData> = {}): OpcoData =>
    makeOpco({
      cout_horaire_seuils: seuils,
      cout_horaire_seuils_certifiant: true,
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      ...over,
    });
  const calcul = (opco: OpcoData, over: Parameters<typeof makeFormationState>[0] = {}) =>
    calculateFunding(opco, makeFormationState({ durationHours: 140, pedagogyCostPerHour: 70, ...over }));
  const pedagogie = (opco: OpcoData, over: Parameters<typeof makeFormationState>[0] = {}) =>
    calcul(opco, over).lines.find((l) => l.poste === 'pedagogie')!;

  it('formation non certifiante : le plafond horaire habituel s\'applique, pas le barème', () => {
    const peda = pedagogie(opcoCertifiant(), { certificationLevel: 'aucune' });
    expect(peda.fundedAmount).toBe(PLAFOND_HABITUEL);
    expect(peda.note).toBe('Plafond horaire : 40 €/h');
  });

  it('formation certifiante (RNCP) : le barème dégressif s\'applique', () => {
    const peda = pedagogie(opcoCertifiant(), { certificationLevel: 'rncp' });
    expect(peda.fundedAmount).toBe(BAREME);
    expect(peda.note).toBe('Barème dégressif selon la durée');
  });

  it('RS, CQP et diplôme sont des certifications ; habilitation, autre et absence de certification ne le sont pas', () => {
    for (const certificationLevel of ['rncp', 'rs', 'cqp', 'diplome'] as const) {
      expect(pedagogie(opcoCertifiant(), { certificationLevel }).fundedAmount, certificationLevel).toBe(BAREME);
    }
    for (const certificationLevel of ['habilitation', 'autre', 'aucune', null] as const) {
      expect(pedagogie(opcoCertifiant(), { certificationLevel }).fundedAmount, String(certificationLevel)).toBe(PLAFOND_HABITUEL);
    }
  });

  it('un type de formation certification ou CQP suffit, même sans niveau de certification renseigné', () => {
    for (const formationType of ['certification', 'cqp'] as const) {
      expect(pedagogie(opcoCertifiant(), { formationType, certificationLevel: null }).fundedAmount, formationType).toBe(BAREME);
    }
    for (const formationType of ['qualification', 'non_certifiante', 'habilitation', 'vae', 'reconversion'] as const) {
      expect(pedagogie(opcoCertifiant(), { formationType, certificationLevel: null }).fundedAmount, formationType).toBe(PLAFOND_HABITUEL);
    }
  });

  it('sans drapeau (ou à false), le barème s\'applique à toutes les formations', () => {
    expect(pedagogie(opcoCertifiant({ cout_horaire_seuils_certifiant: undefined }), { certificationLevel: 'aucune' }).fundedAmount).toBe(BAREME);
    expect(pedagogie(opcoCertifiant({ cout_horaire_seuils_certifiant: false }), { certificationLevel: 'aucune' }).fundedAmount).toBe(BAREME);
  });

  it('chemin du plafond habituel : le plafond par taille d\'entreprise reste prioritaire', () => {
    const opco = opcoCertifiant({
      plafonds_par_taille: [{ taille: 'less_11', cout_horaire_max: 30, budget_annuel_max: null, quota_horaire_max: null, description: 'TPE' }],
    });
    expect(pedagogie(opco, { companySize: 'less_11', certificationLevel: 'aucune' }).fundedAmount).toBe(4200); // 140 h × 30 €/h
  });

  it('formation non certifiante : l\'avertissement du plafond horaire remplace celui du barème dégressif', () => {
    const r = calcul(opcoCertifiant(), { certificationLevel: 'aucune' });
    expect(r.warnings.some((w) => w.includes('dépasse le plafond Test OPCO (40 €/h)'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('Le barème dégressif'))).toBe(false);
  });

  describe('héritage par les variantes de branche', () => {
    const opcoAvecVariante = (variante: Partial<VarianteBranche>): OpcoData =>
      opcoCertifiant({
        variantes_branche: [{ id: 'branche-test', branche_nom: 'Branche test', idcc: ['1234'], source_url: 'x', confidence: 'exact', ...variante }],
      });
    const pedagogieBranche = (opco: OpcoData, certificationLevel: 'aucune' | 'rncp') =>
      pedagogie(opco, { detectedIdcc: '1234', certificationLevel }).fundedAmount;

    it('une variante qui hérite du barème de l\'OPCO en hérite aussi la restriction aux certifiantes', () => {
      const opco = opcoAvecVariante({ budget_annuel_max: { value: 100000, confidence: 'exact', source_url: 'x' } });
      expect(applyVarianteBranche(opco, opco.variantes_branche![0]).cout_horaire_seuils_certifiant).toBe(true);
      expect(pedagogieBranche(opco, 'aucune')).toBe(PLAFOND_HABITUEL);
      expect(pedagogieBranche(opco, 'rncp')).toBe(BAREME);
    });

    it('une variante à plafond horaire fixe n\'hérite ni du barème ni de la restriction', () => {
      const opco = opcoAvecVariante({ cout_horaire_inter: { value: 20, confidence: 'exact', source_url: 'x' } });
      const fusionne = applyVarianteBranche(opco, opco.variantes_branche![0]);
      expect(fusionne.cout_horaire_seuils).toBeUndefined();
      expect(fusionne.cout_horaire_seuils_certifiant).toBeUndefined();
      expect(opco.cout_horaire_seuils_certifiant).toBe(true); // l'OPCO d'origine n'est pas muté
      expect(pedagogieBranche(opco, 'aucune')).toBe(2800); // 140 h × 20 €/h
      expect(pedagogieBranche(opco, 'rncp')).toBe(2800); // plafond fixe de la branche, jamais le barème de l'OPCO
    });

    it('une variante qui publie ses propres seuils peut préciser qu\'ils valent pour toutes les formations', () => {
      const opco = opcoAvecVariante({
        cout_horaire_inter: { value: 20, confidence: 'exact', source_url: 'x' },
        cout_horaire_seuils: [{ max_heures: null, valeur: 10 }],
        cout_horaire_seuils_certifiant: false,
      });
      expect(pedagogieBranche(opco, 'aucune')).toBe(1400); // 140 h × min(70, 10) : ses seuils, pas ceux de l'OPCO
    });

    it('une variante peut réserver ses propres seuils aux formations certifiantes', () => {
      const opco = opcoAvecVariante({
        cout_horaire_inter: { value: 20, confidence: 'exact', source_url: 'x' },
        cout_horaire_seuils: [{ max_heures: null, valeur: 10 }],
        cout_horaire_seuils_certifiant: true,
      });
      expect(pedagogieBranche(opco, 'aucune')).toBe(2800); // plafond habituel de la branche : 140 h × 20 €/h
      expect(pedagogieBranche(opco, 'rncp')).toBe(1400);
    });
  });
});

describe('calculateFunding — portée du plafond annuel', () => {
  it('portée pédagogie : salaires financés en plus du plafond', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires: { value: 12, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      budget_annuel_max: { value: 2000, confidence: 'exact', source_url: 'x' },
      budget_annuel_portee: 'pedagogie',
    });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 40 });
    const r = calculateFunding(opco, state);
    expect(r.lines.find((l) => l.poste === 'pedagogie')!.fundedAmount).toBe(2000);
    expect(r.lines.find((l) => l.poste === 'salaires')!.fundedAmount).toBe(1200);
    expect(r.totalFunded).toBe(3200);
    expect(r.budgetCapApplied).toBe(true);
  });

  const opcoPlafonne = (portee?: 'global' | 'pedagogie') =>
    makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires: { value: 12, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      budget_annuel_max: { value: 2000, confidence: 'exact', source_url: 'x' },
      budget_annuel_portee: portee,
    });

  it('portée pédagogie : le message de plafond ne dit pas que le total finançable est plafonné', () => {
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 40 });
    const r = calculateFunding(opcoPlafonne('pedagogie'), state);
    expect(r.budgetCapApplied).toBe(true);
    // calcPedagogy annonce déjà que salaires et frais annexes sont financés en plus : pas de message contradictoire
    expect(r.warnings.some((w) => w.includes('Le montant total finançable est plafonné'))).toBe(false);
    expect(r.warnings).toContain('Le plafond budgétaire annuel de Test OPCO a été appliqué aux coûts pédagogiques.');
  });

  it('portée globale (par défaut) : le message de plafond reste inchangé', () => {
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 40 });
    const r = calculateFunding(opcoPlafonne(), state);
    expect(r.budgetCapApplied).toBe(true);
    expect(r.warnings).toContain(
      'Le plafond budgétaire annuel de Test OPCO a été appliqué. Le montant total finançable est plafonné.',
    );
  });
});

describe('calculateFunding — budget annuel à 0 (enveloppe épuisée ou fermée)', () => {
  const MESSAGE_BUDGET_NUL =
    "Aucun budget n'est disponible sur le plan de développement des compétences de Test OPCO pour votre situation (enveloppe épuisée ou fermée). Consultez les autres financements.";
  const budget = (value: number | null) => ({ value, confidence: 'exact' as const, source_url: 'https://exemple.fr' });
  const opcoAvecBudget = (value: number | null, over: Partial<OpcoData> = {}): OpcoData =>
    makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires: { value: 12, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      budget_annuel_max: budget(value),
      ...over,
    });
  const etat = (over: Parameters<typeof makeFormationState>[0] = {}) =>
    makeFormationState({ durationHours: 100, pedagogyCostPerHour: 30, ...over });
  const messagesDePlafondApplique = (warnings: string[]) =>
    warnings.filter((w) => /plafond (budgétaire )?annuel/i.test(w) && w.includes('appliqué'));

  it('portée globale : rien n\'est financé, les montants restent finis et l\'avertissement dédié est affiché', () => {
    const r = calculateFunding(opcoAvecBudget(0), etat());
    expect(r.totalFunded).toBe(0);
    expect(r.totalRequested).toBe(4200); // 3000 € de pédagogie + 1200 € de salaires, toujours demandés
    expect(r.totalRemainder).toBe(4200);
    for (const l of r.lines) {
      expect(Number.isFinite(l.fundedAmount)).toBe(true);
      expect(l.fundedAmount).toBe(0);
    }
    expect(r.warnings).toContain(MESSAGE_BUDGET_NUL);
  });

  it('n\'ajoute pas en plus le message générique de plafond appliqué', () => {
    const r = calculateFunding(opcoAvecBudget(0), etat());
    expect(messagesDePlafondApplique(r.warnings)).toEqual([]);
  });

  it('une variante appliquée par IDCC avec un budget à 0 ferme l\'enveloppe, alors que le barème général finance', () => {
    const opco = opcoAvecBudget(5000, {
      variantes_branche: [
        { id: 'epuisee', branche_nom: 'Branche épuisée', idcc: ['1516'], source_url: 'x', confidence: 'exact', budget_annuel_max: budget(0) },
      ],
    });
    const general = calculateFunding(opco, etat());
    expect(general.totalFunded).toBe(4200);
    expect(general.warnings).not.toContain(MESSAGE_BUDGET_NUL);

    const r = calculateFunding(opco, etat({ detectedIdcc: '1516' }));
    expect(r.brancheAppliquee).toBe('Branche épuisée');
    expect(r.totalFunded).toBe(0);
    expect(r.warnings).toContain(MESSAGE_BUDGET_NUL);
    expect(messagesDePlafondApplique(r.warnings)).toEqual([]);
  });

  it('portée pédagogie : les coûts pédagogiques tombent à 0 (sans division par zéro), les salaires restent financés en plus', () => {
    const r = calculateFunding(opcoAvecBudget(0, { budget_annuel_portee: 'pedagogie' }), etat());
    expect(r.lines.find((l) => l.poste === 'pedagogie')!.fundedAmount).toBe(0);
    expect(r.lines.find((l) => l.poste === 'salaires')!.fundedAmount).toBe(1200);
    expect(Number.isFinite(r.totalFunded)).toBe(true);
    expect(r.totalFunded).toBe(1200);
    expect(r.warnings).toContain(MESSAGE_BUDGET_NUL);
    expect(messagesDePlafondApplique(r.warnings)).toEqual([]);
  });

  it('un plafond par taille à 0 est respecté', () => {
    const opco = opcoAvecBudget(5000, {
      plafonds_par_taille: [
        { taille: 'less_11', cout_horaire_max: null, budget_annuel_max: 0, quota_horaire_max: null, description: 'Enveloppe épuisée' },
      ],
    });
    const r = calculateFunding(opco, etat({ companySize: 'less_11' }));
    expect(r.totalFunded).toBe(0);
    expect(r.warnings).toContain(MESSAGE_BUDGET_NUL);
  });

  it('un budget null reste sans plafond (comportement inchangé)', () => {
    const r = calculateFunding(opcoAvecBudget(null), etat());
    expect(r.totalFunded).toBe(4200);
    expect(r.budgetCapApplied).toBe(false);
    expect(r.warnings).not.toContain(MESSAGE_BUDGET_NUL);
  });

  it('un budget positif entièrement consommé garde son message d\'épuisement, pas le message de budget nul', () => {
    const r = calculateFunding(opcoAvecBudget(2000), etat({ budgetDejaConsomme: 2500 }));
    expect(r.totalFunded).toBe(0);
    expect(r.warnings.some((w) => w.includes('Votre enveloppe annuelle Test OPCO est épuisée'))).toBe(true);
    expect(r.warnings).not.toContain(MESSAGE_BUDGET_NUL);
  });

  it('une enveloppe 50+ à 0 n\'ouvre pas le PDC : la règle des 50 salariés prime, sans message de budget nul', () => {
    const opco = opcoAvecBudget(null, {
      plafonds_par_taille: [
        { taille: '50_299', cout_horaire_max: null, budget_annuel_max: 0, quota_horaire_max: null, description: 'Plan conventionnel 50+.' },
      ],
    });
    const r = calculateFunding(opco, etat({ companySize: '50_299' }));
    expect(r.dispositifPrincipal).toContain('non accessibles');
    expect(r.totalFunded).toBe(0);
    expect(r.warnings.some((w) => w.includes('moins de 50 salariés'))).toBe(true);
    expect(r.warnings).not.toContain(MESSAGE_BUDGET_NUL);
  });
});

describe('calculateFunding — dispositifs complémentaires et enveloppe', () => {
  const boost = {
    id: 'boost', nom: 'Boost', cumul: 'additif' as const,
    montant_max: 750, unite: 'par_dossier' as const, pourcentage_couts: 50,
    description: 'd', conditions: ['c'], demarches: 'm',
    tailles_eligibles: null, publics: null,
    confidence: 'exact' as const, source_url: 'x',
  };

  it('un dispositif en % est calculé sur le reste à financer', () => {
    // Sans plafond en € : seule la base de calcul détermine le montant.
    const sansPlafond = { ...boost, id: 'sans-plafond', montant_max: null, unite: null };
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' }, dispositifs_complementaires: [sansPlafond] });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 60, pedagogyCostTotal: 6000 });
    const r = calculateFunding(opco, state);
    // PDC 4000 (40 €/h × 100 h) ; reste 6000 − 4000 = 2000 → 50 % = 1000 (et non 50 % de 6000 = 3000)
    expect(r.dispositifsComplementaires[0].montantEstime).toBe(1000);
    expect(r.enveloppeMaxPotentielle).toBe(5000); // 4000 + 1000, sous le coût demandé 6000
  });

  it('un dispositif en % est plafonné par son montant maximal', () => {
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' }, dispositifs_complementaires: [boost] });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 60, pedagogyCostTotal: 6000 });
    const r = calculateFunding(opco, state);
    // PDC 4000 ; reste 2000 → 50 % = 1000, plafonné à 750
    expect(r.dispositifsComplementaires[0].montantEstime).toBe(750);
    expect(r.enveloppeMaxPotentielle).toBe(4750);
  });

  it('l\'enveloppe ne dépasse jamais le coût demandé', () => {
    const gros = { ...boost, id: 'gros', pourcentage_couts: null, montant_max: 10000 };
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' }, dispositifs_complementaires: [gros] });
    const state = makeFormationState({ durationHours: 100, pedagogyCostPerHour: 30 });
    const r = calculateFunding(opco, state);
    expect(r.enveloppeMaxPotentielle).toBeLessThanOrEqual(r.totalRequested);
    // coût demandé 3000 (100 h × 30 €/h), déjà financé à 100 % : le forfait de 10 000 € ne rehausse rien
    expect(r.enveloppeMaxPotentielle).toBe(3000);
  });

  it('chaque ligne porte son poste', () => {
    const opco = makeOpco();
    const r = calculateFunding(opco, makeFormationState({ needsMeals: true, mealCostPerDay: 15, trainingDays: 2 }));
    expect(r.lines.map((l) => l.poste)).toEqual(['pedagogie', 'salaires', 'transport', 'hebergement', 'restauration']);
  });
});

describe('calculateFunding — dispositifs réservés à certaines conventions collectives', () => {
  const dispositif = (over: Partial<DispositifComplementaire> = {}): DispositifComplementaire => ({
    id: 'transition-ecologique',
    nom: 'Transition écologique',
    cumul: 'additif',
    montant_max: 1000,
    unite: 'par_dossier',
    pourcentage_couts: null,
    description: 'd',
    conditions: ['c'],
    demarches: 'm',
    tailles_eligibles: null,
    publics: null,
    confidence: 'exact',
    source_url: 'x',
    ...over,
  });
  const opcoAvecDispositif = (d: DispositifComplementaire, over: Partial<OpcoData> = {}): OpcoData =>
    makeOpco({ dispositifs_complementaires: [d], ...over });
  const idsRetenus = (opco: OpcoData, over: Parameters<typeof makeFormationState>[0]) =>
    calculateFunding(opco, makeFormationState(over)).dispositifsComplementaires.map((d) => d.id);
  const opcoTp = () => opcoAvecDispositif(dispositif({ idcc: ['1702'] }));

  it('présent quand l\'IDCC détecté fait partie de ceux du dispositif', () => {
    expect(idsRetenus(opcoTp(), { detectedIdcc: '1702' })).toEqual(['transition-ecologique']);
  });

  it('absent quand l\'IDCC détecté est celui d\'une autre convention', () => {
    expect(idsRetenus(opcoTp(), { detectedIdcc: '1596' })).toEqual([]);
  });

  it('absent quand l\'IDCC de l\'entreprise est inconnu', () => {
    expect(idsRetenus(opcoTp(), { detectedIdcc: null })).toEqual([]);
  });

  it('présent quand un établissement de l\'entreprise relève de la convention', () => {
    expect(idsRetenus(opcoTp(), { detectedIdcc: '1596', idccEtablissements: ['1596', '1702'] })).toEqual(['transition-ecologique']);
  });

  it('présent quand la branche appliquée (choix manuel) couvre l\'IDCC, même sans IDCC détecté', () => {
    const opco = opcoAvecDispositif(dispositif({ idcc: ['1702'] }), {
      variantes_branche: [{ id: 'travaux-publics', branche_nom: 'Travaux publics', idcc: ['1702', '2614'], source_url: 'x', confidence: 'exact' }],
    });
    expect(idsRetenus(opco, { selectedBrancheId: 'travaux-publics', detectedIdcc: null })).toEqual(['transition-ecologique']);
  });

  it('normalise les IDCC sur 4 chiffres avant de comparer', () => {
    const opco = opcoAvecDispositif(dispositif({ idcc: ['0702'] }));
    expect(idsRetenus(opco, { detectedIdcc: '702' })).toEqual(['transition-ecologique']);
    expect(idsRetenus(opco, { detectedIdcc: null, idccEtablissements: ['702'] })).toEqual(['transition-ecologique']);
  });

  it('un dispositif sans IDCC, ou à liste vide, concerne toutes les entreprises', () => {
    expect(idsRetenus(opcoAvecDispositif(dispositif()), { detectedIdcc: null })).toEqual(['transition-ecologique']);
    expect(idsRetenus(opcoAvecDispositif(dispositif({ idcc: [] })), { detectedIdcc: '1596' })).toEqual(['transition-ecologique']);
  });

  it('cumule avec la restriction par taille : les deux conditions doivent être remplies', () => {
    const opco = opcoAvecDispositif(dispositif({ idcc: ['1702'], tailles_eligibles: ['less_11'] }));
    expect(idsRetenus(opco, { detectedIdcc: '1702', companySize: 'less_11' })).toEqual(['transition-ecologique']);
    expect(idsRetenus(opco, { detectedIdcc: '1702', companySize: '11_49' })).toEqual([]); // taille exclue
    expect(idsRetenus(opco, { detectedIdcc: '1596', companySize: 'less_11' })).toEqual([]); // convention exclue
  });

  it('un dispositif écarté ne compte pas dans l\'enveloppe maximale potentielle', () => {
    const r = calculateFunding(opcoTp(), makeFormationState({ detectedIdcc: '1596', pedagogyCostPerHour: 60, pedagogyCostTotal: 6000 }));
    expect(r.enveloppeMaxPotentielle).toBe(r.totalFunded);
  });
});

describe('calculateFunding — alertes publiées par l\'OPCO', () => {
  const alerte = (over: Partial<AlerteOpco> = {}): AlerteOpco => ({
    type: 'fonds_epuises',
    branche: 'Organismes de formation',
    idcc: ['1516'],
    source_url: 'https://exemple.fr/alerte',
    extrait: 'Enveloppe budgétaire intégralement engagée pour 2026',
    verifie_le: '2026-10-05',
    ...over,
  });
  const resultat = (alertes: AlerteOpco[] | undefined, over: Parameters<typeof makeFormationState>[0] = {}) =>
    calculateFunding(makeOpco({ alertes }), makeFormationState(over));
  const avertissementsEpuisement = (warnings: string[]) => warnings.filter((w) => w.includes('est épuisée'));

  it('une alerte de fonds épuisés concerne l\'entreprise de la branche : alerte retournée et avertissement daté', () => {
    const a = alerte();
    const r = resultat([a], { detectedIdcc: '1516' });
    expect(r.alertes).toEqual([a]);
    expect(r.warnings).toContain(
      "Test OPCO signale que l'enveloppe de la branche « Organismes de formation » est épuisée (vérifié le 05/10/2026) : " +
        'la prise en charge sur le plan de développement des compétences peut être refusée.',
    );
  });

  it('l\'avertissement contient « est épuisée (vérifié le 05/10/2026) »', () => {
    const r = resultat([alerte()], { detectedIdcc: '1516' });
    expect(r.warnings.some((w) => w.includes('est épuisée (vérifié le 05/10/2026)'))).toBe(true);
  });

  it('une entreprise d\'une autre branche n\'est pas concernée : ni alerte ni avertissement', () => {
    const r = resultat([alerte()], { detectedIdcc: '1979' });
    expect(r.alertes).toEqual([]);
    expect(avertissementsEpuisement(r.warnings)).toEqual([]);
  });

  it('une entreprise dont la convention est inconnue n\'est pas concernée par une alerte de branche', () => {
    const r = resultat([alerte()], { detectedIdcc: null });
    expect(r.alertes).toEqual([]);
    expect(avertissementsEpuisement(r.warnings)).toEqual([]);
  });

  it('une alerte sans IDCC concerne toutes les entreprises de l\'OPCO, sans avertissement d\'épuisement', () => {
    const a = alerte({ type: 'changement_paiement', branche: 'Toutes branches', idcc: [] });
    for (const idcc of ['1516', '1979', null]) {
      const r = resultat([a], { detectedIdcc: idcc });
      expect(r.alertes).toEqual([a]);
      expect(avertissementsEpuisement(r.warnings)).toEqual([]);
    }
  });

  it('une alerte de fonds épuisés sans IDCC avertit toutes les entreprises de l\'OPCO', () => {
    const r = resultat([alerte({ idcc: [], branche: 'Toutes branches' })], { detectedIdcc: null });
    expect(r.alertes).toHaveLength(1);
    expect(avertissementsEpuisement(r.warnings)).toHaveLength(1);
  });

  it('les autres types d\'alerte sont retournés sans avertissement supplémentaire', () => {
    const types = ['changement_criteres', 'dispositif_termine', 'dispositif_non_confirme', 'acces_restreint', 'evolution_en_cours_annee', 'echeance'] as const;
    const sans = resultat(undefined, { detectedIdcc: '1516' });
    for (const type of types) {
      const r = resultat([alerte({ type })], { detectedIdcc: '1516' });
      expect(r.alertes.map((x) => x.type)).toEqual([type]);
      expect(r.warnings).toEqual(sans.warnings);
    }
  });

  it('retient seulement les alertes qui concernent l\'entreprise, dans l\'ordre de l\'OPCO, un avertissement par fonds épuisés', () => {
    const tp = alerte({ branche: 'Travaux publics', idcc: ['1702'] });
    const of = alerte();
    const gros = alerte({ branche: 'Commerces de gros', idcc: ['0573'], verifie_le: '2026-01-09' });
    const paiement = alerte({ type: 'changement_paiement', branche: 'Toutes branches', idcc: [] });
    const r = resultat([tp, of, gros, paiement], { detectedIdcc: '573' });
    expect(r.alertes).toEqual([gros, paiement]);
    expect(avertissementsEpuisement(r.warnings)).toEqual([
      "Test OPCO signale que l'enveloppe de la branche « Commerces de gros » est épuisée (vérifié le 09/01/2026) : " +
        'la prise en charge sur le plan de développement des compétences peut être refusée.',
    ]);
  });

  it('retient une alerte dont un établissement ou la branche choisie manuellement relève de l\'IDCC', () => {
    const a = alerte();
    expect(resultat([a], { detectedIdcc: '1979', idccEtablissements: ['1979', '1516'] }).alertes).toEqual([a]);

    const opco = makeOpco({
      alertes: [a],
      variantes_branche: [{ id: 'of', branche_nom: 'Organismes de formation', idcc: ['1516'], source_url: 'x', confidence: 'exact' }],
    });
    expect(calculateFunding(opco, makeFormationState({ selectedBrancheId: 'of' })).alertes).toEqual([a]);
  });

  it('sans alertes dans l\'OPCO : liste vide, jamais undefined', () => {
    expect(resultat(undefined).alertes).toEqual([]);
    expect(resultat([]).alertes).toEqual([]);
  });

  it('les alertes restent signalées quand le PDC mutualisé est fermé (50 salariés et plus)', () => {
    const a = alerte({ idcc: [] });
    const r = resultat([a], { companySize: '50_299' });
    expect(r.dispositifPrincipal).toContain('non accessibles');
    expect(r.alertes).toEqual([a]);
  });

  it('le calcul ne modifie pas les alertes de l\'OPCO', () => {
    const alertes = [alerte(), alerte({ type: 'echeance', idcc: [] })];
    const avant = structuredClone(alertes);
    resultat(alertes, { detectedIdcc: '1516' });
    expect(alertes).toEqual(avant);
  });
});

describe('calculateFunding — frais annexes plafonnés au coût déclaré', () => {
  describe('forfait repas', () => {
    const opcoForfaitRepas = () =>
      makeOpco({ frais_restauration: { value: 20, confidence: 'exact', source_url: 'x' } });
    const stateRepas = (mealCostPerDay: number) =>
      makeFormationState({ needsMeals: true, mealCostPerDay, trainingDays: 5 });

    it('forfait supérieur au coût déclaré : financé au coût réel, sans reste négatif', () => {
      const r = calculateFunding(opcoForfaitRepas(), stateRepas(15));
      const repas = r.lines.find((l) => l.poste === 'restauration')!;
      expect(repas.requestedAmount).toBe(75); // 15 €/jour × 5 jours
      expect(repas.fundedAmount).toBe(75); // coût réel, et non le forfait 20 €/jour × 5 jours = 100
      expect(repas.remainder).toBe(0);
      expect(repas.details).toContain('Votre coût (15 €/jour) est inférieur au forfait : prise en charge au coût réel');
      expect(repas.details).toContain('Calcul : 15 €/jour × 5 jours = 75.00 €');
    });

    it('forfait supérieur au coût déclaré : le financé ne dépasse pas le demandé et l\'enveloppe reste cohérente', () => {
      const r = calculateFunding(opcoForfaitRepas(), stateRepas(15));
      expect(r.totalFunded).toBeLessThanOrEqual(r.totalRequested);
      expect(r.totalRemainder).toBe(0);
      expect(r.enveloppeMaxPotentielle).toBeGreaterThanOrEqual(r.totalFunded);
    });

    it('la note courte de la ligne affiche le taux réellement appliqué : le coût réel quand il est sous le forfait', () => {
      const repas = calculateFunding(opcoForfaitRepas(), stateRepas(15)).lines.find((l) => l.poste === 'restauration')!;
      expect(repas.note).toContain('15 €/jour × 5 jours'); // et non « 20 €/jour × 5 jours » à côté de 75 € financés
      expect(repas.note).not.toContain('20 €/jour');
    });

    it('la note courte affiche le forfait quand le coût déclaré le dépasse', () => {
      const repas = calculateFunding(opcoForfaitRepas(), stateRepas(28)).lines.find((l) => l.poste === 'restauration')!;
      expect(repas.fundedAmount).toBe(100); // forfait 20 €/jour × 5 jours
      expect(repas.note).toContain('20 €/jour × 5 jours');
    });
  });

  describe('hébergement', () => {
    const stateHebergement = () =>
      makeFormationState({ needsAccommodation: true, accommodationCostPerNight: 80, accommodationNights: 3 });

    it('plafond publié : financé au plus bas du coût et du plafond', () => {
      const opco = makeOpco({ frais_hebergement: { value: 60, confidence: 'exact', source_url: 'x' } });
      const heb = calculateFunding(opco, stateHebergement()).lines.find((l) => l.poste === 'hebergement')!;
      expect(heb.requestedAmount).toBe(240); // 80 €/nuit × 3 nuits
      expect(heb.fundedAmount).toBe(180); // plafond 60 €/nuit × 3 nuits
      expect(heb.remainder).toBe(60);
    });

    it('plafond non publié (null) : aucun montant compté, à confirmer auprès de l\'OPCO', () => {
      const opco = makeOpco({ frais_hebergement: { value: null, confidence: 'exact', source_url: 'x' } });
      const r = calculateFunding(opco, stateHebergement());
      const heb = r.lines.find((l) => l.poste === 'hebergement')!;
      expect(heb.requestedAmount).toBe(240); // le coût saisi reste le demandé
      expect(heb.fundedAmount).toBe(0); // aucun montant inventé
      expect(heb.remainder).toBe(240);
      expect(heb.confidence).toBe('depends_on_branche');
      expect(heb.details).toContain("Aucun montant n'est compté tant que l'OPCO ne l'a pas confirmé");
      expect(r.totalFunded).toBe(3000); // pédagogie seule : l'hébergement n'ajoute rien
    });

    it('plafond à 0 (hébergement non pris en charge) : aucun montant financé', () => {
      const opco = makeOpco({ frais_hebergement: { value: 0, confidence: 'exact', source_url: 'x' } });
      const r = calculateFunding(opco, stateHebergement());
      const heb = r.lines.find((l) => l.poste === 'hebergement')!;
      expect(heb.requestedAmount).toBe(240);
      expect(heb.fundedAmount).toBe(0);
      expect(heb.remainder).toBe(240);
      expect(heb.confidence).toBe('exact'); // la valeur 0 est publiée par l'OPCO : confiance conservée
      expect(heb.note).toBe('Hébergement non pris en charge par Test OPCO');
      expect(r.totalFunded).toBe(3000);
    });
  });
});

describe('calculateFunding — montants non publiés : jamais comptés comme financés', () => {
  const source = (value: number | null) => ({ value, confidence: 'exact' as const, source_url: 'https://exemple.fr' });
  // Aucun plafond horaire publié nulle part : ni inter, ni intra, ni métier, ni seuils, ni plafond par taille.
  const opcoSansPlafondHoraire = (over: Partial<OpcoData> = {}): OpcoData =>
    makeOpco({
      cout_horaire_inter: source(null),
      cout_horaire_intra: source(null),
      cout_horaire_metier: source(null),
      ...over,
    });
  const etat = (over: Parameters<typeof makeFormationState>[0] = {}) =>
    makeFormationState({ durationHours: 100, pedagogyCostPerHour: 40, ...over });
  const pedagogie = (opco: OpcoData, over: Parameters<typeof makeFormationState>[0] = {}) =>
    calculateFunding(opco, etat(over)).lines.find((l) => l.poste === 'pedagogie')!;

  describe('coûts pédagogiques sans plafond horaire publié', () => {
    it('avec un budget annuel publié (portée globale) : le coût est compté dans la limite du budget', () => {
      const peda = pedagogie(opcoSansPlafondHoraire({ budget_annuel_max: source(3000) }));
      expect(peda.requestedAmount).toBe(4000); // 100 h × 40 €/h
      expect(peda.fundedAmount).toBe(3000); // borné par le budget annuel
      expect(peda.confidence).toBe('depends_on_branche');
      expect(peda.note).toBe(
        "Pas de plafond horaire publié : coûts pédagogiques pris en charge dans la limite du budget annuel, à confirmer auprès de l'OPCO",
      );
    });

    it('avec un budget annuel null : rien n\'est compté, la note et les détails l\'expliquent', () => {
      const peda = pedagogie(opcoSansPlafondHoraire({ budget_annuel_max: source(null) }));
      expect(peda.requestedAmount).toBe(4000);
      expect(peda.fundedAmount).toBe(0);
      expect(peda.remainder).toBe(4000);
      expect(peda.confidence).toBe('depends_on_branche');
      expect(peda.note).toBe("Plafond horaire non publié : prise en charge selon l'accord de branche, à confirmer auprès de l'OPCO");
      expect(peda.details).toContain('Test OPCO ne publie pas de plafond horaire pour cette situation');
      expect(peda.details).toContain("Aucun montant n'est compté tant que l'OPCO ne l'a pas confirmé");
    });

    it('sans budget annuel : le total financé reste à 0 et le reste à charge est complet', () => {
      const r = calculateFunding(opcoSansPlafondHoraire(), etat());
      expect(r.totalFunded).toBe(0);
      expect(r.totalRemainder).toBe(r.totalRequested);
      expect(r.budgetCapApplied).toBe(false);
    });

    it('portée pédagogie : le budget annuel borne les coûts pédagogiques', () => {
      const r = calculateFunding(opcoSansPlafondHoraire({ budget_annuel_max: source(3000), budget_annuel_portee: 'pedagogie' }), etat());
      expect(r.lines.find((l) => l.poste === 'pedagogie')!.fundedAmount).toBe(3000);
      expect(r.budgetCapApplied).toBe(true);
    });

    it('un budget propre à la taille d\'entreprise compte comme budget publié', () => {
      const opco = opcoSansPlafondHoraire({
        plafonds_par_taille: [{ taille: 'less_11', cout_horaire_max: null, budget_annuel_max: 2500, quota_horaire_max: null, description: 'TPE' }],
      });
      expect(pedagogie(opco, { companySize: 'less_11' }).fundedAmount).toBe(2500);
    });

    it('l\'enveloppe publiée d\'une entreprise de 50 salariés et plus compte comme budget publié', () => {
      const opco = opcoSansPlafondHoraire({
        plafonds_par_taille: [{ taille: '50_299', cout_horaire_max: null, budget_annuel_max: 1000, quota_horaire_max: null, description: 'Plan conventionnel 50+.' }],
      });
      expect(pedagogie(opco, { companySize: '50_299' }).fundedAmount).toBe(1000);
    });

    it('un budget déjà entièrement consommé ne laisse rien à financer', () => {
      const peda = pedagogie(opcoSansPlafondHoraire({ budget_annuel_max: source(3000) }), { budgetDejaConsomme: 3000 });
      expect(peda.fundedAmount).toBe(0);
    });

    it('un plafond horaire publié reste prioritaire, avec ou sans budget annuel', () => {
      const opco = opcoSansPlafondHoraire({ cout_horaire_inter: source(30) });
      const peda = pedagogie(opco);
      expect(peda.fundedAmount).toBe(3000); // 100 h × min(40, 30)
      expect(peda.confidence).toBe('exact');
    });
  });

  describe('restauration sans forfait publié', () => {
    const stateRepas = () => makeFormationState({ needsMeals: true, mealCostPerDay: 15, trainingDays: 2 });

    it('le coût déclaré reste affiché comme demandé, sans rien financer', () => {
      const repas = calculateFunding(makeOpco({ frais_restauration: source(null) }), stateRepas()).lines.find((l) => l.poste === 'restauration')!;
      expect(repas.requestedAmount).toBe(30); // 15 €/jour × 2 jours
      expect(repas.fundedAmount).toBe(0);
      expect(repas.remainder).toBe(30);
    });

    it('garde la note, la confiance et les détails d\'un montant selon l\'accord de branche', () => {
      const repas = calculateFunding(makeOpco({ frais_restauration: source(null) }), stateRepas()).lines.find((l) => l.poste === 'restauration')!;
      expect(repas.confidence).toBe('depends_on_branche');
      expect(repas.note).toBe('Montant restauration selon accord de branche');
      expect(repas.details).toEqual(['Test OPCO ne publie pas de forfait restauration fixe', 'Le montant dépend de votre accord de branche']);
    });

    it('comme l\'hébergement : le coût déclaré compte dans le total demandé', () => {
      const r = calculateFunding(makeOpco({ frais_restauration: source(null) }), stateRepas());
      expect(r.totalRequested).toBe(3030); // 3000 € de pédagogie + 30 € de repas
      expect(r.totalFunded).toBe(3000);
    });
  });
});

describe('calculateFunding — plafond horaire des formations certifiantes (CQP, certification, habilitation)', () => {
  const opcoMetier = (metier: number | null): OpcoData =>
    makeOpco({
      cout_horaire_inter: { value: 25, confidence: 'exact', source_url: 'https://exemple.fr/inter' },
      cout_horaire_metier: { value: metier, confidence: 'estimated', source_url: 'https://exemple.fr/metier' },
    });
  const pedagogie = (opco: OpcoData, formationType: WizardState['formationType']) =>
    calculateFunding(opco, makeFormationState({ formationType, durationHours: 10, pedagogyCostPerHour: 60 })).lines.find(
      (l) => l.poste === 'pedagogie',
    )!;

  it.each(['cqp', 'certification', 'habilitation'] as const)(
    '%s : le plafond « métier » de l\'OPCO s\'applique, avec sa confiance et sa source',
    (formationType) => {
      const peda = pedagogie(opcoMetier(15), formationType);
      expect(peda.fundedAmount).toBe(150); // 10 h × 15 €/h
      expect(peda.confidence).toBe('estimated');
      expect(peda.sourceUrl).toBe('https://exemple.fr/metier');
    },
  );

  it.each(['non_certifiante', 'qualification', 'vae', 'reconversion'] as const)(
    '%s : le plafond « inter » s\'applique, pas celui des formations certifiantes',
    (formationType) => {
      const peda = pedagogie(opcoMetier(15), formationType);
      expect(peda.fundedAmount).toBe(250); // 10 h × 25 €/h
      expect(peda.confidence).toBe('exact');
      expect(peda.sourceUrl).toBe('https://exemple.fr/inter');
    },
  );

  it('sans plafond « métier » publié (null), une formation certifiante retombe sur le plafond « inter »', () => {
    const peda = pedagogie(opcoMetier(null), 'cqp');
    expect(peda.fundedAmount).toBe(250);
    expect(peda.confidence).toBe('exact');
    expect(peda.sourceUrl).toBe('https://exemple.fr/inter');
  });
});

describe('calculateFunding — plafond horaire par taille : confiance et source de la valeur', () => {
  const PAGE_CRITERES = 'https://exemple.fr/criteres';
  const SOURCE_PLAFOND = 'https://exemple.fr/branche/plafonds';
  const SOURCE_CHAMP = 'https://exemple.fr/branche/champ-inter';
  const plafondTpe = (over: Partial<PlafondTaille> = {}): PlafondTaille => ({
    taille: 'less_11',
    cout_horaire_max: 50,
    budget_annuel_max: null,
    quota_horaire_max: null,
    description: 'Moins de 11 salariés : 50 €/h',
    ...over,
  });
  const opcoAvecPlafond = (plafond: PlafondTaille): OpcoData =>
    makeOpco({
      url_finance_page: PAGE_CRITERES,
      cout_horaire_inter: { value: 30, confidence: 'depends_on_branche', source_url: SOURCE_CHAMP },
      plafonds_par_taille: [plafond],
    });
  const etatTpe = (over: Partial<WizardState> = {}) =>
    makeFormationState({ companySize: 'less_11', durationHours: 10, pedagogyCostPerHour: 60, ...over });
  const pedagogie = (opco: OpcoData, state: WizardState = etatTpe()) =>
    calculateFunding(opco, state).lines.find((l) => l.poste === 'pedagogie')!;

  it('un plafond de taille sans confiance propre reste « exact » et renvoie à la page de critères (comportement inchangé)', () => {
    const peda = pedagogie(opcoAvecPlafond(plafondTpe()));
    expect(peda.fundedAmount).toBe(500); // 10 h × 50 €/h
    expect(peda.confidence).toBe('exact');
    expect(peda.sourceUrl).toBe(PAGE_CRITERES);
  });

  it('un plafond de taille estimé, avec sa source, les reporte dans la ligne pédagogie', () => {
    const peda = pedagogie(opcoAvecPlafond(plafondTpe({ confidence: 'estimated', source_url: SOURCE_PLAFOND })));
    expect(peda.fundedAmount).toBe(500);
    expect(peda.confidence).toBe('estimated');
    expect(peda.sourceUrl).toBe(SOURCE_PLAFOND);
  });

  it('une confiance sans source garde la page de critères ; une source sans confiance garde « exact »', () => {
    const sansSource = pedagogie(opcoAvecPlafond(plafondTpe({ confidence: 'depends_on_branche' })));
    expect(sansSource.confidence).toBe('depends_on_branche');
    expect(sansSource.sourceUrl).toBe(PAGE_CRITERES);
    const sansConfiance = pedagogie(opcoAvecPlafond(plafondTpe({ source_url: SOURCE_PLAFOND })));
    expect(sansConfiance.confidence).toBe('exact');
    expect(sansConfiance.sourceUrl).toBe(SOURCE_PLAFOND);
  });

  it('un plafond de taille sans valeur horaire laisse la confiance et la source du champ de l\'OPCO', () => {
    const peda = pedagogie(
      opcoAvecPlafond(plafondTpe({ cout_horaire_max: null, confidence: 'estimated', source_url: SOURCE_PLAFOND })),
    );
    expect(peda.fundedAmount).toBe(300); // 10 h × 30 €/h du champ « inter »
    expect(peda.confidence).toBe('depends_on_branche');
    expect(peda.sourceUrl).toBe(SOURCE_CHAMP);
  });

  it('le plafond estimé d\'une variante de branche est celui qui s\'affiche', () => {
    const opco = makeOpco({
      url_finance_page: PAGE_CRITERES,
      variantes_branche: [
        {
          id: 'branche',
          branche_nom: 'Branche',
          idcc: ['1234'],
          source_url: 'https://exemple.fr/branche',
          confidence: 'exact',
          plafonds_par_taille: [plafondTpe({ confidence: 'estimated', source_url: SOURCE_PLAFOND })],
        },
      ],
    });
    const peda = pedagogie(opco, etatTpe({ detectedIdcc: '1234' }));
    expect(peda.fundedAmount).toBe(500);
    expect(peda.confidence).toBe('estimated');
    expect(peda.sourceUrl).toBe(SOURCE_PLAFOND);
  });
});

describe('calculateFunding — forfait de restauration : unité du forfait (repas ou jour)', () => {
  const forfait = { value: 20, confidence: 'exact' as const, source_url: 'x' };
  const opcoRestauration = (over: Partial<OpcoData> = {}): OpcoData => makeOpco({ frais_restauration: forfait, ...over });
  const stateRepas = (mealCostPerDay: number) => makeFormationState({ needsMeals: true, mealCostPerDay, trainingDays: 5 });
  const restauration = (opco: OpcoData, mealCostPerDay: number) =>
    calculateFunding(opco, stateRepas(mealCostPerDay)).lines.find((l) => l.poste === 'restauration')!;

  describe('forfait par repas', () => {
    const opcoParRepas = () => opcoRestauration({ frais_restauration_unite: 'repas' });

    it('coût déclaré supérieur au forfait : financé au forfait, avec des textes « par repas »', () => {
      const repas = restauration(opcoParRepas(), 28);
      expect(repas.requestedAmount).toBe(140); // 28 € × 5 jours
      expect(repas.fundedAmount).toBe(100); // 20 € par repas × 5 jours
      expect(repas.details).toContain('Forfait restauration Test OPCO : 20 € par repas (un repas par jour de formation retenu)');
      expect(repas.details).toContain('Calcul : 20 € par repas × 5 jours = 100.00 €');
      expect(repas.note).toBe('20 € par repas × 5 jours');
    });

    it('coût déclaré inférieur au forfait : financé au coût réel, avec des textes « par repas »', () => {
      const repas = restauration(opcoParRepas(), 15);
      expect(repas.fundedAmount).toBe(75);
      expect(repas.details).toContain('Calcul : 15 € par repas × 5 jours = 75.00 €');
      expect(repas.note).toBe('15 € par repas × 5 jours');
    });

    it('aucun texte du forfait ne parle de « €/jour » quand le coût déclaré dépasse le forfait', () => {
      const repas = restauration(opcoParRepas(), 28);
      expect(repas.note).not.toContain('€/jour');
      expect((repas.details ?? []).length).toBeGreaterThan(0);
      for (const d of repas.details ?? []) expect(d, d).not.toContain('€/jour');
    });
  });

  describe('forfait par jour', () => {
    it.each([['explicite', 'jour' as const], ['par défaut (unité absente)', undefined]])(
      'unité %s : textes « €/jour »',
      (_libelle, unite) => {
        const repas = restauration(opcoRestauration({ frais_restauration_unite: unite }), 28);
        expect(repas.fundedAmount).toBe(100);
        expect(repas.details).toContain('Forfait restauration Test OPCO : 20 €/jour');
        expect(repas.details).toContain('Calcul : 20 €/jour × 5 jours = 100.00 €');
        expect(repas.note).toBe('20 €/jour × 5 jours');
      },
    );
  });

  describe('variante de branche', () => {
    const variante = (over: Partial<VarianteBranche> = {}): VarianteBranche => ({
      id: 'branche',
      branche_nom: 'Branche',
      idcc: ['1234'],
      source_url: 'x',
      confidence: 'exact',
      ...over,
    });
    const etat = (mealCostPerDay: number) => ({ ...stateRepas(mealCostPerDay), detectedIdcc: '1234' });

    it('la variante hérite de l\'unité de l\'OPCO quand elle n\'en déclare pas', () => {
      const opco = opcoRestauration({ frais_restauration_unite: 'repas', variantes_branche: [variante()] });
      const repas = calculateFunding(opco, etat(28)).lines.find((l) => l.poste === 'restauration')!;
      expect(repas.note).toBe('20 € par repas × 5 jours');
    });

    it('la variante peut surcharger l\'unité (et son forfait) : par jour chez l\'OPCO, par repas dans la branche', () => {
      const opco = opcoRestauration({
        frais_restauration_unite: 'jour',
        variantes_branche: [
          variante({ frais_restauration: { value: 25, confidence: 'exact', source_url: 'x' }, frais_restauration_unite: 'repas' }),
        ],
      });
      const repas = calculateFunding(opco, etat(30)).lines.find((l) => l.poste === 'restauration')!;
      expect(repas.fundedAmount).toBe(125);
      expect(repas.note).toBe('25 € par repas × 5 jours');
    });

    it('une variante « par jour » chez un OPCO « par repas » repasse aux textes « €/jour »', () => {
      const opco = opcoRestauration({
        frais_restauration_unite: 'repas',
        variantes_branche: [variante({ frais_restauration_unite: 'jour' })],
      });
      const repas = calculateFunding(opco, etat(28)).lines.find((l) => l.poste === 'restauration')!;
      expect(repas.note).toBe('20 €/jour × 5 jours');
    });

    it('applyVarianteBranche : l\'unité de la variante remplace celle de l\'OPCO, sinon elle est héritée', () => {
      const opco = opcoRestauration({ frais_restauration_unite: 'repas' });
      expect(applyVarianteBranche(opco, variante()).frais_restauration_unite).toBe('repas');
      expect(applyVarianteBranche(opco, variante({ frais_restauration_unite: 'jour' })).frais_restauration_unite).toBe('jour');
      expect(applyVarianteBranche(opcoRestauration(), variante()).frais_restauration_unite).toBeUndefined();
    });
  });
});

describe('calculateFunding — plafond annuel estimé : mention « à confirmer » dans les messages', () => {
  const MENTION = ' (montant estimé : à confirmer auprès de Test OPCO)';
  const opcoPlafonne = (confidence: 'exact' | 'estimated' | 'depends_on_branche', portee?: 'global' | 'pedagogie'): OpcoData =>
    makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires: { value: 12, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      budget_annuel_max: { value: 2000, confidence, source_url: 'x' },
      budget_annuel_portee: portee,
    });
  const etat = () => makeFormationState({ durationHours: 100, pedagogyCostPerHour: 40 });
  const messagesDePlafond = (warnings: string[]) =>
    warnings.filter((w) => w.startsWith('Plafond annuel appliqué') || w.startsWith('Le plafond budgétaire annuel'));

  it('budget estimé, portée pédagogie : les deux messages de plafond se terminent par la mention', () => {
    const r = calculateFunding(opcoPlafonne('estimated', 'pedagogie'), etat());
    expect(r.budgetCapApplied).toBe(true);
    const messages = messagesDePlafond(r.warnings);
    expect(messages).toHaveLength(2); // calcPedagogy (montant) et generateWarnings (plafond appliqué)
    expect(messages.some((m) => m.startsWith('Plafond annuel appliqué aux coûts pédagogiques : 2000.00 €'))).toBe(true);
    expect(messages.some((m) => m.startsWith('Le plafond budgétaire annuel de Test OPCO a été appliqué aux coûts pédagogiques'))).toBe(true);
    for (const m of messages) expect(m.endsWith(MENTION), m).toBe(true);
  });

  it('budget estimé, portée globale : le message de plafond se termine par la mention', () => {
    const r = calculateFunding(opcoPlafonne('estimated'), etat());
    const messages = messagesDePlafond(r.warnings);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toBe(
      'Le plafond budgétaire annuel de Test OPCO a été appliqué. Le montant total finançable est plafonné' + MENTION,
    );
  });

  it('un budget « depends_on_branche » est aussi signalé comme estimé', () => {
    const r = calculateFunding(opcoPlafonne('depends_on_branche'), etat());
    for (const m of messagesDePlafond(r.warnings)) expect(m.endsWith(MENTION), m).toBe(true);
  });

  it.each([undefined, 'pedagogie'] as const)('budget exact (portée %s) : aucune mention d\'estimation', (portee) => {
    const r = calculateFunding(opcoPlafonne('exact', portee), etat());
    expect(messagesDePlafond(r.warnings).length).toBeGreaterThan(0);
    expect(r.warnings.some((w) => w.includes('montant estimé'))).toBe(false);
    for (const m of messagesDePlafond(r.warnings)) expect(m.endsWith('.'), m).toBe(true);
  });

  it('le détail de la ligne pédagogie n\'est pas modifié par la mention', () => {
    const peda = calculateFunding(opcoPlafonne('estimated', 'pedagogie'), etat()).lines.find((l) => l.poste === 'pedagogie')!;
    expect(peda.details?.some((d) => d.includes('montant estimé'))).toBe(false);
  });
});

describe('calculateFunding — déterminisme', () => {
  it('mêmes entrées → mêmes sorties', () => {
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' } });
    const state = makeFormationState();
    expect(calculateFunding(opco, state)).toEqual(calculateFunding(opco, state));
  });
});
