import { describe, it, expect } from 'vitest';
import { bornesEffectif, dateDeReference, moisDepuisSaisie, profilDepuisWizard, saisieDepuisMois } from '../src/aides/profil';
import { createInitialWizardState, TRAINING_TYPE_LABELS, type TrainingType, type WizardState } from '../src/types';

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

describe('bornesEffectif : limites', () => {
  it('un effectif de 0 est connu et prime sur la tranche', () => {
    expect(bornesEffectif(0, '11_49')).toEqual({ min: 0, max: 0 });
  });

  it('un effectif négatif est ignoré : bornes de la tranche', () => {
    expect(bornesEffectif(-1, '11_49')).toEqual({ min: 11, max: 49 });
  });

  it('bornes de la tranche 50 à 299', () => {
    expect(bornesEffectif(null, '50_299')).toEqual({ min: 50, max: 299 });
  });

  it('300 salariés et plus : pas de borne haute dans le profil', () => {
    const p = profilDepuisWizard({ ...createInitialWizardState(), companySize: '300_plus' }, null);
    expect(p).toMatchObject({ effectifMin: 300, effectifMax: null });
  });
});

describe('profilDepuisWizard : une information inconnue reste inconnue', () => {
  it('parcours vierge : aucun champ ne reçoit de valeur par défaut', () => {
    expect(profilDepuisWizard(createInitialWizardState(), null)).toEqual({
      projet: 'formation_salarie',
      statutBeneficiaire: 'salarie',
      regionEntreprise: null,
      departementEntreprise: null,
      regionBeneficiaire: null,
      effectifMin: null,
      effectifMax: null,
      codeNaf: null,
      idccs: [],
      opco: null,
      structures: null,
      age: null,
      rqth: false,
      niveauDiplome: null,
      contrat: null,
      typeAlternance: null,
      ancienneteMois: null,
      inscritFranceTravail: null,
      statutDirigeant: null,
      microEntrepreneur: null,
      certification: null,
      typeFormation: null,
      niveauFormationVise: null,
      eligibleCpf: null,
      dureeHeures: null,
      coutPedagogique: null,
      coutFraisAnnexes: 0,
      qualiopi: null,
      soldeCpf: null,
    });
  });
});

describe('profilDepuisWizard : recopie du parcours', () => {
  const complet: WizardState = {
    ...createInitialWizardState(),
    projetType: 'alternance',
    regionCode: '84',
    departementCode: '69',
    regionBeneficiaireCode: '11',
    effectif: 25,
    companySize: '50_299',
    codeNaf: '86.21Z',
    idccEtablissements: ['1516'],
    detectedIdcc: '1979',
    sirenNumber: '123456789',
    structures: ['ess', 'association'],
    ageBeneficiaire: 42,
    isHandicap: true,
    niveauDiplome: 'bac',
    contractType: 'cdd',
    typeAlternance: 'professionnalisation',
    anciennete_mois: 18,
    inscritFranceTravail: true,
    statutDirigeant: 'artisan',
    microEntrepreneur: false,
    certificationLevel: 'rncp',
    formationType: 'vae',
    niveauFormationVise: 5,
    eligibleCpf: true,
    organismeQualiopi: false,
    durationHours: 35,
    pedagogyCostTotal: 1500,
    soldeCpf: 800,
  };

  it('chaque donnée arrive dans le bon champ', () => {
    expect(profilDepuisWizard(complet, 'atlas')).toEqual({
      projet: 'alternance',
      statutBeneficiaire: 'alternant',
      regionEntreprise: '84',
      departementEntreprise: '69',
      regionBeneficiaire: '11',
      effectifMin: 25,
      effectifMax: 25,
      codeNaf: '86.21Z',
      idccs: ['1516', '1979'],
      opco: 'atlas',
      structures: ['ess', 'association'],
      age: 42,
      rqth: true,
      niveauDiplome: 'bac',
      contrat: 'alternance',
      typeAlternance: 'professionnalisation',
      ancienneteMois: 18,
      inscritFranceTravail: true,
      statutDirigeant: 'artisan',
      microEntrepreneur: false,
      certification: 'rncp',
      typeFormation: 'vae',
      niveauFormationVise: 5,
      eligibleCpf: true,
      dureeHeures: 35,
      coutPedagogique: 1500,
      coutFraisAnnexes: 0,
      qualiopi: false,
      soldeCpf: 800,
    });
  });

  it('contrat : celui du parcours hors alternance', () => {
    expect(profilDepuisWizard({ ...complet, projetType: 'formation_salarie' }, null).contrat).toBe('cdd');
  });

  it('codes de région inconnus : région inconnue', () => {
    const p = profilDepuisWizard({ ...complet, regionCode: '99' as never, regionBeneficiaireCode: 'XX' as never }, null);
    expect(p.regionEntreprise).toBeNull();
    expect(p.regionBeneficiaire).toBeNull();
  });
});

