import { describe, expect, it } from 'vitest';
import { evaluerAide } from '../src/aides/evaluer';
import { construirePlan } from '../src/aides/plan';
import type { LignePlan, OptionPlan, PlanFinancement } from '../src/aides/plan';
import type { Aide } from '../src/aides/types';
import { calculateFunding } from '../src/calculator';
import {
  ID_PROFIL_PRINCIPAL,
  champsDuProfilPrincipal,
  construirePlanDuBloc,
  etatDuProfil,
  fusionnerPlans,
  nombreDePersonnes,
  profilsDuGroupe,
  repartirCentimes,
  repartirFinancement,
} from '../src/groupe';
import { MAX_PERSONNES, MAX_PROFILS, createInitialWizardState } from '../src/types';
import type { ProfilSupplementaire, WizardState } from '../src/types';
import { etatGroupe, opcoGroupe, sourced } from './fixtures';
import { makeAide, makeProfil } from './fixtures-aides';

describe("état initial d'un groupe", () => {
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

  it("un état enregistré avant l'évolution reste valide une fois fusionné sur l'état initial (app mobile)", () => {
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
  it("le profil principal vient d'abord, avec les champs de l'étape Participants", () => {
    const [principal, second] = profilsDuGroupe(groupe());
    expect(principal).toMatchObject({ id: ID_PROFIL_PRINCIPAL, nombre: 3, principal: true });
    expect(principal.champs).toMatchObject({ projetType: 'formation_salarie', contractType: 'cdi', ageBeneficiaire: 35 });
    expect(second).toMatchObject({ id: 'profil-2', nombre: 2, principal: false });
    expect(second.champs).toMatchObject({ projetType: 'formation_dirigeant', statutDirigeant: 'artisan', isHandicap: true });
  });

  it("les champs d'un profil sont exactement les douze réponses de l'étape (ni identifiant, ni effectif)", () => {
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

  it("le total ignore les effectifs invalides : chacun est ramené à un entier de 1 à 99 avant d'être additionné", () => {
    const invalides = groupe({
      nombrePersonnes: Number.NaN,
      autresProfils: [supplementaire({ nombre: 0 }), supplementaire({ id: 'profil-3', nombre: 3.7 })],
    });
    expect(nombreDePersonnes(invalides)).toBe(5); // 1 + 1 + 3
    expect(nombreDePersonnes({ ...invalides, nombrePersonnes: undefined as unknown as number })).toBe(5);
  });

  it("le profil principal reprend chacune des douze réponses de l'état, chacune à sa place", () => {
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

describe("état d'une personne d'un profil", () => {
  it("reprend l'entreprise, la formation et les frais, et remplace les réponses du bénéficiaire par celles du profil", () => {
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

  it("ne modifie pas l'état reçu", () => {
    const etat = groupe();
    const avant = JSON.stringify(etat);
    etatDuProfil(etat, profilsDuGroupe(etat)[1]);
    expect(JSON.stringify(etat)).toBe(avant);
  });
});

/**
 * Générateur congruentiel à graine fixe : `hasard(n)` rend un entier de 0 à n - 1, tiré des bits de poids fort de l'état de
 * 31 bits. Les bits de poids faible alternent pair et impair (`graine % n`) et lieraient la parité du total au nombre de profils.
 */
function generateur(graine: number): (n: number) => number {
  return (n) => {
    graine = (Math.imul(graine, 1103515245) + 12345) & 0x7fffffff;
    return Math.floor((graine / 0x80000000) * n);
  };
}

describe('répartition en centimes', () => {
  it('chaque part reçoit sa fraction entière, et à égalité de décimales le centime restant va à la première part', () => {
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
    const hasard = generateur(12345);
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

  it("les centimes restants vont à la plus grande part décimale, même quand ce n'est ni la première ni la plus nombreuse", () => {
    expect(repartirCentimes(10, [1, 2])).toEqual([3, 7]); // 3,33 et 6,67 : le centime va à la seconde
    expect(repartirCentimes(2, [4, 3])).toEqual([1, 1]); // 1,14 et 0,86 : le centime va à la plus petite part
  });

  it('deux centimes restants vont à deux parts différentes, un chacune', () => {
    expect(repartirCentimes(101, [1, 1, 1])).toEqual([34, 34, 33]);
  });

  it('une seule part reçoit tout, y compris quand elle compte une seule personne', () => {
    expect(repartirCentimes(100, [1])).toEqual([100]);
    expect(repartirCentimes(1, [1])).toEqual([1]);
  });

  it('un total négatif se répartit de la même façon, sans zéro négatif', () => {
    expect(repartirCentimes(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
    expect(repartirCentimes(-1, [1, 1])).toEqual([-1, 0]);
  });

  it('1 000 répartitions tirées (autre graine) : la somme des parts égale le total, chaque part vaut sa fraction entière ou un centime de plus, et le centime va à la plus grande décimale (à égalité, à la première)', () => {
    const hasard = generateur(54321);
    for (let i = 0; i < 1000; i++) {
      const total = hasard(5_000_000);
      const effectifs = Array.from({ length: 1 + hasard(6) }, () => 1 + hasard(99));
      const somme = effectifs.reduce((s, e) => s + e, 0);
      const entiere = effectifs.map((e) => Math.floor((total * e) / somme));
      const decimale = effectifs.map((e) => (total * e) % somme);
      const parts = repartirCentimes(total, effectifs);
      const message = `${total} ${effectifs}`;
      expect(parts.reduce((s, p) => s + p, 0), message).toBe(total);
      parts.forEach((p, a) => {
        expect([entiere[a], entiere[a] + 1], message).toContain(p);
        parts.forEach((q, b) => {
          if (p === entiere[a] + 1 && q === entiere[b]) {
            expect(decimale[a] > decimale[b] || (decimale[a] === decimale[b] && a < b), message).toBe(true);
          }
        });
      });
    }
  });
});

describe("répartition du résultat de l'OPCO entre profils", () => {
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

  it("un seul profil : les lignes du groupe sont rendues à l'identique", () => {
    const r = resultat();
    const [seule] = repartirFinancement(r, [5]);
    const montants = (x: typeof r) => x.lines.map((l) => [l.poste, l.requestedAmount, l.fundedAmount, l.remainder]);
    expect(montants(seule)).toEqual(montants(r));
    expect(seule.personnes).toBe(5);
  });

  it('tout ce que la répartition ne recalcule pas est repris tel quel, dans le résultat comme dans ses lignes', () => {
    const r = resultat();
    // Ce que la répartition recalcule : le nombre de personnes, les lignes (trois montants chacune), les totaux, les dispositifs et l'enveloppe.
    const sansRecalcules = ({ personnes, lines, totalRequested, totalFunded, totalRemainder, dispositifsComplementaires, enveloppeMaxPotentielle, ...reste }: typeof r) => reste;
    const sansMontants = ({ requestedAmount, fundedAmount, remainder, ...reste }: (typeof r)['lines'][number]) => reste;
    for (const part of repartirFinancement(r, [3, 2])) {
      expect(sansRecalcules(part)).toEqual(sansRecalcules(r));
      expect(part.lines.map(sansMontants)).toEqual(r.lines.map(sansMontants));
    }
  });

  it('ne modifie pas le résultat du groupe reçu', () => {
    const dispositif = {
      id: 'd',
      nom: 'D',
      cumul: 'additif' as const,
      montantEstime: 1000.01,
      description: 'd',
      conditions: ['c'],
      demarches: 'm',
      publics: null,
      confidence: 'exact' as const,
      sourceUrl: 'x',
    };
    const r = { ...resultat(), dispositifsComplementaires: [dispositif] };
    const avant = JSON.stringify(r);
    repartirFinancement(r, [3, 2]);
    expect(JSON.stringify(r)).toBe(avant);
  });

  it("le montant estimé de chaque dispositif et l'enveloppe maximale se répartissent aussi, au centime ; un montant inconnu reste inconnu", () => {
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

  it("le demandé d'une part ne passe jamais sous son financé, même avec un seul centime de reste à charge pour trois profils", () => {
    // Répartis séparément, 0,11 € de demandé donnent 5, 5 et 1 centimes et 0,10 € de financé 4, 4 et 2 : la troisième part aurait un reste négatif.
    const base = resultat();
    const r = { ...base, lines: [{ ...base.lines[0], requestedAmount: 0.11, fundedAmount: 0.1, remainder: 0.01 }] };
    const parts = repartirFinancement(r, [6, 6, 2]);
    for (const part of parts) {
      const [ligne] = part.lines;
      expect(ligne.remainder).toBeGreaterThanOrEqual(0);
      expect(centimes(ligne.requestedAmount)).toBeGreaterThanOrEqual(centimes(ligne.fundedAmount));
    }
    expect(centimes(parts.reduce((s, p) => s + p.lines[0].requestedAmount, 0))).toBe(11);
    expect(centimes(parts.reduce((s, p) => s + p.lines[0].fundedAmount, 0))).toBe(10);
  });

  it("le reste d'une part est son demandé moins son financé, même quand le reste de la ligne du groupe s'écarte d'un centime", () => {
    // Le moteur arrondit le reste sur les montants bruts : 15,75 €/h × 10,5 h × 5 = 826,875 € financés sur 1 000 € demandés donnent
    // 826,88 € et un reste de 173,125 € arrondi à 173,13 €, alors que 1 000,00 - 826,88 = 173,12 €. Attendus calculés à la main pour
    // 3 et 1 personnes, en centimes : financé 82 688 = 62 016 + 20 672 ; reste 17 312 = 12 984 + 4 328 ; demandé 100 000 = 75 000 + 25 000.
    const base = resultat();
    const r = { ...base, lines: [{ ...base.lines[0], requestedAmount: 1000, fundedAmount: 826.88, remainder: 173.13 }] };
    const [a, b] = repartirFinancement(r, [3, 1]);
    expect([a.lines[0].requestedAmount, a.lines[0].fundedAmount, a.lines[0].remainder]).toEqual([750, 620.16, 129.84]);
    expect([b.lines[0].requestedAmount, b.lines[0].fundedAmount, b.lines[0].remainder]).toEqual([250, 206.72, 43.28]);
    expect(centimes(a.lines[0].requestedAmount + b.lines[0].requestedAmount)).toBe(100000);
    expect(centimes(a.lines[0].fundedAmount + b.lines[0].fundedAmount)).toBe(82688);
    expect(centimes(a.lines[0].remainder + b.lines[0].remainder)).toBe(17312); // et non 17313, le reste de la ligne du groupe
  });

  it("les totaux d'une part restent la somme de ses lignes, même quand les parts des lignes ne suivent pas celle du total", () => {
    // Deux lignes de 0,01 € et 0,03 € pour 3 et 2 personnes : les lignes donnent 0,03 € et 0,01 € à chaque part, le total du groupe réparti seul 0,02 € et 0,02 €.
    const base = resultat();
    const ligne = (montant: number) => ({ ...base.lines[0], requestedAmount: montant, fundedAmount: montant, remainder: 0 });
    const r = { ...base, lines: [ligne(0.01), ligne(0.03)], totalRequested: 0.04, totalFunded: 0.04, totalRemainder: 0 };
    const [a, b] = repartirFinancement(r, [3, 2]);
    expect([a.totalRequested, b.totalRequested]).toEqual([0.03, 0.01]);
    expect([a.totalFunded, b.totalFunded]).toEqual([0.03, 0.01]);
    expect([a.totalRemainder, b.totalRemainder]).toEqual([0, 0]);
  });

  it("un montant dont le produit par 100 n'est pas un entier exact (4,35 € et 8,20 €) ne perd pas de centime", () => {
    const base = resultat();
    const r = { ...base, lines: [{ ...base.lines[0], requestedAmount: 8.2, fundedAmount: 4.35, remainder: 3.85 }] };
    const [seule] = repartirFinancement(r, [5]);
    expect([seule.lines[0].requestedAmount, seule.lines[0].fundedAmount, seule.lines[0].remainder]).toEqual([8.2, 4.35, 3.85]);
  });

  it('un montant estimé de 0 € reste un montant connu, et un dispositif garde tout le reste de sa fiche', () => {
    const eligible = (id: string, montantEstime: number | null) => ({
      id,
      nom: `Dispositif ${id}`,
      cumul: 'additif' as const,
      montantEstime,
      description: 'd',
      conditions: ['c'],
      demarches: 'm',
      publics: 'p',
      note: 'n',
      confidence: 'exact' as const,
      sourceUrl: 'https://example.opco.fr/d',
    });
    const r = { ...resultat(), dispositifsComplementaires: [eligible('zero', 0), eligible('connu', 0.05)] };
    for (const part of repartirFinancement(r, [3, 2])) {
      expect(part.dispositifsComplementaires[0].montantEstime).toBe(0);
      part.dispositifsComplementaires.forEach((d, i) => {
        expect({ ...d, montantEstime: null }).toEqual({ ...r.dispositifsComplementaires[i], montantEstime: null });
      });
    }
  });

  it('le budget déjà consommé, les libellés, les sources et les textes de détail sont repris tels quels', () => {
    const r = calculateFunding(opcoGroupe({ budget_annuel_max: sourced(20000) }), etatGroupe({ budgetDejaConsomme: 3000 }), 5);
    expect(r.budgetDejaConsomme).toBe(3000);
    for (const part of repartirFinancement(r, [3, 2])) {
      expect(part.budgetDejaConsomme).toBe(3000);
      expect(part.budgetCapAmount).toBe(r.budgetCapAmount);
      expect(part.lines.map((l) => [l.label, l.sourceUrl, l.details])).toEqual(r.lines.map((l) => [l.label, l.sourceUrl, l.details]));
    }
  });
});

const AUJOURDHUI = '2026-10-05';
const forfait = (id: string, financeur: Aide['financeur'], valeur: number) =>
  makeAide({ id, financeur, montant: { ...makeAide().montant, valeur } });
/** Aide prélevée sur le solde CPF de la personne : son montant est le solde connu du profil. */
const soldeCpf = makeAide({
  id: 'nat-cpf',
  financeur: 'cpf',
  montant: { ...makeAide().montant, mode: 'solde_cpf', valeur: null, libelle: 'Solde CPF disponible' },
});
/** Aide du catalogue d'une catégorie donnée : un forfait de `valeur` euros, ou sans montant quand `valeur` est nulle. */
const aideDe = (id: string, categorie: Aide['categorie'], valeur: number | null, over: Partial<Aide> = {}) =>
  makeAide({
    id,
    categorie,
    montant: { ...makeAide().montant, mode: valeur == null ? 'non_chiffre' : 'forfait', valeur },
    ...over,
  });

describe("plan d'un profil (bloc de personnes)", () => {
  const profil = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 0, soldeCpf: 1500 });
  const evaluees = (p = profil) =>
    [soldeCpf, forfait('r11-region', 'region', 1000), forfait('nat-etat', 'etat', 3000)].map((a) => evaluerAide(a, p, AUJOURDHUI));
  const paires = (lignes: { id: string; montant: number }[]) => lignes.map((l) => [l.id, l.montant]);

  it('une personne : exactement le plan de construirePlan', () => {
    expect(construirePlanDuBloc(null, evaluees(), profil, 1)).toEqual(construirePlan(null, evaluees(), profil));
  });

  it("trois personnes sans OPCO : l'empilement vaut 3 fois celui d'une personne, chaque ligne dit pour combien", () => {
    const un = construirePlanDuBloc(null, evaluees(), profil, 1);
    const trois = construirePlanDuBloc(null, evaluees(), profil, 3);
    // Une personne : Région 1 000, État 3 000, CPF plafonné au reste (200) ; trois personnes : trois fois chaque montant.
    expect(paires(un.financements)).toEqual([['r11-region', 1000], ['nat-etat', 3000], ['nat-cpf', 200]]);
    expect(paires(trois.financements)).toEqual([['r11-region', 3000], ['nat-etat', 9000], ['nat-cpf', 600]]);
    expect(trois.financements.every((l) => l.personnes === 3)).toBe(true);
    expect(trois).toMatchObject({ coutFormation: 12600, totalFinance: 12600, resteACharge: 0 });
  });

  it("le solde CPF est celui de chaque personne : multiplié par l'effectif, jamais dépassé", () => {
    const maigre = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 0, soldeCpf: 100 });
    const trois = construirePlanDuBloc(null, evaluees(maigre), maigre, 3);
    // 3 × 100 € de solde pour un reste de 600 € : le CPF finance 300 €, il reste 300 €.
    expect(paires(trois.financements).at(-1)).toEqual(['nat-cpf', 300]);
    expect(trois).toMatchObject({ totalFinance: 12300, resteACharge: 300 });
  });

  it("la part de l'OPCO est reprise telle quelle (déjà valable pour le bloc), les aides à l'employeur aussi", () => {
    const part = repartirFinancement(calculateFunding(opcoGroupe(), etatGroupe(), 3), [3])[0];
    const plan = construirePlanDuBloc(part, [], makeProfil({ coutPedagogique: 5000, coutFraisAnnexes: 555 }), 3);
    expect(plan.coutFormation).toBe(16665);
    expect(plan.financements).toEqual([expect.objectContaining({ id: 'opco-pdc', montant: 13425, personnes: 3 })]);
    expect(plan.aidesEmployeur.map((l) => [l.id, l.montant, l.personnes])).toEqual([
      ['opco-salaires', 3600, 3],
      ['opco-transport', 450, 3],
    ]);
    expect(plan.resteACharge).toBe(3240);
  });

  it("jamais plus que le coût du bloc, jamais de reste négatif, quel que soit l'effectif", () => {
    for (const nombre of [1, 2, 7, 99]) {
      const plan = construirePlanDuBloc(null, evaluees(), profil, nombre);
      expect(plan.totalFinance).toBeLessThanOrEqual(plan.coutFormation);
      expect(plan.resteACharge).toBeGreaterThanOrEqual(0);
      expect(Math.round((plan.coutFormation - plan.resteACharge) * 100)).toBe(Math.round(plan.totalFinance * 100));
    }
  });

  it("un effectif d'une personne ou moins se lit comme une personne : le plan de construirePlan, avec ou sans part de l'OPCO, sans personnes", () => {
    const part = calculateFunding(opcoGroupe(), etatGroupe(), 1);
    const p = makeProfil({ coutPedagogique: 5000, coutFraisAnnexes: 555, soldeCpf: 1500 });
    // Le plan comparé n'est pas vide : avec la part de l'OPCO, il a une ligne OPCO et des aides à l'employeur.
    const avecOpco = construirePlan(part, evaluees(p), p);
    expect(avecOpco.financements.map((l) => l.id)).toContain('opco-pdc');
    expect(avecOpco.aidesEmployeur).not.toHaveLength(0);
    for (const opco of [null, part]) {
      const attendu = construirePlan(opco, evaluees(p), p);
      for (const nombre of [1, 0, -2]) {
        const plan = construirePlanDuBloc(opco, evaluees(p), p, nombre);
        expect(plan, `effectif ${nombre}`).toEqual(attendu);
        expect([...plan.financements, ...plan.aidesEmployeur].some((l) => 'personnes' in l), `effectif ${nombre}`).toBe(false);
      }
    }
  });

  it("un effectif hors de 1 à 99 est ramené à un entier de 1 à 99 : NaN, l'infini, 0 et -2 valent 1, 2,5 vaut 2, 150 vaut 99", () => {
    // 4 000 € de pédagogie et 200 € de frais par personne ; un solde CPF de 100 € par personne, partagé entre deux aides : il borne
    // le CPF à 100 € par personne (la seconde aide n'a plus rien à prélever), donc il doit suivre l'effectif ramené.
    const p = makeProfil({ coutPedagogique: 4000, coutFraisAnnexes: 200, soldeCpf: 100 });
    const secondSoldeCpf = makeAide({
      id: 'nat-vae',
      financeur: 'cpf',
      montant: { ...makeAide().montant, mode: 'solde_cpf', valeur: null, libelle: 'Solde CPF disponible (VAE)' },
    });
    const catalogue = [soldeCpf, secondSoldeCpf, forfait('r11-region', 'region', 1000), forfait('nat-etat', 'etat', 3000)].map((a) =>
      evaluerAide(a, p, AUJOURDHUI),
    );
    const ramenes: [number, number][] = [
      [Number.NaN, 1],
      [Number.POSITIVE_INFINITY, 1],
      [2.5, 2],
      [150, 99],
      [0, 1],
      [-2, 1],
    ];
    for (const [saisi, n] of ramenes) {
      const plan = construirePlanDuBloc(null, catalogue, p, saisi);
      // Par personne : Région 1 000 €, État 3 000 €, CPF 100 € sur 4 200 € de coût ; pour n personnes, n fois chaque montant.
      expect(paires(plan.financements), `effectif ${saisi}`).toEqual([
        ['r11-region', 1000 * n],
        ['nat-etat', 3000 * n],
        ['nat-cpf', 100 * n],
      ]);
      expect(plan, `effectif ${saisi}`).toMatchObject({ coutFormation: 4200 * n, totalFinance: 4100 * n, resteACharge: 100 * n });
      // `personnes` vaut l'effectif ramené à partir de deux personnes ; pour une personne, la ligne n'en porte pas.
      expect(plan.financements.map((l) => l.personnes), `effectif ${saisi}`).toEqual(n > 1 ? [n, n, n] : [undefined, undefined, undefined]);
    }
  });

  it("montants décimaux : 3 × (0,10 € + 0,20 €) font exactement 0,90 €, l'État verse 0,30 €, il reste 0,60 € et coût moins reste égale financé", () => {
    const decimal = makeProfil({ coutPedagogique: 0.1, coutFraisAnnexes: 0.2, soldeCpf: null });
    const catalogue = [forfait('nat-etat', 'etat', 0.1)].map((a) => evaluerAide(a, decimal, AUJOURDHUI));
    const plan = construirePlanDuBloc(null, catalogue, decimal, 3);
    // Calcul à la main, en centimes : coût 3 × (10 + 20) = 90 ; l'État verse 3 × 10 = 30 ; il reste 90 - 30 = 60 ; financé 90 - 60 = 30.
    // En flottants, chaque étape garde un bruit que le plan doit arrondir : 0,1 × 3 + 0,2 × 3 = 0,9000000000000001 ; 0,9 - 0,3 = 0,6000000000000001 ;
    // 0,9 - 0,6 = 0,30000000000000004.
    expect(plan.coutFormation).toBe(0.9);
    expect(plan.financements.map((l) => [l.id, l.montant, l.personnes])).toEqual([['nat-etat', 0.3, 3]]);
    expect(plan.resteACharge).toBe(0.6);
    expect(plan.totalFinance).toBe(0.3);
    expect(Math.round((plan.coutFormation - plan.resteACharge) * 100)).toBe(Math.round(plan.totalFinance * 100));
  });

  it('solde CPF décimal : 3 × 0,29 € de solde font exactement 0,87 € prélevés sur le CPF', () => {
    const decimal = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 0, soldeCpf: 0.29 });
    const plan = construirePlanDuBloc(null, evaluees(decimal), decimal, 3);
    // Coût du bloc 12 600 € : Région 3 000 €, État 9 000 €, il reste 600 € ; le solde du bloc est 3 × 0,29 = 0,87 € (en flottants 0,8699999999999999),
    // le CPF en prélève 0,87 €, il reste 599,13 € et 12 000,87 € sont financés.
    expect(paires(plan.financements).at(-1)).toEqual(['nat-cpf', 0.87]);
    expect(plan.resteACharge).toBe(599.13);
    expect(plan.totalFinance).toBe(12000.87);
  });

  it("chaque catégorie d'aide est multipliée par l'effectif, et les quatre listes de lignes disent pour combien de personnes", () => {
    const catalogue = [
      forfait('nat-etat', 'etat', 3000),
      aideDe('nat-embauche', 'aide_employeur', 700),
      aideDe('nat-rfft', 'remuneration_beneficiaire', 450),
      aideDe('fis-credit', 'avantage_fiscal_social', 475),
      aideDe('nat-seule', 'cout_formation', 600, { cumul: { cumulable: false } }),
      aideDe('nat-flou', 'cout_formation', null),
      aideDe('nat-service', 'service_gratuit', null),
    ].map((a) => evaluerAide(a, profil, AUJOURDHUI));
    const plan = construirePlanDuBloc(null, catalogue, profil, 3);
    const lignes = (liste: LignePlan[]) => liste.map((l) => [l.id, l.montant, l.personnes]);
    expect(lignes(plan.financements)).toEqual([['nat-etat', 9000, 3]]);
    expect(lignes(plan.aidesEmployeur)).toEqual([['nat-embauche', 2100, 3]]);
    expect(lignes(plan.remunerations)).toEqual([['nat-rfft', 1350, 3]]);
    expect(lignes(plan.avantagesFiscauxSociaux)).toEqual([['fis-credit', 1425, 3]]);
    // Une option garde son montant (multiplié), un montant inconnu reste inconnu, un service gratuit reste un service.
    expect(plan.options.map((o) => [o.id, o.montantEstime])).toEqual([['nat-seule', 1800]]);
    expect(plan.nonChiffrees.map((a) => [a.id, a.montantEstime])).toEqual([['nat-flou', null]]);
    expect(plan.servicesGratuits.map((a) => a.id)).toEqual(['nat-service']);
  });

  it("le produit par l'effectif est arrondi au centime : 0,07 € × 3, 0,29 € × 3, 47,55 € × 3 et 70,70 € × 3 ne gardent aucun bruit de flottants", () => {
    const catalogue = [
      aideDe('nat-embauche', 'aide_employeur', 0.07),
      aideDe('nat-rfft', 'remuneration_beneficiaire', 0.29),
      aideDe('fis-credit', 'avantage_fiscal_social', 47.55),
      aideDe('nat-seule', 'cout_formation', 70.7, { cumul: { cumulable: false } }),
    ].map((a) => evaluerAide(a, profil, AUJOURDHUI));
    const plan = construirePlanDuBloc(null, catalogue, profil, 3);
    // En flottants : 0,07 × 3 = 0,21000000000000002 ; 0,29 × 3 = 0,8699999999999999 ; 47,55 × 3 = 142,64999999999998 ; 70,7 × 3 = 212,10000000000002.
    expect(plan.aidesEmployeur[0].montant).toBe(0.21);
    expect(plan.remunerations[0].montant).toBe(0.87);
    expect(plan.avantagesFiscauxSociaux[0].montant).toBe(142.65);
    expect(plan.options[0].montantEstime).toBe(212.1);
  });

  it("coût pédagogique inconnu : le coût du bloc est nul, jamais les frais annexes seuls, et rien n'est financé", () => {
    const inconnu = makeProfil({ coutPedagogique: null, coutFraisAnnexes: 300, soldeCpf: 1500 });
    const plan = construirePlanDuBloc(null, evaluees(inconnu), inconnu, 3);
    expect(plan).toMatchObject({ coutFormation: 0, financements: [], totalFinance: 0, resteACharge: 0 });
  });

  it("solde CPF inconnu : l'aide prélevée sur le solde n'est pas chiffrée, pour un bloc comme pour une personne", () => {
    const sansSolde = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 0, soldeCpf: null });
    for (const nombre of [1, 3]) {
      const plan = construirePlanDuBloc(null, evaluees(sansSolde), sansSolde, nombre);
      expect(plan.nonChiffrees.map((a) => [a.id, a.montantEstime]), `effectif ${nombre}`).toEqual([['nat-cpf', null]]);
      expect(plan.financements.map((l) => l.id), `effectif ${nombre}`).toEqual(['r11-region', 'nat-etat']);
    }
  });

  it("la part de l'OPCO passe d'abord, les aides du catalogue sont plafonnées au reste du bloc", () => {
    const part = repartirFinancement(calculateFunding(opcoGroupe(), etatGroupe(), 3), [3])[0];
    const p = makeProfil({ coutPedagogique: 5000, coutFraisAnnexes: 555, soldeCpf: 1500 });
    const plan = construirePlanDuBloc(part, evaluees(p), p, 3);
    // Coût du bloc 16 665 € : l'OPCO en prend 13 425, il reste 3 240 € ; la Région en prend 3 000 (3 × 1 000), l'État le reste (240 €), le CPF rien.
    expect(paires(plan.financements)).toEqual([['opco-pdc', 13425], ['r11-region', 3000], ['nat-etat', 240]]);
    expect(plan.financements.every((l) => l.personnes === 3)).toBe(true);
    expect(plan).toMatchObject({ coutFormation: 16665, totalFinance: 16665, resteACharge: 0 });
  });

  it("ne modifie ni les aides, ni le profil, ni la part de l'OPCO reçus, quel que soit l'effectif", () => {
    const part = repartirFinancement(calculateFunding(opcoGroupe(), etatGroupe(), 3), [3])[0];
    const p = makeProfil({ coutPedagogique: 5000, coutFraisAnnexes: 555, soldeCpf: 1500 });
    const aides = evaluees(p);
    const avant = JSON.stringify({ part, p, aides });
    for (const nombre of [1, 3]) construirePlanDuBloc(part, aides, p, nombre);
    expect(JSON.stringify({ part, p, aides })).toBe(avant);
  });
});

describe('fusion des plans des profils', () => {
  const ligne = (id: string, montant: number, over: Partial<LignePlan> = {}): LignePlan => ({
    id,
    nom: `Ligne ${id}`,
    financeurNom: 'Financeur',
    montant,
    confidence: 'exact',
    ...over,
  });
  const plan = (over: Partial<PlanFinancement>): PlanFinancement => ({
    coutFormation: 0,
    financements: [],
    totalFinance: 0,
    resteACharge: 0,
    aidesEmployeur: [],
    remunerations: [],
    avantagesFiscauxSociaux: [],
    options: [],
    nonChiffrees: [],
    servicesGratuits: [],
    ...over,
  });
  const ordres = [
    { id: 'nat-cpf', ordreEmpilement: 90 },
    { id: 'faf-fafcea', ordreEmpilement: 60 },
    { id: 'r11-region', ordreEmpilement: 20 },
  ];
  const aide = (id: string) => evaluerAide(makeAide({ id }), makeProfil(), '2026-10-05');

  it('un seul plan : rendu tel quel', () => {
    const seul = plan({ coutFormation: 100 });
    expect(fusionnerPlans([seul], ordres)).toBe(seul);
  });

  it("coût, financé et reste s'additionnent en centimes entiers", () => {
    const fusion = fusionnerPlans(
      [plan({ coutFormation: 0.1, totalFinance: 0.1, resteACharge: 0 }), plan({ coutFormation: 0.2, totalFinance: 0, resteACharge: 0.2 })],
      ordres,
    );
    expect(fusion).toMatchObject({ coutFormation: 0.3, totalFinance: 0.1, resteACharge: 0.2 });
  });

  it("les lignes de même identifiant s'additionnent, la fiabilité la plus faible l'emporte, les effectifs s'ajoutent", () => {
    const a = plan({ financements: [ligne('opco-pdc', 3150, { personnes: 3 }), ligne('nat-cpf', 600, { personnes: 3 })] });
    const b = plan({ financements: [ligne('faf-fafcea', 1225, { personnes: 1 }), ligne('nat-cpf', 200, { confidence: 'estimated' })] });
    const fusion = fusionnerPlans([a, b], ordres);
    expect(fusion.financements.map((l) => [l.id, l.montant, l.personnes, l.confidence])).toEqual([
      ['opco-pdc', 3150, 3, 'exact'],
      ['faf-fafcea', 1225, 1, 'exact'],
      ['nat-cpf', 800, 4, 'estimated'],
    ]);
  });

  it("tri par ordre d'empilement (OPCO 10, dispositif de l'OPCO 12, aide du catalogue), puis par montant décroissant", () => {
    const a = plan({ financements: [ligne('nat-cpf', 100), ligne('opco-catalogue', 50), ligne('opco-pdc', 10)] });
    const b = plan({ financements: [ligne('r11-region', 70), ligne('faf-fafcea', 500)] });
    expect(fusionnerPlans([a, b], ordres).financements.map((l) => l.id)).toEqual([
      'opco-pdc',
      'opco-catalogue',
      'r11-region',
      'faf-fafcea',
      'nat-cpf',
    ]);
  });

  it("aides à l'employeur, rémunérations et avantages : même fusion par identifiant", () => {
    const a = plan({ aidesEmployeur: [ligne('opco-salaires', 1200)], remunerations: [ligne('nat-rfft', 700)] });
    const b = plan({ aidesEmployeur: [ligne('opco-salaires', 300), ligne('nat-embauche', 5000)], avantagesFiscauxSociaux: [ligne('fis-credit', 475)] });
    const fusion = fusionnerPlans([a, b], ordres);
    expect(fusion.aidesEmployeur.map((l) => [l.id, l.montant])).toEqual([['opco-salaires', 1500], ['nat-embauche', 5000]]);
    expect(fusion.remunerations.map((l) => l.id)).toEqual(['nat-rfft']);
    expect(fusion.avantagesFiscauxSociaux.map((l) => l.id)).toEqual(['fis-credit']);
  });

  it("options : somme des montants connus, nulle si aucun profil n'en a ; aides sans montant et services : réunion sans doublon", () => {
    const option = (id: string, montantEstime: number | null) => ({ id, nom: id, financeurNom: 'F', montantEstime, raison: 'Au choix avec « X »' });
    const a = plan({ options: [option('o1', 100), option('o2', null)], nonChiffrees: [aide('nat-a')], servicesGratuits: [aide('nat-s')] });
    const b = plan({ options: [option('o1', 50), option('o2', null), option('o3', 20)], nonChiffrees: [aide('nat-a'), aide('nat-b')], servicesGratuits: [aide('nat-s')] });
    const fusion = fusionnerPlans([a, b], ordres);
    expect(fusion.options.map((o) => [o.id, o.montantEstime])).toEqual([['o1', 150], ['o2', null], ['o3', 20]]);
    expect(fusion.nonChiffrees.map((x) => x.id)).toEqual(['nat-a', 'nat-b']);
    expect(fusion.servicesGratuits.map((x) => x.id)).toEqual(['nat-s']);
  });

  it('plans réels de deux profils : coût moins reste égale financé, jamais de reste négatif', () => {
    const p1 = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 0, soldeCpf: 1500 });
    const p2 = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 0, soldeCpf: null });
    const aides1 = [forfait('nat-etat', 'etat', 3000), soldeCpf].map((a) => evaluerAide(a, p1, '2026-10-05'));
    const aides2 = [forfait('nat-etat', 'etat', 3000)].map((a) => evaluerAide(a, p2, '2026-10-05'));
    const fusion = fusionnerPlans([construirePlanDuBloc(null, aides1, p1, 3), construirePlanDuBloc(null, aides2, p2, 2)], aides1);
    expect(fusion.coutFormation).toBe(21000);
    expect(Math.round((fusion.coutFormation - fusion.resteACharge) * 100)).toBe(Math.round(fusion.totalFinance * 100));
    expect(fusion.resteACharge).toBeGreaterThanOrEqual(0);
    expect(fusion.financements.find((l) => l.id === 'nat-etat')).toMatchObject({ montant: 15000, personnes: 5 });
  });

  const optionDe = (id: string, montantEstime: number | null, over: Partial<OptionPlan> = {}): OptionPlan => ({
    id,
    nom: id,
    financeurNom: 'F',
    montantEstime,
    raison: 'Au choix avec « X »',
    ...over,
  });
  const LISTES_DE_LIGNES = ['financements', 'aidesEmployeur', 'remunerations', 'avantagesFiscauxSociaux'] as const;
  /** Un plan dont seule la liste de lignes `liste` est renseignée. */
  const avec = (liste: (typeof LISTES_DE_LIGNES)[number], lignes: LignePlan[]): PlanFinancement => ({ ...plan({}), [liste]: lignes });

  it('aucun plan : un plan vide', () => {
    expect(fusionnerPlans([], ordres)).toEqual(plan({}));
  });

  it('la fiabilité de deux lignes de même identifiant est la plus faible des deux, pour chaque paire et dans les deux sens', () => {
    const echelle = ['depends_on_branche', 'estimated', 'exact'] as const; // du plus faible au plus fort
    for (const a of echelle) {
      for (const b of echelle) {
        const fusion = fusionnerPlans(
          [plan({ financements: [ligne('x', 1, { confidence: a })] }), plan({ financements: [ligne('x', 1, { confidence: b })] })],
          ordres,
        );
        expect(fusion.financements[0].confidence, `${a} puis ${b}`).toBe(echelle[Math.min(echelle.indexOf(a), echelle.indexOf(b))]);
      }
    }
  });

  it('chacune des quatre listes de lignes : montants en centimes, effectifs (une personne par défaut), nom et financeur de la première occurrence', () => {
    for (const liste of LISTES_DE_LIGNES) {
      const a = avec(liste, [ligne('x', 0.1, { nom: 'Premier', financeurNom: 'F1', personnes: 2 }), ligne('z', 7)]);
      const b = avec(liste, [ligne('x', 0.2, { nom: 'Second', financeurNom: 'F2' }), ligne('y', 5), ligne('z', 8)]);
      const fusion = fusionnerPlans([a, b], ordres)[liste];
      expect(fusion.find((l) => l.id === 'x'), liste).toMatchObject({ montant: 0.3, personnes: 3, nom: 'Premier', financeurNom: 'F1' });
      expect(fusion.find((l) => l.id === 'y'), liste).toMatchObject({ montant: 5, personnes: 1 });
      expect(fusion.find((l) => l.id === 'z'), liste).toMatchObject({ montant: 15, personnes: 2 });
    }
  });

  it("aides à l'employeur, rémunérations et avantages restent dans l'ordre d'arrivée, ni triés par montant ni par identifiant", () => {
    for (const liste of LISTES_DE_LIGNES.slice(1)) {
      const a = avec(liste, [ligne('m', 500), ligne('z', 10), ligne('a', 200)]);
      const b = avec(liste, [ligne('k', 1), ligne('a', 20)]);
      expect(fusionnerPlans([a, b], ordres)[liste].map((l) => l.id), liste).toEqual(['m', 'z', 'a', 'k']);
    }
  });

  it("ordre d'empilement exact : opco-pdc vaut 10, un dispositif de l'OPCO 12, une ligne sans aide connue 85", () => {
    const catalogue = [9, 11, 13, 84, 86].map((ordreEmpilement) => ({ id: `nat-${ordreEmpilement}`, ordreEmpilement }));
    // Chaque ligne pèse plus que son voisin d'ordre inférieur et moins que son voisin d'ordre supérieur : à ordre égal, elle serait mal placée.
    const a = plan({ financements: [ligne('nat-86', 300), ligne('opco-dispositif', 400), ligne('nat-9', 100), ligne('inconnue', 200)] });
    const b = plan({ financements: [ligne('nat-13', 500), ligne('opco-pdc', 200), ligne('nat-84', 100), ligne('nat-11', 300)] });
    expect(fusionnerPlans([a, b], catalogue).financements.map((l) => l.id)).toEqual([
      'nat-9',
      'opco-pdc',
      'nat-11',
      'opco-dispositif',
      'nat-13',
      'nat-84',
      'inconnue',
      'nat-86',
    ]);
  });

  it("à ordre égal, le plus gros montant d'abord, quel que soit l'ordre d'arrivée", () => {
    const catalogue = ['nat-a', 'nat-b', 'nat-c'].map((id) => ({ id, ordreEmpilement: 50 }));
    const a = plan({ financements: [ligne('nat-a', 100), ligne('nat-b', 500)] });
    const b = plan({ financements: [ligne('nat-c', 300)] });
    expect(fusionnerPlans([a, b], catalogue).financements.map((l) => l.id)).toEqual(['nat-b', 'nat-c', 'nat-a']);
  });

  it("un ordre d'empilement nul est un ordre, et l'ordre d'une aide du catalogue l'emporte sur la règle des identifiants opco-", () => {
    const catalogue = [
      { id: 'nat-zero', ordreEmpilement: 0 },
      { id: 'nat-30', ordreEmpilement: 30 },
      { id: 'opco-du-catalogue', ordreEmpilement: 40 },
    ];
    const lignes = [ligne('opco-du-catalogue', 100), ligne('nat-30', 50), ligne('opco-pdc', 10), ligne('nat-zero', 5)];
    expect(fusionnerPlans([plan({ financements: lignes }), plan({})], catalogue).financements.map((l) => l.id)).toEqual([
      'nat-zero',
      'opco-pdc',
      'nat-30',
      'opco-du-catalogue',
    ]);
  });

  it("options sur trois plans : somme des montants connus, nulle si aucun profil n'en a, nom, financeur et raison de la première occurrence, ordre d'arrivée", () => {
    const a = plan({
      options: [
        optionDe('o-b', 0.1, { nom: 'Premier', financeurNom: 'F1', raison: 'R1' }),
        optionDe('o-c', null),
        optionDe('o-a', 7.01),
        optionDe('o-f', null),
      ],
    });
    const b = plan({
      options: [
        optionDe('o-b', 0.2, { nom: 'Second', financeurNom: 'F2', raison: 'R2' }),
        optionDe('o-c', 12.35),
        optionDe('o-a', null),
        optionDe('o-d', null),
        optionDe('o-f', null),
      ],
    });
    const c = plan({ options: [optionDe('o-b', 0.3, { nom: 'Troisième' }), optionDe('o-d', 2), optionDe('o-e', 4)] });
    expect(fusionnerPlans([a, b, c], ordres).options).toEqual([
      optionDe('o-b', 0.6, { nom: 'Premier', financeurNom: 'F1', raison: 'R1' }),
      optionDe('o-c', 12.35),
      optionDe('o-a', 7.01),
      optionDe('o-f', null),
      optionDe('o-d', 2),
      optionDe('o-e', 4),
    ]);
  });

  it('aides sans montant et services gratuits sur trois plans : réunion sans doublon, la première occurrence est gardée', () => {
    const variante = (id: string, nom: string) => ({ ...aide(id), nom });
    const a = plan({ nonChiffrees: [variante('nat-a', 'Première')], servicesGratuits: [variante('nat-s', 'Premier')] });
    const b = plan({
      nonChiffrees: [variante('nat-a', 'Seconde'), variante('nat-b', 'Autre')],
      servicesGratuits: [variante('nat-s', 'Second')],
    });
    const c = plan({
      nonChiffrees: [variante('nat-a', 'Troisième'), variante('nat-c', 'Dernière')],
      servicesGratuits: [variante('nat-t', 'Troisième')],
    });
    const fusion = fusionnerPlans([a, b, c], ordres);
    expect(fusion.nonChiffrees.map((x) => [x.id, x.nom])).toEqual([['nat-a', 'Première'], ['nat-b', 'Autre'], ['nat-c', 'Dernière']]);
    expect(fusion.servicesGratuits.map((x) => [x.id, x.nom])).toEqual([['nat-s', 'Premier'], ['nat-t', 'Troisième']]);
  });

  it('ne modifie aucun des plans reçus (lignes et options de même identifiant comprises)', () => {
    const a = plan({
      financements: [ligne('x', 10, { personnes: 2 })],
      aidesEmployeur: [ligne('y', 20)],
      remunerations: [ligne('z', 30)],
      avantagesFiscauxSociaux: [ligne('w', 40)],
      options: [optionDe('o', 5)],
      nonChiffrees: [aide('nat-a')],
      servicesGratuits: [aide('nat-s')],
    });
    const b = plan({
      financements: [ligne('x', 1, { confidence: 'estimated' })],
      aidesEmployeur: [ligne('y', 2)],
      remunerations: [ligne('z', 3)],
      avantagesFiscauxSociaux: [ligne('w', 4)],
      options: [optionDe('o', 6)],
      nonChiffrees: [aide('nat-a')],
      servicesGratuits: [aide('nat-s')],
    });
    const avant = JSON.stringify([a, b]);
    fusionnerPlans([a, b], ordres);
    expect(JSON.stringify([a, b])).toBe(avant);
  });

  it("n profils identiques, aides chiffrées au centime par personne et services gratuits sans montant : la fusion de n plans d'une personne est le plan du bloc de n personnes", () => {
    const p = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 0, soldeCpf: 1500 });
    const catalogue = [
      soldeCpf,
      forfait('r11-region', 'region', 1000),
      forfait('nat-etat', 'etat', 2000),
      forfait('nat-etat-bis', 'etat', 1000),
      aideDe('nat-embauche', 'aide_employeur', 700),
      aideDe('nat-rfft', 'remuneration_beneficiaire', 450),
      aideDe('fis-credit', 'avantage_fiscal_social', 475),
      aideDe('nat-seule', 'cout_formation', 600, { cumul: { cumulable: false } }),
      aideDe('nat-flou', 'cout_formation', null),
      aideDe('nat-service', 'service_gratuit', null),
    ].map((a) => evaluerAide(a, p, AUJOURDHUI));
    const une = construirePlan(null, catalogue, p);
    // Garde de non-vide : chacune des sept rubriques du plan d'une personne est renseignée, sinon le test perdrait sa couverture en silence si une fixture changeait.
    for (const rubrique of ['financements', 'aidesEmployeur', 'remunerations', 'avantagesFiscauxSociaux', 'options', 'nonChiffrees', 'servicesGratuits'] as const) {
      expect(une[rubrique], rubrique).not.toHaveLength(0);
    }
    // Condition du titre pour les services : aucun n'a de montant (le plan d'un bloc multiplierait celui qu'il aurait).
    expect(une.servicesGratuits.every((s) => s.montantEstime == null)).toBe(true);
    // Une personne : Région 1 000, État 2 000 puis 1 000, CPF plafonné au reste (200).
    expect(une.financements.map((l) => [l.id, l.montant])).toEqual([['r11-region', 1000], ['nat-etat', 2000], ['nat-etat-bis', 1000], ['nat-cpf', 200]]);
    for (const nombre of [2, 3, 7, 99]) {
      const fusion = fusionnerPlans(Array.from({ length: nombre }, () => une), catalogue);
      expect(construirePlanDuBloc(null, catalogue, p, nombre), `effectif ${nombre}`).toEqual(fusion);
    }
  });
});
