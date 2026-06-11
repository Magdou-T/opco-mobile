import { describe, it, expect } from 'vitest';
import { calculateFunding } from '../src/calculator';
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

  it('marque depends_on_branche quand aucun plafond horaire connu', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: null, confidence: 'depends_on_branche', source_url: 'x' },
      cout_horaire_metier: { value: null, confidence: 'depends_on_branche', source_url: 'x' },
    });
    const state = makeFormationState({ durationHours: 50, pedagogyCostPerHour: 25 });
    const r = calculateFunding(opco, state);
    const peda = r.lines.find((l) => l.label === 'Coûts pédagogiques')!;
    expect(peda.confidence).toBe('depends_on_branche');
    expect(peda.fundedAmount).toBe(1250); // utilise le coût utilisateur faute de plafond
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
    // boost : 50% de 3000 = 1500, plafonné à 750
    expect(r.dispositifsComplementaires.find((d) => d.id === 'boost')!.montantEstime).toBe(750);
    // alternatif non additionné : enveloppe = 3000 (PDC) + 750 (boost)
    expect(r.enveloppeMaxPotentielle).toBe(3750);
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

describe('calculateFunding — déterminisme', () => {
  it('mêmes entrées → mêmes sorties', () => {
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' } });
    const state = makeFormationState();
    expect(calculateFunding(opco, state)).toEqual(calculateFunding(opco, state));
  });
});