describe('profilDepuisWizard : type de formation', () => {
  const TYPES = Object.keys(TRAINING_TYPE_LABELS) as TrainingType[];
  const profil = (over: Partial<WizardState>) => profilDepuisWizard({ ...createInitialWizardState(), ...over }, null);

  it.each(TYPES)('le type %s du parcours arrive tel quel dans le profil', (formationType) => {
    expect(profil({ formationType }).typeFormation).toBe(formationType);
  });

  it("un type inconnu reste null (jamais une valeur par défaut), qu'il soit nul ou jamais renseigné", () => {
    expect(profil({ formationType: null }).typeFormation).toBeNull();
    expect(profil({}).typeFormation).toBeNull();
  });

  it('le type de formation et la certification visée sont deux champs distincts du parcours', () => {
    expect(profil({ formationType: 'cqp', certificationLevel: 'rncp' })).toMatchObject({ typeFormation: 'cqp', certification: 'rncp' });
    expect(profil({ formationType: null, certificationLevel: 'rncp' })).toMatchObject({ typeFormation: null, certification: 'rncp' });
    expect(profil({ formationType: 'vae', certificationLevel: null })).toMatchObject({ typeFormation: 'vae', certification: null });
  });

  it("ne dépend ni du projet ni de l'OPCO", () => {
    const parcours = { ...createInitialWizardState(), formationType: 'habilitation' as const };
    for (const projetType of ['formation_salarie', 'reconversion_salarie', 'recrutement_demandeur_emploi', 'alternance', 'formation_dirigeant'] as const) {
      expect(profilDepuisWizard({ ...parcours, projetType }, 'akto').typeFormation).toBe('habilitation');
    }
    expect(profilDepuisWizard(parcours, null).typeFormation).toBe('habilitation');
  });
});

describe('profilDepuisWizard : frais annexes', () => {
  const frais = (over: Partial<WizardState>) => profilDepuisWizard({ ...createInitialWizardState(), ...over }, null).coutFraisAnnexes;

  it('jours de formation saisis : prioritaires sur l\'estimation à 7 h par jour', () => {
    expect(frais({ needsMeals: true, mealCostPerDay: 10, durationHours: 70, trainingDays: 3 })).toBe(30);
  });

  it('jours estimés arrondis au supérieur', () => {
    expect(frais({ needsMeals: true, mealCostPerDay: 10, durationHours: 15 })).toBe(30);
  });

  it('postes non demandés ou sans montant : 0', () => {
    expect(frais({ needsAccommodation: false, accommodationNights: 2, accommodationCostPerNight: 80 })).toBe(0);
    expect(frais({ needsMeals: false, mealCostPerDay: 10, durationHours: 70 })).toBe(0);
    expect(frais({ needsMeals: true, mealCostPerDay: null, durationHours: 70 })).toBe(0);
  });

  it('arrondi au centime', () => {
    expect(frais({ needsAccommodation: true, accommodationNights: 3, accommodationCostPerNight: 0.1 })).toBe(0.3);
  });
});

describe('profilDepuisWizard : IDCC', () => {
  it('réunit les IDCC des établissements et celui qui a été détecté', () => {
    const p = profilDepuisWizard({ ...createInitialWizardState(), idccEtablissements: ['1516'], detectedIdcc: '1979' }, null);
    expect(p.idccs).toEqual(['1516', '1979']);
  });
});

