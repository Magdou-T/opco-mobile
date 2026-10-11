import { describe, expect, it } from 'vitest';
import { ID_PROFIL_PRINCIPAL, champsDuProfilPrincipal, etatDuProfil, nombreDePersonnes, profilsDuGroupe } from '../src/groupe';
import { MAX_PERSONNES, MAX_PROFILS, createInitialWizardState } from '../src/types';
import type { ProfilSupplementaire, WizardState } from '../src/types';

describe('état initial d’un groupe', () => {
  it('une personne, aucun profil supplémentaire, prix saisi par personne', () => {
    const etat = createInitialWizardState();
    expect(etat.nombrePersonnes).toBe(1);
    expect(etat.autresProfils).toEqual([]);
    expect(etat.prixDuGroupe).toBeNull();
  });

  it('limites du groupe : 6 profils et 99 personnes', () => {
    expect(MAX_PROFILS).toBe(6);
    expect(MAX_PERSONNES).toBe(99);
  });

  it('chaque état initial a son propre tableau de profils (aucun partage entre deux simulations)', () => {
    const a = createInitialWizardState();
    const b = createInitialWizardState();
    expect(a.autresProfils).not.toBe(b.autresProfils);
  });

  it('un état enregistré avant l’évolution reste valide une fois fusionné sur l’état initial (app mobile)', () => {
    const ancien: Partial<WizardState> = { projetType: 'formation_salarie', ageBeneficiaire: 40, soldeCpf: 800 };
    const etat = { ...createInitialWizardState(), ...ancien };
    expect(etat.nombrePersonnes).toBe(1);
    expect(etat.autresProfils).toEqual([]);
    expect(etat.ageBeneficiaire).toBe(40);
  });
});

/** Profil supplémentaire de test : un dirigeant artisan de 52 ans reconnu travailleur handicapé, deux personnes. */
const supplementaire = (over: Partial<ProfilSupplementaire> = {}): ProfilSupplementaire => ({
  id: 'profil-2',
  nombre: 2,
  projetType: 'formation_dirigeant',
  contractType: null,
  anciennete_mois: null,
  isHandicap: true,
  ageBeneficiaire: 52,
  niveauDiplome: 'bac',
  typeAlternance: null,
  inscritFranceTravail: null,
  statutDirigeant: 'artisan',
  microEntrepreneur: false,
  soldeCpf: 900,
  regionBeneficiaireCode: null,
  ...over,
});

/** Groupe de test : trois salariés en CDI de 35 ans (profil principal) et le profil supplémentaire ci-dessus. */
const groupe = (over: Partial<WizardState> = {}): WizardState => ({
  ...createInitialWizardState(),
  projetType: 'formation_salarie',
  contractType: 'cdi',
  ageBeneficiaire: 35,
  regionCode: '11',
  durationHours: 35,
  nombrePersonnes: 3,
  autresProfils: [supplementaire()],
  ...over,
});

const CHAMPS_D_UN_PROFIL = [
  'ageBeneficiaire',
  'anciennete_mois',
  'contractType',
  'inscritFranceTravail',
  'isHandicap',
  'microEntrepreneur',
  'niveauDiplome',
  'projetType',
  'regionBeneficiaireCode',
  'soldeCpf',
  'statutDirigeant',
  'typeAlternance',
];

