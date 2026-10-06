import { describe, it, expect } from 'vitest';
import { calculateFunding, applyVarianteBranche } from '../src/calculator';
import type { OpcoData, VarianteBranche } from '../src/types';
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

describe('calculateFunding — déterminisme', () => {
  it('mêmes entrées → mêmes sorties', () => {
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' } });
    const state = makeFormationState();
    expect(calculateFunding(opco, state)).toEqual(calculateFunding(opco, state));
  });
});
