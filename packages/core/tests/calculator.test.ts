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

describe('calculateFunding — déterminisme', () => {
  it('mêmes entrées → mêmes sorties', () => {
    const opco = makeOpco({ cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' } });
    const state = makeFormationState();
    expect(calculateFunding(opco, state)).toEqual(calculateFunding(opco, state));
  });
});