describe('profils du groupe', () => {
  it('le profil principal vient d’abord, avec les champs de l’étape Participants', () => {
    const [principal, second] = profilsDuGroupe(groupe());
    expect(principal).toMatchObject({ id: ID_PROFIL_PRINCIPAL, nombre: 3, principal: true });
    expect(principal.champs).toMatchObject({ projetType: 'formation_salarie', contractType: 'cdi', ageBeneficiaire: 35 });
    expect(second).toMatchObject({ id: 'profil-2', nombre: 2, principal: false });
    expect(second.champs).toMatchObject({ projetType: 'formation_dirigeant', statutDirigeant: 'artisan', isHandicap: true });
  });

  it('les champs d’un profil sont exactement les douze réponses de l’étape (ni identifiant, ni effectif)', () => {
    const [principal, second] = profilsDuGroupe(groupe());
    expect(Object.keys(champsDuProfilPrincipal(groupe())).sort()).toEqual(CHAMPS_D_UN_PROFIL);
    expect(Object.keys(principal.champs).sort()).toEqual(CHAMPS_D_UN_PROFIL);
    expect(Object.keys(second.champs).sort()).toEqual(CHAMPS_D_UN_PROFIL);
  });

  it('un état sans profil supplémentaire (état ancien, tableau absent) compte un seul profil', () => {
    const ancien = { ...groupe(), autresProfils: undefined } as unknown as WizardState;
    expect(profilsDuGroupe(ancien)).toHaveLength(1);
    expect(nombreDePersonnes(ancien)).toBe(3);
  });

  it('le nombre de personnes est la somme des effectifs', () => {
    expect(nombreDePersonnes(groupe())).toBe(5);
    expect(nombreDePersonnes(createInitialWizardState())).toBe(1);
  });

  it('le total ignore les effectifs invalides : chacun est ramené à un entier de 1 à 99 avant d’être additionné', () => {
    const invalides = groupe({
      nombrePersonnes: Number.NaN,
      autresProfils: [supplementaire({ nombre: 0 }), supplementaire({ id: 'profil-3', nombre: 3.7 })],
    });
    expect(nombreDePersonnes(invalides)).toBe(5); // 1 + 1 + 3
    expect(nombreDePersonnes({ ...invalides, nombrePersonnes: undefined as unknown as number })).toBe(5);
  });

  it('le profil principal reprend chacune des douze réponses de l’état, chacune à sa place', () => {
    const reponses = {
      projetType: 'alternance',
      contractType: 'alternance',
      anciennete_mois: 7,
      isHandicap: true,
      ageBeneficiaire: 19,
      niveauDiplome: 'bac',
      typeAlternance: 'apprentissage',
      inscritFranceTravail: false,
      statutDirigeant: 'commercant',
      microEntrepreneur: true,
      soldeCpf: 321,
      regionBeneficiaireCode: '84',
    } as const;
    expect(champsDuProfilPrincipal(groupe({ ...reponses, regionCode: '11', autresProfils: [] }))).toEqual(reponses);
  });

  it('un effectif invalide est ramené à un entier de 1 à 99', () => {
    const valeurs: [number, number][] = [
      [0, 1],
      [-2, 1],
      [3.7, 3],
      [Number.NaN, 1],
      [150, MAX_PERSONNES],
      [Number.POSITIVE_INFINITY, 1],
    ];
    for (const [saisi, attendu] of valeurs) {
      expect(profilsDuGroupe(groupe({ nombrePersonnes: saisi, autresProfils: [] }))[0].nombre, `principal ${saisi}`).toBe(attendu);
      expect(profilsDuGroupe(groupe({ autresProfils: [supplementaire({ nombre: saisi })] }))[1].nombre, `second ${saisi}`).toBe(attendu);
    }
    expect(MAX_PROFILS).toBe(6);
  });
});

describe('état d’une personne d’un profil', () => {
  it('reprend l’entreprise, la formation et les frais, et remplace les réponses du bénéficiaire par celles du profil', () => {
    const etat = groupe({ prixDuGroupe: 4200 });
    const [, second] = profilsDuGroupe(etat);
    const une = etatDuProfil(etat, second);
    expect(une).toMatchObject({
      regionCode: '11',
      durationHours: 35,
      projetType: 'formation_dirigeant',
      statutDirigeant: 'artisan',
      ageBeneficiaire: 52,
      isHandicap: true,
      soldeCpf: 900,
      contractType: null,
    });
    expect(une.nombrePersonnes).toBe(1);
    expect(une.autresProfils).toEqual([]);
    expect(une.prixDuGroupe).toBeNull();
    expect(champsDuProfilPrincipal(une)).toEqual(second.champs);
  });

  it('le profil principal passe aussi par là : même état, réduit à une personne sans groupe ni prix de groupe', () => {
    const etat = groupe({ prixDuGroupe: 4200 });
    const [principal] = profilsDuGroupe(etat);
    expect(etatDuProfil(etat, principal)).toEqual({ ...etat, nombrePersonnes: 1, autresProfils: [], prixDuGroupe: null });
  });

  it('ne modifie pas l’état reçu', () => {
    const etat = groupe();
    const avant = JSON.stringify(etat);
    etatDuProfil(etat, profilsDuGroupe(etat)[1]);
    expect(JSON.stringify(etat)).toBe(avant);
  });
});
