import { describe, expect, it } from 'vitest';
import { evaluerAide } from '../src/aides/evaluer';
import { construirePlan } from '../src/aides/plan';
import type { LignePlan, OptionPlan, PlanFinancement } from '../src/aides/plan';
import type { Aide, AideEvaluee } from '../src/aides/types';
import { calculateFunding } from '../src/calculator';
import { construirePlanDuBloc, fusionnerPlans, repartirFinancement } from '../src/groupe';
import { etatGroupe, opcoGroupe } from './fixtures';
import { makeAide, makeProfil } from './fixtures-aides';
import { AUJOURDHUI } from './fixtures-groupe';

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

  // Une aide chiffrée pour un profil et sans montant pour un autre (solde CPF connu pour l'un, inconnu pour l'autre) : le plan
  // fusionné la garde dans sa ligne et ne la liste plus sans montant.
  const ids = (aides: { id: string }[]) => aides.map((a) => a.id);
  const LISTES_SANS_MONTANT = ['nonChiffrees', 'servicesGratuits'] as const;
  /** Un plan dont seule la liste sans montant `liste` est renseignée. */
  const sans = (liste: (typeof LISTES_SANS_MONTANT)[number], aides: AideEvaluee[]): PlanFinancement => ({ ...plan({}), [liste]: aides });

  it("une aide en ligne pour un profil et sans montant pour un autre n'est plus listée sans montant : financements, aides à l'employeur, rémunérations, avantages, dans les deux ordres", () => {
    for (const liste of LISTES_DE_LIGNES) {
      for (const sansMontant of LISTES_SANS_MONTANT) {
        const chiffre = avec(liste, [ligne('x', 800, { personnes: 2 })]);
        const inconnu = sans(sansMontant, [aide('x'), aide('nat-autre')]);
        for (const plans of [[chiffre, inconnu], [inconnu, chiffre]]) {
          const fusion = fusionnerPlans(plans, ordres);
          // La ligne reste telle quelle ; seule l'aide sans montant de même identifiant disparaît.
          expect(fusion[liste].map((l) => [l.id, l.montant, l.personnes]), `${liste} ${sansMontant}`).toEqual([['x', 800, 2]]);
          expect(ids(fusion[sansMontant]), `${liste} ${sansMontant}`).toEqual(['nat-autre']);
        }
      }
    }
  });

  it("une aide en option pour un profil, chiffrée ou selon dossier, et sans montant pour un autre n'est plus listée sans montant", () => {
    for (const montant of [500, null]) {
      for (const sansMontant of LISTES_SANS_MONTANT) {
        const enOption = plan({ options: [optionDe('x', montant)] });
        const inconnu = sans(sansMontant, [aide('x'), aide('nat-autre')]);
        for (const plans of [[enOption, inconnu], [inconnu, enOption]]) {
          const fusion = fusionnerPlans(plans, ordres);
          expect(fusion.options.map((o) => [o.id, o.montantEstime]), `${montant} ${sansMontant}`).toEqual([['x', montant]]);
          expect(ids(fusion[sansMontant]), `${montant} ${sansMontant}`).toEqual(['nat-autre']);
        }
      }
    }
  });

  it("la règle se juge sur le plan fusionné : une ligne du troisième plan retire l'aide sans montant des deux premiers", () => {
    for (const sansMontant of LISTES_SANS_MONTANT) {
      const inconnu = sans(sansMontant, [aide('x')]);
      const fusion = fusionnerPlans([inconnu, inconnu, plan({ remunerations: [ligne('x', 300)] })], ordres);
      expect(ids(fusion[sansMontant]), sansMontant).toEqual([]);
      expect(fusion.remunerations.map((l) => [l.id, l.montant]), sansMontant).toEqual([['x', 300]]);
    }
  });

  it('une aide sans montant dans les deux plans, chiffrée dans aucun, reste listée une fois', () => {
    for (const sansMontant of LISTES_SANS_MONTANT) {
      const inconnu = sans(sansMontant, [aide('x')]);
      expect(ids(fusionnerPlans([inconnu, inconnu], ordres)[sansMontant]), sansMontant).toEqual(['x']);
    }
  });

  it("une aide sans montant chez un seul profil, qui n'a de ligne chez aucun, reste listée à côté des lignes des autres aides", () => {
    for (const sansMontant of LISTES_SANS_MONTANT) {
      const autres = plan({
        financements: [ligne('y', 100)],
        aidesEmployeur: [ligne('e', 200)],
        remunerations: [ligne('r', 300)],
        avantagesFiscauxSociaux: [ligne('f', 400)],
        options: [optionDe('o', 50), optionDe('s', null)],
      });
      const inconnu = sans(sansMontant, [aide('x')]);
      for (const plans of [[autres, inconnu], [inconnu, autres]]) {
        expect(ids(fusionnerPlans(plans, ordres)[sansMontant]), sansMontant).toEqual(['x']);
      }
    }
  });

  it("un plan seul est rendu tel quel, même s'il liste une aide à la fois dans une ligne et sans montant", () => {
    // Un plan d'un profil ne le fait jamais (construirePlan range chaque aide une seule fois) : la règle ne vaut que pour une fusion.
    const seul = plan({ financements: [ligne('x', 10)], options: [optionDe('o', null)], nonChiffrees: [aide('x'), aide('o')], servicesGratuits: [aide('x')] });
    const avant = JSON.stringify(seul);
    const fusion = fusionnerPlans([seul], ordres);
    expect(fusion).toBe(seul);
    expect(ids(fusion.nonChiffrees)).toEqual(['x', 'o']);
    expect(ids(fusion.servicesGratuits)).toEqual(['x']);
    expect(JSON.stringify(seul)).toBe(avant);
  });
});
