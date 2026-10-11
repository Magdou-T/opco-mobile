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