describe('dates : limites', () => {
  it('MM/AAAA : décembre accepté, mois 0 refusé, espaces tolérés, texte parasite refusé', () => {
    expect(moisDepuisSaisie('12/2027')).toBe('2027-12');
    expect(moisDepuisSaisie('0/2027')).toBeNull();
    expect(moisDepuisSaisie('00/2027')).toBeNull();
    expect(moisDepuisSaisie(' 3/2027 ')).toBe('2027-03');
    expect(moisDepuisSaisie('x3/2027')).toBeNull();
    expect(moisDepuisSaisie('3/2027x')).toBeNull();
    expect(moisDepuisSaisie('3/27')).toBeNull();
    expect(moisDepuisSaisie('')).toBeNull();
  });

  it('début de formation ce mois-ci : aujourd\'hui', () => {
    expect(dateDeReference('2026-10', '2026-10-05')).toBe('2026-10-05');
  });

  it('saisie vide', () => {
    expect(saisieDepuisMois('')).toBe('');
  });
});

describe('saisieDepuisMois : seule la forme AAAA-MM est convertie', () => {
  it.each([
    '2027', // année seule
    'abc',
    '03/2027', // format de la saisie, pas celui du mois stocké
    '2027/03', // autre séparateur
    '2027-3', // mois sur un chiffre
    '2027-033', // mois sur trois chiffres
    '27-03', // année sur deux chiffres
    '12027-03', // année sur cinq chiffres
    '2027-03-01', // date complète
    'x2027-03', // texte avant la date
    '',
  ])('valeur %j : saisie vide', (valeur) => {
    expect(saisieDepuisMois(valeur)).toBe('');
  });
});

describe('dateDeReference : début de formation mal formé', () => {
  it.each([
    'abc',
    '2027/12', // autre séparateur
    '2027-3', // mois sur un chiffre
    '2027-13', // mois hors de 01 à 12
    '2027-00',
    '27-12', // année sur deux chiffres
    '20271-12', // année sur cinq chiffres
    '2027-12-01', // date complète
    'x2027-12', // texte avant la date
    '',
  ])('début %j ignoré : date du jour', (debut) => {
    expect(dateDeReference(debut, '2026-10-05')).toBe('2026-10-05');
  });

  it('les douze mois de 01 à 12 sont valides : premier jour du mois', () => {
    for (let m = 1; m <= 12; m++) {
      const mois = String(m).padStart(2, '0');
      expect(dateDeReference(`2027-${mois}`, '2026-10-05')).toBe(`2027-${mois}-01`);
    }
  });
});

describe('bornesEffectif : copie et tranche inconnue', () => {
  it('renvoie une copie : modifier le résultat ne change pas les appels suivants', () => {
    const premier = bornesEffectif(null, '11_49');
    premier.min = 999;
    expect(bornesEffectif(null, '11_49')).toEqual({ min: 11, max: 49 });
  });

  it('une tranche inconnue (valeur périmée du stockage) est traitée comme absente', () => {
    expect(bornesEffectif(null, 'inconnue' as never)).toEqual({ min: null, max: null });
  });

  it('un nom hérité d\'Object n\'est pas une tranche : traité comme absent', () => {
    expect(bornesEffectif(null, 'constructor' as never)).toEqual({ min: null, max: null });
    expect(bornesEffectif(null, 'toString' as never)).toEqual({ min: null, max: null });
  });
});

describe('profilDepuisWizard : tranche périmée et tableaux copiés', () => {
  it('une tranche d\'effectif périmée ne fait pas échouer le profil : effectif inconnu', () => {
    const p = profilDepuisWizard({ ...createInitialWizardState(), companySize: 'inconnue' as never }, null);
    expect(p).toMatchObject({ effectifMin: null, effectifMax: null });
  });

  it('structures : le profil en reçoit une copie', () => {
    const parcours: WizardState = { ...createInitialWizardState(), sirenNumber: '123456789', structures: ['ess'] };
    const p = profilDepuisWizard(parcours, null);
    p.structures?.push('siae');
    expect(parcours.structures).toEqual(['ess']);
  });

  it('idccs : le profil en reçoit une copie, l\'IDCC détecté n\'est pas ajouté au parcours', () => {
    const parcours: WizardState = { ...createInitialWizardState(), idccEtablissements: ['1516'], detectedIdcc: '1979' };
    const p = profilDepuisWizard(parcours, null);
    p.idccs.push('9999');
    expect(parcours.idccEtablissements).toEqual(['1516']);
  });
});
