import { describe, it, expect } from 'vitest';
import { bornesEffectif, dateDeReference, moisDepuisSaisie, profilDepuisWizard, saisieDepuisMois } from '../src/aides/profil';
import { createInitialWizardState } from '../src/types';

describe('bornesEffectif', () => {
  it('effectif exact prioritaire, sinon bornes de la tranche', () => {
    expect(bornesEffectif(8, '50_299')).toEqual({ min: 8, max: 8 });
    expect(bornesEffectif(null, 'less_11')).toEqual({ min: 0, max: 10 });
    expect(bornesEffectif(null, '300_plus')).toEqual({ min: 300, max: null });
    expect(bornesEffectif(null, null)).toEqual({ min: null, max: null });
  });
});

describe('profilDepuisWizard', () => {
  const base = {
    ...createInitialWizardState(),
    projetType: 'alternance' as const,
    regionCode: '32' as const,
    departementCode: '59',
    companySize: '11_49' as const,
    idccEtablissements: ['1979'],
    detectedIdcc: '1979',
    ageBeneficiaire: 19,
    typeAlternance: 'apprentissage' as const,
    durationHours: 70,
    pedagogyCostTotal: 2100,
    needsAccommodation: true,
    accommodationNights: 2,
    accommodationCostPerNight: 80,
    needsMeals: true,
    mealCostPerDay: 15,
  };

  it('dérive statut, contrat, effectif et frais annexes', () => {
    const p = profilDepuisWizard(base, 'akto');
    expect(p).toMatchObject({
      projet: 'alternance',
      statutBeneficiaire: 'alternant',
      contrat: 'alternance',
      regionEntreprise: '32',
      effectifMin: 11,
      effectifMax: 49,
      opco: 'akto',
      idccs: ['1979'],
      age: 19,
      coutPedagogique: 2100,
      coutFraisAnnexes: 310, // 2 nuits × 80 € + 10 jours × 15 € (70 h / 7)
    });
  });

  it('statuts de la structure inconnus sans recherche entreprise', () => {
    expect(profilDepuisWizard(base, 'akto').structures).toBeNull();
    expect(profilDepuisWizard({ ...base, sirenNumber: '123456789', structures: ['ess'] }, 'akto').structures).toEqual(['ess']);
  });

  it('projet par défaut : former un salarié', () => {
    const p = profilDepuisWizard(createInitialWizardState(), null);
    expect(p.projet).toBe('formation_salarie');
    expect(p.statutBeneficiaire).toBe('salarie');
  });
});

describe('dates', () => {
  it('convertit la saisie MM/AAAA', () => {
    expect(moisDepuisSaisie('3/2027')).toBe('2027-03');
    expect(moisDepuisSaisie('13/2027')).toBeNull();
    expect(moisDepuisSaisie('2027-03')).toBeNull();
    expect(saisieDepuisMois('2027-03')).toBe('03/2027');
    expect(saisieDepuisMois(null)).toBe('');
  });

  it('date de référence : début de formation futur, sinon aujourd\'hui', () => {
    expect(dateDeReference('2027-03', '2026-10-05')).toBe('2027-03-01');
    expect(dateDeReference('2026-01', '2026-10-05')).toBe('2026-10-05');
    expect(dateDeReference(null, '2026-10-05')).toBe('2026-10-05');
  });
});
