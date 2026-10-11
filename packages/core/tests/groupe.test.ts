import { describe, expect, it } from 'vitest';
import { calculateFunding } from '../src/calculator';
import {
  ID_PROFIL_PRINCIPAL,
  champsDuProfilPrincipal,
  etatDuProfil,
  nombreDePersonnes,
  profilsDuGroupe,
  repartirCentimes,
  repartirFinancement,
} from '../src/groupe';
import { MAX_PERSONNES, MAX_PROFILS, createInitialWizardState } from '../src/types';
import type { ProfilSupplementaire, WizardState } from '../src/types';
import { etatGroupe, opcoGroupe, sourced } from './fixtures';

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

describe('répartition en centimes', () => {
  it('chaque part reçoit sa fraction entière, les centimes restants vont aux plus grandes parts décimales', () => {
    expect(repartirCentimes(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(repartirCentimes(100, [3, 1])).toEqual([75, 25]);
    expect(repartirCentimes(1, [1, 1])).toEqual([1, 0]);
    expect(repartirCentimes(10, [2, 3])).toEqual([4, 6]);
  });

  it('un total nul, des effectifs vides ou une somme nulle donnent des parts nulles', () => {
    expect(repartirCentimes(0, [2, 3])).toEqual([0, 0]);
    expect(repartirCentimes(500, [])).toEqual([]);
    expect(repartirCentimes(500, [0, 0])).toEqual([0, 0]);
  });

  it('1 000 répartitions tirées (graine fixe) : la somme des parts égale toujours le total, chaque part est un entier non négatif', () => {
    let graine = 12345;
    const hasard = (n: number) => {
      graine = (Math.imul(graine, 1103515245) + 12345) & 0x7fffffff;
      return graine % n;
    };
    for (let i = 0; i < 1000; i++) {
      const total = hasard(5_000_000);
      const effectifs = Array.from({ length: 1 + hasard(6) }, () => 1 + hasard(99));
      const parts = repartirCentimes(total, effectifs);
      expect(
        parts.reduce((s, p) => s + p, 0),
        `${total} ${effectifs}`,
      ).toBe(total);
      expect(parts.every((p) => Number.isInteger(p) && p >= 0)).toBe(true);
    }
  });
});

describe('répartition du résultat de l’OPCO entre profils', () => {
  // 5 personnes : 5 × 5 825 € = 29 125 €, ramenés à 20 000 € par le plafond annuel : des centimes qui ne tombent pas juste.
  const resultat = () => calculateFunding(opcoGroupe({ budget_annuel_max: sourced(20000) }), etatGroupe(), 5);
  const centimes = (euros: number) => Math.round(euros * 100);

  it('deux profils (3 et 2 personnes) : pour chaque poste, la somme des parts égale le groupe au centime', () => {
    const r = resultat();
    const [a, b] = repartirFinancement(r, [3, 2]);
    expect([a.personnes, b.personnes]).toEqual([3, 2]);
    r.lines.forEach((l, i) => {
      for (const champ of ['requestedAmount', 'fundedAmount', 'remainder'] as const) {
        expect(centimes(a.lines[i][champ] + b.lines[i][champ]), `${l.poste} ${champ}`).toBe(centimes(l[champ]));
      }
      for (const part of [a, b]) {
        expect(part.lines[i].remainder).toBeGreaterThanOrEqual(0);
        expect(centimes(part.lines[i].requestedAmount - part.lines[i].fundedAmount)).toBe(centimes(part.lines[i].remainder));
      }
    });
  });

  it('les totaux de chaque part se recalculent à partir de ses lignes', () => {
    for (const part of repartirFinancement(resultat(), [3, 2])) {
      const demande = part.lines.reduce((s, l) => s + centimes(l.requestedAmount), 0);
      const finance = part.lines.reduce((s, l) => s + centimes(l.fundedAmount), 0);
      expect(centimes(part.totalRequested)).toBe(demande);
      expect(centimes(part.totalFunded)).toBe(finance);
      expect(centimes(part.totalRemainder)).toBe(demande - finance);
    }
  });

  it('un seul profil : les lignes du groupe sont rendues à l’identique', () => {
    const r = resultat();
    const [seule] = repartirFinancement(r, [5]);
    const montants = (x: typeof r) => x.lines.map((l) => [l.poste, l.requestedAmount, l.fundedAmount, l.remainder]);
    expect(montants(seule)).toEqual(montants(r));
    expect(seule.personnes).toBe(5);
  });

  it('ce qui n’est pas un montant est repris tel quel', () => {
    const r = resultat();
    for (const part of repartirFinancement(r, [3, 2])) {
      expect(part).toMatchObject({
        opcoName: r.opcoName,
        pdcFerme: r.pdcFerme,
        budgetCapApplied: r.budgetCapApplied,
        budgetCapAmount: r.budgetCapAmount,
        budgetDejaConsomme: r.budgetDejaConsomme,
      });
      expect(part.warnings).toEqual(r.warnings);
      expect(part.lines.map((l) => [l.poste, l.confidence, l.note])).toEqual(r.lines.map((l) => [l.poste, l.confidence, l.note]));
    }
  });

  it('le montant estimé de chaque dispositif et l’enveloppe maximale se répartissent aussi, au centime ; un montant inconnu reste inconnu', () => {
    const dispositif = (id: string, montant_max: number | null) => ({
      id,
      nom: id,
      cumul: 'additif' as const,
      montant_max,
      unite: 'par_dossier' as const,
      pourcentage_couts: null,
      description: 'd',
      conditions: [],
      demarches: 'm',
      tailles_eligibles: null,
      publics: null,
      confidence: 'exact' as const,
      source_url: 'x',
    });
    const opco = opcoGroupe({ dispositifs_complementaires: [dispositif('connu', 1000.01), dispositif('inconnu', null)] });
    const r = calculateFunding(opco, etatGroupe(), 5);
    const [a, b] = repartirFinancement(r, [3, 2]);
    expect(centimes(a.dispositifsComplementaires[0].montantEstime! + b.dispositifsComplementaires[0].montantEstime!)).toBe(100001);
    expect(a.dispositifsComplementaires[1].montantEstime).toBeNull();
    expect(b.dispositifsComplementaires[1].montantEstime).toBeNull();
    expect(centimes(a.enveloppeMaxPotentielle + b.enveloppeMaxPotentielle)).toBe(centimes(r.enveloppeMaxPotentielle));
  });
});
