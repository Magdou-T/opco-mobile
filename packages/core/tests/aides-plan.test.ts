import { describe, it, expect } from 'vitest';
import { construirePlan } from '../src/aides/plan';
import { evaluerAide } from '../src/aides/evaluer';
import { calculateFunding } from '../src/calculator';
import type { Aide, AideEvaluee, CategorieAide, ProfilAides } from '../src/aides/types';
import type { Confidence, DispositifEligible, FundingLine, FundingResult, PosteFinancement } from '../src/types';
import { makeAide, makeProfil } from './fixtures-aides';
import { makeFormationState, makeOpco } from './fixtures';

const AUJOURDHUI = '2026-10-05';
const profil = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 0 });
const evaluer = (aides: Aide[]) => aides.map((a) => evaluerAide(a, profil, AUJOURDHUI));
const forfait = (id: string, financeur: Aide['financeur'], valeur: number, over: Partial<Aide> = {}) =>
  makeAide({ id, financeur, montant: { ...makeAide().montant, valeur }, ...over });

describe('construirePlan, empilement', () => {
  it("empile dans l'ordre des financeurs et plafonne au coût", () => {
    const aides = evaluer([
      forfait('nat-cpf', 'cpf', 1500),
      forfait('r11-region', 'region', 1000),
      forfait('nat-etat', 'etat', 3000),
    ]);
    const plan = construirePlan(null, aides, profil);
    // Région (20) 1000, État (50) 3000 → 4000 ; CPF (90) plafonné au reste 200
    expect(plan.financements.map((l) => [l.id, l.montant])).toEqual([
      ['r11-region', 1000],
      ['nat-etat', 3000],
      ['nat-cpf', 200],
    ]);
    expect(plan.totalFinance).toBe(4200);
    expect(plan.resteACharge).toBe(0);
  });

  it("ne dépasse jamais le coût et le reste à charge n'est jamais négatif", () => {
    const plan = construirePlan(null, evaluer([forfait('nat-a', 'etat', 9000)]), profil);
    expect(plan.totalFinance).toBe(4200);
    expect(plan.resteACharge).toBe(0);
  });

  it('ne compte pas les aides à vérifier', () => {
    const plan = construirePlan(null, evaluer([forfait('nat-a', 'etat', 1000, { statut: 'a_confirmer' })]), profil);
    expect(plan.financements).toEqual([]);
    expect(plan.resteACharge).toBe(4200);
  });
});

describe('construirePlan, alternatives et catégories', () => {
  it("garde l'alternative la mieux chiffrée, l'autre devient une option", () => {
    const aides = evaluer([
      forfait('nat-a', 'etat', 1000, { cumul: { cumulable: true, alternatives: ['nat-b'] } }),
      forfait('nat-b', 'etat', 2500, { cumul: { cumulable: true, alternatives: ['nat-a'] } }),
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(plan.financements.map((l) => l.id)).toEqual(['nat-b']);
    expect(plan.options).toEqual([expect.objectContaining({ id: 'nat-a', raison: expect.stringContaining('Au choix') })]);
  });

  it('alternatives en chaîne : a–b et b–c, seule la mieux chiffrée du maillon est écartée', () => {
    const aides = evaluer([
      forfait('nat-a', 'etat', 3000, { cumul: { cumulable: true, alternatives: ['nat-b'] } }),
      forfait('nat-b', 'etat', 2500, { cumul: { cumulable: true, alternatives: ['nat-a', 'nat-c'] } }),
      forfait('nat-c', 'etat', 1000, { cumul: { cumulable: true, alternatives: ['nat-b'] } }),
    ]);
    const plan = construirePlan(null, aides, profil);
    // a (3000) est retenue, b est son alternative : option ; c n'est alternative que de b : retenue.
    expect(plan.financements.map((l) => l.id)).toEqual(['nat-a', 'nat-c']);
    expect(plan.options.map((o) => o.id)).toEqual(['nat-b']);
  });

  it('alternative déclarée dans un seul sens : même résultat', () => {
    const aides = evaluer([
      forfait('nat-a', 'etat', 1000), // ne déclare rien
      forfait('nat-b', 'etat', 2500, { cumul: { cumulable: true, alternatives: ['nat-a'] } }),
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(plan.financements.map((l) => l.id)).toEqual(['nat-b']);
    expect(plan.options.map((o) => o.id)).toEqual(['nat-a']);
  });

  it('alternatives non chiffrées (triplet POEC / POEI / POEI régionale) : une seule retenue', () => {
    const nonChiffre = { ...makeAide().montant, mode: 'non_chiffre' as const, valeur: null };
    const aides = evaluer([
      makeAide({ id: 'nat-poec', nom: 'POEC', montant: nonChiffre, cumul: { cumulable: true, alternatives: ['nat-poei', 'r11-poei'] } }),
      makeAide({ id: 'nat-poei', nom: 'POEI', montant: nonChiffre, cumul: { cumulable: true, alternatives: ['nat-poec', 'r11-poei'] } }),
      makeAide({ id: 'r11-poei', nom: 'POEI régionale', montant: nonChiffre, cumul: { cumulable: true, alternatives: ['nat-poei', 'nat-poec'] } }),
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(plan.nonChiffrees).toHaveLength(1);
    expect(plan.options).toHaveLength(2);
  });

  it("sépare aides à l'employeur, rémunérations, avantages, non chiffrées et services", () => {
    const aides = evaluer([
      forfait('nat-embauche', 'etat', 5000, { categorie: 'aide_employeur' }),
      forfait('nat-remu', 'france_travail', 900, { categorie: 'remuneration_beneficiaire' }),
      forfait('fis-credit', 'fiscal', 475, { categorie: 'avantage_fiscal_social' }),
      makeAide({ id: 'nat-flou', montant: { ...makeAide().montant, mode: 'non_chiffre', valeur: null } }),
      makeAide({ id: 'nat-cep', categorie: 'service_gratuit', montant: { ...makeAide().montant, mode: 'non_chiffre', valeur: null } }),
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(plan.aidesEmployeur.map((l) => l.id)).toEqual(['nat-embauche']);
    expect(plan.remunerations.map((l) => l.id)).toEqual(['nat-remu']);
    expect(plan.avantagesFiscauxSociaux.map((l) => l.id)).toEqual(['fis-credit']);
    expect(plan.nonChiffrees.map((a) => a.id)).toEqual(['nat-flou']);
    expect(plan.servicesGratuits.map((a) => a.id)).toEqual(['nat-cep']);
    expect(plan.totalFinance).toBe(0);
  });

  it('une aide non cumulable est présentée en option', () => {
    const plan = construirePlan(null, evaluer([forfait('nat-seule', 'etat', 800, { cumul: { cumulable: false } })]), profil);
    expect(plan.financements).toEqual([]);
    expect(plan.options[0].id).toBe('nat-seule');
  });
});

describe('construirePlan, intégration du calcul OPCO', () => {
  it('pédagogie dans le financement, salaires côté employeur, dispositif alternatif en option', () => {
    const opco = makeOpco({
      cout_horaire_inter: { value: 40, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires: { value: 12, confidence: 'exact', source_url: 'x' },
      prise_en_charge_salaires_mode: 'euro_par_heure',
      dispositifs_complementaires: [
        {
          id: 'catalogue', nom: 'Catalogue', cumul: 'alternatif', montant_max: null, unite: null, pourcentage_couts: 100,
          description: 'd', conditions: [], demarches: 'm', tailles_eligibles: null, publics: null, confidence: 'exact', source_url: 'x',
        },
      ],
    });
    const funding = calculateFunding(opco, makeFormationState({ durationHours: 100, pedagogyCostPerHour: 30, pedagogyCostTotal: 3000 }));
    const plan = construirePlan(funding, [], makeProfil({ coutPedagogique: 3000, coutFraisAnnexes: 0 }));
    expect(plan.financements).toEqual([expect.objectContaining({ id: 'opco-pdc', montant: 3000 })]);
    expect(plan.aidesEmployeur).toEqual([expect.objectContaining({ id: 'opco-salaires', montant: 1200 })]);
    expect(plan.options).toEqual([expect.objectContaining({ id: 'opco-catalogue' })]);
    expect(plan.resteACharge).toBe(0);
  });
});

// === Cas limites : ils épinglent les règles du plan (une mutation du code doit les faire échouer) ===

const montantNonChiffre = { ...makeAide().montant, mode: 'non_chiffre' as const, valeur: null };
/** Aide prélevée sur le solde CPF du bénéficiaire : son montant est le solde connu du profil (éventuellement plafonné). */
const montantSoldeCpf = { ...makeAide().montant, mode: 'solde_cpf' as const, valeur: null, libelle: 'Solde CPF disponible' };
const evaluerPour = (p: ProfilAides, aides: Aide[]): AideEvaluee[] => aides.map((a) => evaluerAide(a, p, AUJOURDHUI));
/** [id, montant] de chaque ligne : la forme la plus lisible pour comparer des empilements. */
const paires = (lignes: { id: string; montant: number }[]) => lignes.map((l) => [l.id, l.montant]);

const NOM_OPCO = 'OPCO de test';
/** Poste d'un calcul OPCO fabriqué à la main (indépendant des barèmes) ; le montant demandé vaut le montant financé par défaut. */
const posteOpco = (
  poste: PosteFinancement,
  finance: number,
  confidence: Confidence = 'exact',
  demande: number = finance,
): FundingLine => ({
  poste,
  label: poste,
  requestedAmount: demande,
  fundedAmount: finance,
  remainder: Math.max(0, demande - finance),
  confidence,
  sourceUrl: 'https://example.opco.fr/criteres',
});
const dispositif = (
  id: string,
  cumul: DispositifEligible['cumul'],
  montantEstime: number | null,
  over: Partial<DispositifEligible> = {},
): DispositifEligible => ({
  id,
  nom: `Dispositif ${id}`,
  cumul,
  montantEstime,
  description: 'Dispositif fictif.',
  conditions: [],
  demarches: 'Déposer la demande.',
  publics: null,
  confidence: 'exact',
  sourceUrl: 'https://example.opco.fr/dispositif',
  ...over,
});
/**
 * Calcul OPCO fabriqué à la main : le plan ne lit que `opcoName`, `lines`, `budgetCapApplied` et
 * `dispositifsComplementaires` ; `over` surcharge n'importe quel champ (par exemple `budgetCapApplied: true`).
 */
const resultatOpco = (
  lines: FundingLine[],
  dispositifsComplementaires: DispositifEligible[] = [],
  over: Partial<FundingResult> = {},
): FundingResult => ({
  opcoName: NOM_OPCO,
  opcoSlug: 'opco-de-test',
  opcoEmail: 'contact@example.opco.fr',
  opcoUrl: 'https://example.opco.fr/criteres',
  dispositifPrincipal: 'Plan de développement des compétences (fonds mutualisés OPCO)',
  pdcFerme: false,
  brancheAppliquee: null,
  lines,
  totalRequested: 0,
  totalFunded: 0,
  totalRemainder: 0,
  budgetCapApplied: false,
  budgetCapAmount: null,
  budgetDejaConsomme: 0,
  dispositifsComplementaires,
  enveloppeMaxPotentielle: 0,
  warnings: [],
  alertes: [],
  conditions: [],
  demarches: [],
  nextSteps: [],
  delaiValidation: '2-3 semaines',
  modePaiement: 'Tiers-payant',
  ...over,
});

describe('construirePlan, seules les aides éligibles comptent', () => {
  // Une aide de chaque sorte, toutes éligibles : le plan de référence.
  const eligibles = () =>
    evaluer([
      forfait('nat-etat', 'etat', 1000),
      forfait('nat-seule', 'etat', 200, { cumul: { cumulable: false } }),
      forfait('nat-embauche', 'etat', 500, { categorie: 'aide_employeur' }),
      forfait('nat-remu', 'france_travail', 300, { categorie: 'remuneration_beneficiaire' }),
      forfait('fis-credit', 'fiscal', 100, { categorie: 'avantage_fiscal_social' }),
      makeAide({ id: 'nat-flou', montant: montantNonChiffre }),
      makeAide({ id: 'nat-cep', categorie: 'service_gratuit', montant: montantNonChiffre }),
    ]);
  // Les mêmes sortes d'aides, très bien chiffrées, mais pas éligibles ; « bruit-alt » se déclare au choix avec une aide éligible.
  const intrus = (statut: Aide['statut']) =>
    evaluer([
      forfait('bruit-formation', 'region', 99999, { statut }),
      forfait('bruit-seule', 'etat', 99999, { statut, cumul: { cumulable: false } }),
      forfait('bruit-alt', 'etat', 99999, { statut, cumul: { cumulable: true, alternatives: ['nat-etat'] } }),
      forfait('bruit-embauche', 'etat', 99999, { statut, categorie: 'aide_employeur' }),
      forfait('bruit-remu', 'france_travail', 99999, { statut, categorie: 'remuneration_beneficiaire' }),
      forfait('bruit-credit', 'fiscal', 99999, { statut, categorie: 'avantage_fiscal_social' }),
      makeAide({ id: 'bruit-flou', statut, montant: montantNonChiffre }),
      makeAide({ id: 'bruit-cep', statut, categorie: 'service_gratuit', montant: montantNonChiffre }),
    ]);

  it.each([
    ['non_eligible', 'suspendu'],
    ['a_verifier', 'a_confirmer'],
  ] as const)('une aide %s, même très bien chiffrée, ne change rien au plan', (statutEvalue, statutAide) => {
    const bruit = intrus(statutAide);
    // Garde-fous du test : le statut visé, et un montant estimé (pour le non éligible : ce que l'aide verserait).
    expect(bruit.every((a) => a.statut === statutEvalue)).toBe(true);
    expect(bruit.filter((a) => (a.montantEstime ?? 0) > 0)).toHaveLength(6);

    const sans = construirePlan(null, eligibles(), profil);
    expect(paires(sans.financements)).toEqual([['nat-etat', 1000]]);
    expect(sans).toMatchObject({ totalFinance: 1000, resteACharge: 3200 });
    expect(sans.options.map((o) => o.id)).toEqual(['nat-seule']);
    expect(paires(sans.aidesEmployeur)).toEqual([['nat-embauche', 500]]);
    expect(paires(sans.remunerations)).toEqual([['nat-remu', 300]]);
    expect(paires(sans.avantagesFiscauxSociaux)).toEqual([['fis-credit', 100]]);
    expect(sans.nonChiffrees.map((a) => a.id)).toEqual(['nat-flou']);
    expect(sans.servicesGratuits.map((a) => a.id)).toEqual(['nat-cep']);

    expect(construirePlan(null, [...bruit, ...eligibles()], profil)).toEqual(sans);
    expect(construirePlan(null, [...eligibles(), ...bruit], profil)).toEqual(sans);
  });
});

describe('construirePlan, coût nul ou inconnu', () => {
  it.each<[string, ProfilAides, number[]]>([
    ['inconnu (null)', makeProfil({ coutPedagogique: null, coutFraisAnnexes: 0 }), [500, 1000]],
    ['inconnu (null) avec 300 € de frais annexes (jamais les frais annexes seuls)', makeProfil({ coutPedagogique: null, coutFraisAnnexes: 300 }), [500, 1000]],
    ['nul (0 €)', makeProfil({ coutPedagogique: 0, coutFraisAnnexes: 0 }), [0, 0]],
  ])('coût %s : rien à empiler, reste à charge nul, sans exception', (_cas, p, montants) => {
    const aides = evaluerPour(p, [forfait('r11-region', 'region', 500), forfait('nat-etat', 'etat', 1000)]);
    // Garde-fou : ce que les aides verseraient pour ce profil (plafonnées à 0 quand le coût est 0 €).
    expect(aides.map((a) => a.montantEstime)).toEqual(montants);
    const plan = construirePlan(null, aides, p);
    expect(plan).toMatchObject({ coutFormation: 0, financements: [], totalFinance: 0, resteACharge: 0 });
  });

  it("le calcul OPCO ne finance rien non plus, mais les aides à l'employeur restent listées", () => {
    const opco = resultatOpco([posteOpco('pedagogie', 3000), posteOpco('salaires', 1200)]);
    const plan = construirePlan(opco, [], makeProfil({ coutPedagogique: null, coutFraisAnnexes: 0 }));
    expect(plan).toMatchObject({ financements: [], totalFinance: 0, resteACharge: 0 });
    expect(paires(plan.aidesEmployeur)).toEqual([['opco-salaires', 1200]]);
  });

  it("coût pédagogique inconnu avec des frais annexes : le coût de la formation est nul, le calcul OPCO ne finance rien", () => {
    const opco = resultatOpco([posteOpco('pedagogie', 3000), posteOpco('hebergement', 200)]);
    const plan = construirePlan(opco, [], makeProfil({ coutPedagogique: null, coutFraisAnnexes: 300 }));
    expect(plan).toMatchObject({ coutFormation: 0, financements: [], totalFinance: 0, resteACharge: 0 });
  });

  it("un coût pédagogique de 0 € est connu (pas inconnu) : les frais annexes forment alors tout le coût de la formation", () => {
    const p = makeProfil({ coutPedagogique: 0, coutFraisAnnexes: 300 });
    const aides = evaluerPour(p, [forfait('nat-a', 'etat', 1000)]);
    expect(aides[0].montantEstime).toBe(300); // garde-fou : l'aide est limitée au coût connu (300 €)
    const plan = construirePlan(null, aides, p);
    expect(plan.coutFormation).toBe(300);
    expect(plan.financements).toEqual([expect.objectContaining({ id: 'nat-a', montant: 300 })]);
    expect(plan).toMatchObject({ totalFinance: 300, resteACharge: 0 });
  });

  it('sans aide ni calcul OPCO : tout le coût (pédagogie + frais annexes) reste à charge, toutes les listes sont vides', () => {
    expect(construirePlan(null, [], makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 300 }))).toEqual({
      coutFormation: 4500,
      financements: [],
      totalFinance: 0,
      resteACharge: 4500,
      aidesEmployeur: [],
      remunerations: [],
      avantagesFiscauxSociaux: [],
      options: [],
      nonChiffrees: [],
      servicesGratuits: [],
    });
  });
});

describe("construirePlan, ordre d'empilement et plafond au reste à charge", () => {
  it("empile par ordre croissant, l'ordre explicite d'une aide l'emportant sur celui de son financeur", () => {
    const aides = evaluer([
      forfait('nat-cpf', 'cpf', 100), // 90 par défaut
      forfait('nat-etat', 'etat', 200), // 50 par défaut
      forfait('nat-prioritaire', 'cpf', 300, { ordre_empilement: 5 }), // 5 au lieu de 90
      forfait('r11-region', 'region', 400), // 20 par défaut
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(paires(plan.financements)).toEqual([
      ['nat-prioritaire', 300],
      ['r11-region', 400],
      ['nat-etat', 200],
      ['nat-cpf', 100],
    ]);
    expect(plan.totalFinance).toBe(1000);
  });

  it("à ordre égal, la plus grosse aide passe d'abord et c'est la plus petite qui est plafonnée", () => {
    const aides = evaluer([
      forfait('nat-petit', 'etat', 1000), // déclarée en premier
      forfait('nat-grand', 'etat', 3500),
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(paires(plan.financements)).toEqual([
      ['nat-grand', 3500],
      ['nat-petit', 700],
    ]);
  });

  describe('plafond au reste à charge (coût 4 200 €, 2 200 € déjà empilés)', () => {
    const empiler = (montantB: number) =>
      construirePlan(
        null,
        evaluer([forfait('r11-a', 'region', 2200), forfait('nat-b', 'etat', montantB), forfait('nat-c', 'cpf', 500)]),
        profil,
      );

    it("une aide égale au reste est financée en entier et ferme l'empilement", () => {
      const plan = empiler(2000);
      expect(paires(plan.financements)).toEqual([
        ['r11-a', 2200],
        ['nat-b', 2000],
      ]);
      expect(plan).toMatchObject({ totalFinance: 4200, resteACharge: 0 });
    });

    it("un centime de trop : l'aide est ramenée au reste et l'empilement s'arrête", () => {
      const plan = empiler(2000.01);
      expect(paires(plan.financements)).toEqual([
        ['r11-a', 2200],
        ['nat-b', 2000],
      ]);
      expect(plan).toMatchObject({ totalFinance: 4200, resteACharge: 0 });
    });

    it("un centime de moins : le centime restant va à l'aide suivante", () => {
      const plan = empiler(1999.99);
      expect(paires(plan.financements)).toEqual([
        ['r11-a', 2200],
        ['nat-b', 1999.99],
        ['nat-c', 0.01],
      ]);
      expect(plan).toMatchObject({ totalFinance: 4200, resteACharge: 0 });
    });
  });

  it('une aide à 0 € ne crée aucune ligne', () => {
    const plan = construirePlan(null, evaluer([forfait('nat-zero', 'etat', 0), forfait('nat-a', 'cpf', 300)]), profil);
    expect(paires(plan.financements)).toEqual([['nat-a', 300]]);
  });

  it('un coût négatif (saisie invalide) vaut 0 : ni coût, ni total financé, ni reste à charge négatifs, aucune ligne de financement', () => {
    const p = makeProfil({ coutPedagogique: -100, coutFraisAnnexes: 0 });
    const plan = construirePlan(null, evaluerPour(p, [forfait('nat-a', 'etat', 500)]), p);
    expect(plan).toMatchObject({ coutFormation: 0, financements: [], totalFinance: 0, resteACharge: 0 });
  });

  it('le coût comprend les frais annexes : une aide qui couvre tout finance aussi les frais annexes', () => {
    const p = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 300 });
    const plan = construirePlan(null, evaluerPour(p, [forfait('nat-a', 'etat', 9000)]), p);
    expect(plan.coutFormation).toBe(4500);
    expect(paires(plan.financements)).toEqual([['nat-a', 4500]]);
    expect(plan).toMatchObject({ totalFinance: 4500, resteACharge: 0 });
  });
});

describe('construirePlan, ce qui ne réduit pas le coût de la formation', () => {
  it('une rémunération du bénéficiaire, même élevée, ne diminue jamais le reste à charge', () => {
    const aides = evaluer([
      forfait('nat-remu', 'france_travail', 99999, { categorie: 'remuneration_beneficiaire' }),
      forfait('r11-remu', 'region', 4200, { categorie: 'remuneration_beneficiaire' }),
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(paires(plan.remunerations)).toEqual([
      ['nat-remu', 99999],
      ['r11-remu', 4200],
    ]);
    expect(plan).toMatchObject({ financements: [], totalFinance: 0, resteACharge: 4200 });
  });

  it("les aides à l'employeur et les avantages fiscaux et sociaux non plus : seule l'aide au coût de la formation est déduite", () => {
    const aides = evaluer([
      forfait('nat-embauche', 'etat', 5000, { categorie: 'aide_employeur' }),
      forfait('fis-credit', 'fiscal', 3000, { categorie: 'avantage_fiscal_social' }),
      forfait('nat-remu', 'france_travail', 900, { categorie: 'remuneration_beneficiaire' }),
      forfait('r11-region', 'region', 1000),
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(paires(plan.financements)).toEqual([['r11-region', 1000]]);
    expect(plan).toMatchObject({ totalFinance: 1000, resteACharge: 3200 });
    // Présentées à part, avec leur montant complet (jamais plafonné au coût de la formation).
    expect(paires(plan.aidesEmployeur)).toEqual([['nat-embauche', 5000]]);
    expect(paires(plan.avantagesFiscauxSociaux)).toEqual([['fis-credit', 3000]]);
    expect(paires(plan.remunerations)).toEqual([['nat-remu', 900]]);
  });

  it("les listes à part gardent l'ordre de la liste évaluée (déjà triée par montant par evaluerAides)", () => {
    const aides = evaluer([
      forfait('nat-embauche-petite', 'etat', 100, { categorie: 'aide_employeur' }),
      forfait('nat-embauche-grande', 'etat', 500, { categorie: 'aide_employeur' }),
      forfait('nat-remu-petite', 'france_travail', 200, { categorie: 'remuneration_beneficiaire' }),
      forfait('nat-remu-grande', 'france_travail', 900, { categorie: 'remuneration_beneficiaire' }),
      forfait('fis-petit', 'fiscal', 50, { categorie: 'avantage_fiscal_social' }),
      forfait('fis-grand', 'fiscal', 300, { categorie: 'avantage_fiscal_social' }),
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(plan.aidesEmployeur.map((l) => l.id)).toEqual(['nat-embauche-petite', 'nat-embauche-grande']);
    expect(plan.remunerations.map((l) => l.id)).toEqual(['nat-remu-petite', 'nat-remu-grande']);
    expect(plan.avantagesFiscauxSociaux.map((l) => l.id)).toEqual(['fis-petit', 'fis-grand']);
  });

  it("chaque ligne reprend le nom, le financeur, le montant et la fiabilité de l'aide", () => {
    const aides = evaluer([
      forfait('r11-region', 'region', 700, { nom: 'Aide régionale', financeur_nom: 'Région Île-de-France', confidence: 'estimated' }),
      forfait('nat-embauche', 'etat', 500, {
        nom: "Aide à l'embauche", financeur_nom: 'État', categorie: 'aide_employeur', confidence: 'depends_on_branche',
      }),
      forfait('nat-remu', 'france_travail', 300, {
        nom: 'Rémunération', financeur_nom: 'France Travail', categorie: 'remuneration_beneficiaire', confidence: 'estimated',
      }),
      forfait('fis-credit', 'fiscal', 100, {
        nom: "Crédit d'impôt", financeur_nom: 'Fiscalité', categorie: 'avantage_fiscal_social', confidence: 'depends_on_branche',
      }),
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(plan.financements).toEqual([
      { id: 'r11-region', nom: 'Aide régionale', financeurNom: 'Région Île-de-France', montant: 700, confidence: 'estimated' },
    ]);
    expect(plan.aidesEmployeur).toEqual([
      { id: 'nat-embauche', nom: "Aide à l'embauche", financeurNom: 'État', montant: 500, confidence: 'depends_on_branche' },
    ]);
    expect(plan.remunerations).toEqual([
      { id: 'nat-remu', nom: 'Rémunération', financeurNom: 'France Travail', montant: 300, confidence: 'estimated' },
    ]);
    expect(plan.avantagesFiscauxSociaux).toEqual([
      { id: 'fis-credit', nom: "Crédit d'impôt", financeurNom: 'Fiscalité', montant: 100, confidence: 'depends_on_branche' },
    ]);
  });

  it.each(['cout_formation', 'aide_employeur', 'remuneration_beneficiaire', 'avantage_fiscal_social'] as const)(
    'une aide non chiffrée de catégorie %s est signalée dans nonChiffrees, jamais dans une liste de montants',
    (categorie) => {
      const plan = construirePlan(null, evaluer([makeAide({ id: 'nat-flou', categorie, montant: montantNonChiffre })]), profil);
      expect(plan.nonChiffrees.map((a) => a.id)).toEqual(['nat-flou']);
      expect([plan.financements, plan.aidesEmployeur, plan.remunerations, plan.avantagesFiscauxSociaux, plan.options]).toEqual([
        [], [], [], [], [],
      ]);
      expect(plan).toMatchObject({ totalFinance: 0, resteACharge: 4200 });
    },
  );

  it('une aide non cumulable est une option « à comparer » : jamais empilée, le reste à charge ne bouge pas', () => {
    const aides = evaluer([
      forfait('nat-seule', 'etat', 800, { nom: 'Aide seule', cumul: { cumulable: false } }),
      forfait('r11-region', 'region', 1000),
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(paires(plan.financements)).toEqual([['r11-region', 1000]]);
    expect(plan.resteACharge).toBe(3200);
    expect(plan.options).toEqual([
      { id: 'nat-seule', nom: 'Aide seule', financeurNom: 'État', montantEstime: 800, raison: expect.stringContaining('Non cumulable') },
    ]);
  });
});

describe("construirePlan, chaque catégorie d'aide a sa liste", () => {
  type ListePlan = 'financements' | 'aidesEmployeur' | 'remunerations' | 'avantagesFiscauxSociaux' | 'servicesGratuits';
  const LISTES: ListePlan[] = ['financements', 'aidesEmployeur', 'remunerations', 'avantagesFiscauxSociaux', 'servicesGratuits'];
  // Typée par l'union des catégories : une nouvelle catégorie oblige à la ranger ici ET dans construirePlan, dont le `switch`
  // assigne la catégorie non traitée à une constante de type `never` (il ne compile plus tant qu'elle n'y est pas traitée).
  const LISTE_PAR_CATEGORIE: Record<CategorieAide, ListePlan> = {
    cout_formation: 'financements',
    aide_employeur: 'aidesEmployeur',
    remuneration_beneficiaire: 'remunerations',
    avantage_fiscal_social: 'avantagesFiscauxSociaux',
    service_gratuit: 'servicesGratuits',
  };

  it.each(Object.entries(LISTE_PAR_CATEGORIE) as [CategorieAide, ListePlan][])(
    'une aide chiffrée de catégorie %s est rangée dans %s, et dans aucune autre liste',
    (categorie, liste) => {
      const plan = construirePlan(null, evaluer([forfait('nat-test', 'etat', 500, { categorie })]), profil);
      for (const nom of LISTES) {
        expect(plan[nom].map((x) => x.id), nom).toEqual(nom === liste ? ['nat-test'] : []);
      }
      expect(plan.options).toEqual([]);
      expect(plan.nonChiffrees).toEqual([]);
    },
  );
});

describe('construirePlan, aides au choix : détails', () => {
  it("l'option nomme l'aide retenue et garde le nom, le financeur et le montant de l'aide écartée", () => {
    const aides = evaluer([
      forfait('nat-a', 'etat', 1000, { nom: 'Aide A', financeur_nom: 'État', cumul: { cumulable: true, alternatives: ['r11-b'] } }),
      forfait('r11-b', 'region', 2500, { nom: 'Aide B', financeur_nom: 'Région', cumul: { cumulable: true, alternatives: ['nat-a'] } }),
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(plan.options).toEqual([
      { id: 'nat-a', nom: 'Aide A', financeurNom: 'État', montantEstime: 1000, raison: 'Au choix avec « Aide B »' },
    ]);
  });

  it("quand deux aides retenues sont ses alternatives, l'option nomme la mieux chiffrée, pas la première de la liste", () => {
    const aides = evaluer([
      forfait('nat-c', 'etat', 1000, { nom: 'Aide C' }), // la moins bien chiffrée des deux aides retenues, en tête de la liste
      forfait('nat-a', 'etat', 3000, { nom: 'Aide A' }),
      forfait('nat-b', 'etat', 500, { nom: 'Aide B', cumul: { cumulable: true, alternatives: ['nat-a', 'nat-c'] } }),
    ]);
    const plan = construirePlan(null, aides, profil);
    // a (3000) et c (1000) sont retenues avant b (500), qui est l'alternative des deux : elle nomme la mieux chiffrée (a).
    expect(plan.financements.map((l) => l.id)).toEqual(['nat-a', 'nat-c']);
    expect(plan.options).toEqual([expect.objectContaining({ id: 'nat-b', raison: 'Au choix avec « Aide A »' })]);
  });

  it("alternative déclarée seulement par l'aide la moins bien chiffrée : même résultat", () => {
    const aides = evaluer([
      forfait('nat-a', 'etat', 1000, { cumul: { cumulable: true, alternatives: ['nat-b'] } }),
      forfait('nat-b', 'etat', 2500), // ne déclare rien
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(plan.financements.map((l) => l.id)).toEqual(['nat-b']);
    expect(plan.options.map((o) => o.id)).toEqual(['nat-a']);
  });

  it("à montant égal, l'aide placée en premier dans la liste est retenue", () => {
    const a = forfait('nat-a', 'etat', 1500, { cumul: { cumulable: true, alternatives: ['nat-b'] } });
    const b = forfait('nat-b', 'etat', 1500, { cumul: { cumulable: true, alternatives: ['nat-a'] } });
    expect(construirePlan(null, evaluer([a, b]), profil).financements.map((l) => l.id)).toEqual(['nat-a']);
    expect(construirePlan(null, evaluer([b, a]), profil).financements.map((l) => l.id)).toEqual(['nat-b']);
  });

  it("une aide chiffrée est préférée à une aide non chiffrée dont elle est l'alternative", () => {
    const aides = evaluer([
      makeAide({ id: 'nat-flou', montant: montantNonChiffre, cumul: { cumulable: true, alternatives: ['nat-chiffree'] } }), // en premier
      forfait('nat-chiffree', 'etat', 100, { cumul: { cumulable: true, alternatives: ['nat-flou'] } }),
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(paires(plan.financements)).toEqual([['nat-chiffree', 100]]);
    expect(plan.nonChiffrees).toEqual([]);
    expect(plan.options).toEqual([expect.objectContaining({ id: 'nat-flou', montantEstime: null })]);
  });

  it('même une aide chiffrée à 0 € passe avant une aide non chiffrée (convention de evaluerAides : un non chiffré après 0 €)', () => {
    const aides = evaluer([
      makeAide({ id: 'nat-flou', montant: montantNonChiffre, cumul: { cumulable: true, alternatives: ['nat-zero'] } }), // en premier
      forfait('nat-zero', 'etat', 0, { cumul: { cumulable: true, alternatives: ['nat-flou'] } }),
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(plan.nonChiffrees).toEqual([]);
    expect(plan.options).toEqual([expect.objectContaining({ id: 'nat-flou', montantEstime: null })]);
  });
});

describe("construirePlan, aides au choix à montants égaux : le pivot passe d'abord", () => {
  // Pivot : l'aide que le plus grand nombre d'AUTRES aides éligibles déclarent comme alternative. Dans un graphe « en étoile »
  // (les aides spécialisées ne citent que l'aide générale, comme nat-vae, nat-bilan-competences et nat-clea citent nat-cpf),
  // retenir le pivot d'abord écarte toutes les feuilles ; retenir une feuille d'abord laisserait deux feuilles côte à côte.
  const citeA = { cumulable: true, alternatives: ['nat-a'] };
  const optionAuChoix = (id: string, retenue: string, montantEstime: number) => ({
    id, nom: `Aide ${id.slice(4).toUpperCase()}`, financeurNom: 'État', montantEstime, raison: `Au choix avec « ${retenue} »`,
  });

  it("trois aides de même montant, b et c ne déclarent que a (liste dans l'ordre b, c, a) : a est retenue, b et c sont des options", () => {
    const aides = evaluer([
      forfait('nat-b', 'etat', 1000, { nom: 'Aide B', cumul: citeA }),
      forfait('nat-c', 'etat', 1000, { nom: 'Aide C', cumul: citeA }),
      forfait('nat-a', 'etat', 1000, { nom: 'Aide A' }),
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(plan.financements).toEqual([
      { id: 'nat-a', nom: 'Aide A', financeurNom: 'État', montant: 1000, confidence: 'exact' },
    ]);
    expect(plan.options).toEqual([optionAuChoix('nat-b', 'Aide A', 1000), optionAuChoix('nat-c', 'Aide A', 1000)]);
  });

  it("le montant reste le premier critère : avec des montants différents, c'est la mieux chiffrée qui est retenue, pas le pivot", () => {
    const aides = evaluer([
      forfait('nat-b', 'etat', 3000, { nom: 'Aide B', cumul: citeA }),
      forfait('nat-c', 'etat', 2000, { nom: 'Aide C', cumul: citeA }),
      forfait('nat-a', 'etat', 1000, { nom: 'Aide A' }),
    ]);
    const plan = construirePlan(null, aides, profil);
    // b (3000) puis c (2000, qui n'est liée qu'à a, pas encore retenue) sont retenues ; a (le pivot) est écartée au profit de b.
    expect(paires(plan.financements)).toEqual([['nat-b', 3000], ['nat-c', 1200]]);
    expect(plan.options).toEqual([optionAuChoix('nat-a', 'Aide B', 1000)]);
  });

  // À pivots égaux (par exemple deux aides qui se déclarent l'une l'autre), l'ordre de la liste évaluée départage : voir
  // « à montant égal, l'aide placée en premier dans la liste est retenue » plus haut.

  it("le pivot est celui qui est déclaré par le plus GRAND NOMBRE d'aides, pas simplement par une aide", () => {
    // p est déclarée par q, l1 et l2 (3 déclarations) ; q est déclarée par l3 (1 seule) ; q est en tête de la liste.
    const citeP = { cumulable: true, alternatives: ['nat-p'] };
    const aides = evaluer([
      forfait('nat-q', 'etat', 1000, { nom: 'Aide Q', cumul: citeP }),
      forfait('nat-p', 'etat', 1000, { nom: 'Aide P' }),
      forfait('nat-l1', 'etat', 1000, { nom: 'Aide L1', cumul: citeP }),
      forfait('nat-l2', 'etat', 1000, { nom: 'Aide L2', cumul: citeP }),
      forfait('nat-l3', 'etat', 1000, { nom: 'Aide L3', cumul: { cumulable: true, alternatives: ['nat-q'] } }),
    ]);
    const plan = construirePlan(null, aides, profil);
    // p d'abord : q, l1 et l2 deviennent des options ; l3 (liée seulement à q, écartée) est retenue à côté de p.
    expect(paires(plan.financements)).toEqual([['nat-p', 1000], ['nat-l3', 1000]]);
    expect(plan.options.map((o) => [o.id, o.raison])).toEqual([
      ['nat-q', 'Au choix avec « Aide P »'],
      ['nat-l1', 'Au choix avec « Aide P »'],
      ['nat-l2', 'Au choix avec « Aide P »'],
    ]);
  });

  it("seules les aides éligibles déclarent : des aides non éligibles qui citent une aide ne la rendent pas pivot", () => {
    const suspendue = { statut: 'suspendu' as const, cumul: { cumulable: true, alternatives: ['nat-x'] } };
    const aides = evaluer([
      forfait('nat-x', 'etat', 1000, { nom: 'Aide X', cumul: { cumulable: true, alternatives: ['nat-y'] } }), // en tête de la liste
      forfait('nat-y', 'etat', 1000, { nom: 'Aide Y' }),
      forfait('nat-n1', 'etat', 1000, { nom: 'Aide N1', ...suspendue }),
      forfait('nat-n2', 'etat', 1000, { nom: 'Aide N2', ...suspendue }),
    ]);
    // Garde-fou : n1 et n2 citent x mais ne sont pas éligibles. x n'est déclarée par aucune aide éligible ; y l'est (par x).
    expect(aides.map((a) => a.statut)).toEqual(['eligible', 'eligible', 'non_eligible', 'non_eligible']);
    const plan = construirePlan(null, aides, profil);
    expect(paires(plan.financements)).toEqual([['nat-y', 1000]]);
    expect(plan.options).toEqual([optionAuChoix('nat-x', 'Aide Y', 1000)]);
  });

  it("une aide qui se déclare elle-même comme alternative n'est pas comptée comme déclarée par une autre", () => {
    const aides = evaluer([
      forfait('nat-u', 'etat', 1000, { nom: 'Aide U', cumul: { cumulable: true, alternatives: ['nat-v'] } }),
      forfait('nat-v', 'etat', 1000, { nom: 'Aide V', cumul: { cumulable: true, alternatives: ['nat-v'] } }), // s'auto-déclare
      forfait('nat-w', 'etat', 1000, { nom: 'Aide W', cumul: { cumulable: true, alternatives: ['nat-u'] } }),
    ]);
    const plan = construirePlan(null, aides, profil);
    // u (déclarée par w) et v (déclarée par u ; son auto-déclaration ne compte pas) : 1 déclaration chacune, la liste départage → u.
    expect(paires(plan.financements)).toEqual([['nat-u', 1000]]);
    expect(plan.options).toEqual([optionAuChoix('nat-v', 'Aide U', 1000), optionAuChoix('nat-w', 'Aide U', 1000)]);
  });

  it("aides non chiffrées en étoile (POEI au centre, comme dans le catalogue) : la POEI est retenue, la POEC et la POEI régionale sont des options", () => {
    const aides = evaluer([
      makeAide({ id: 'nat-poec', nom: 'POEC', montant: montantNonChiffre, cumul: { cumulable: true, alternatives: ['nat-poei'] } }),
      makeAide({
        id: 'nat-poei', nom: 'POEI', montant: montantNonChiffre,
        cumul: { cumulable: true, alternatives: ['nat-poec', 'r52-poei-region'] },
      }),
      makeAide({ id: 'r52-poei-region', nom: 'POEI régionale', montant: montantNonChiffre, cumul: { cumulable: true, alternatives: ['nat-poei'] } }),
    ]);
    const plan = construirePlan(null, aides, profil);
    expect(plan.nonChiffrees.map((a) => a.id)).toEqual(['nat-poei']);
    expect(plan.options.map((o) => [o.id, o.raison])).toEqual([
      ['nat-poec', 'Au choix avec « POEI »'],
      ['r52-poei-region', 'Au choix avec « POEI »'],
    ]);
  });
});

describe("construirePlan, un solde CPF ne finance qu'une fois", () => {
  const FINANCEUR_CPF = 'Compte personnel de formation';
  /** Aide qui prélève sur le solde CPF (mode solde_cpf) : financeur CPF, donc ordre d'empilement 90 par défaut. */
  const surSolde = (id: string, over: Partial<Aide> = {}) =>
    makeAide({ id, nom: `Aide ${id}`, financeur: 'cpf', financeur_nom: FINANCEUR_CPF, montant: montantSoldeCpf, ...over });
  const avecPlafond = (plafond: number) => ({ ...montantSoldeCpf, plafond });
  /** Profil à 4 200 € de coût pédagogique, avec le solde CPF donné. */
  const avecSolde = (soldeCpf: number | null) => makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 0, soldeCpf });

  it("deux aides sur le même solde de 500 € : une seule ligne de 500 €, celle qui passe la première dans l'ordre d'empilement", () => {
    const p = avecSolde(500);
    const aides = evaluerPour(p, [surSolde('nat-cpf'), surSolde('nat-vae', { ordre_empilement: 85 })]);
    expect(aides.map((a) => a.montantEstime)).toEqual([500, 500]); // garde-fou : chacune verserait seule tout le solde
    const plan = construirePlan(null, aides, p);
    expect(plan.financements).toEqual([
      { id: 'nat-vae', nom: 'Aide nat-vae', financeurNom: FINANCEUR_CPF, montant: 500, confidence: 'exact' },
    ]);
    expect(plan).toMatchObject({ totalFinance: 500, resteACharge: 3700 });
  });

  it("à ordre d'empilement égal, c'est la plus grosse qui prélève d'abord et le solde ne finance que le reste", () => {
    const p = avecSolde(800);
    const aides = evaluerPour(p, [
      surSolde('nat-b', { montant: avecPlafond(500) }),
      surSolde('nat-a', { montant: avecPlafond(700) }),
      surSolde('nat-c', { montant: avecPlafond(300) }),
    ]);
    expect(aides.map((a) => [a.id, a.montantEstime])).toEqual([['nat-b', 500], ['nat-a', 700], ['nat-c', 300]]); // 1 500 € si on les additionnait
    const plan = construirePlan(null, aides, p);
    // 700 € d'abord, puis les 100 € qui restent du solde ; la troisième n'a plus rien à prélever (aucune ligne à 0 €).
    expect(paires(plan.financements)).toEqual([['nat-a', 700], ['nat-b', 100]]);
    expect(plan).toMatchObject({ totalFinance: 800, resteACharge: 3400 });
  });

  it("trois aides sur un solde de 800 € : le total des lignes sur le solde ne dépasse jamais 800 €", () => {
    const p = avecSolde(800);
    const plan = construirePlan(null, evaluerPour(p, [surSolde('nat-a'), surSolde('nat-b'), surSolde('nat-c')]), p);
    expect(paires(plan.financements)).toEqual([['nat-a', 800]]);
    expect(plan).toMatchObject({ totalFinance: 800, resteACharge: 3400 });
  });

  it("l'ordre d'empilement l'emporte sur le montant : la petite aide qui passe d'abord prélève sa part, la grande ne reçoit que le reste", () => {
    const p = avecSolde(800);
    const aides = evaluerPour(p, [
      surSolde('nat-a', { montant: avecPlafond(700) }),
      surSolde('nat-b', { montant: avecPlafond(500), ordre_empilement: 95 }),
      surSolde('nat-c', { montant: avecPlafond(300), ordre_empilement: 85 }),
    ]);
    const plan = construirePlan(null, aides, p);
    expect(paires(plan.financements)).toEqual([['nat-c', 300], ['nat-a', 500]]);
    expect(plan).toMatchObject({ totalFinance: 800, resteACharge: 3400 });
  });

  it("deux aides sur le solde qui ne sont pas liées entre elles (elles ne citent que l'aide générale, absente de la liste) partagent le solde", () => {
    const p = avecSolde(800);
    const alternative = { cumulable: true, alternatives: ['nat-cpf'] };
    const plan = construirePlan(
      null,
      evaluerPour(p, [surSolde('nat-vae', { cumul: alternative }), surSolde('nat-clea', { cumul: alternative })]),
      p,
    );
    expect(paires(plan.financements)).toEqual([['nat-vae', 800]]);
    expect(plan).toMatchObject({ totalFinance: 800, resteACharge: 3400 });
  });

  it("étoile du catalogue (nat-vae, nat-bilan-competences et nat-clea ne citent que nat-cpf) : nat-cpf est retenue, le solde finance une fois", () => {
    const p = avecSolde(800);
    const citeCpf = { cumulable: true, alternatives: ['nat-cpf'] };
    const aides = evaluerPour(p, [
      surSolde('nat-bilan-competences', { cumul: citeCpf }),
      surSolde('nat-clea', { cumul: citeCpf }),
      surSolde('nat-vae', { cumul: citeCpf }),
      surSolde('nat-cpf'),
    ]);
    const plan = construirePlan(null, aides, p);
    expect(plan.financements).toEqual([
      { id: 'nat-cpf', nom: 'Aide nat-cpf', financeurNom: FINANCEUR_CPF, montant: 800, confidence: 'exact' },
    ]);
    expect(plan.options.map((o) => [o.id, o.raison])).toEqual([
      ['nat-bilan-competences', 'Au choix avec « Aide nat-cpf »'],
      ['nat-clea', 'Au choix avec « Aide nat-cpf »'],
      ['nat-vae', 'Au choix avec « Aide nat-cpf »'],
    ]);
    expect(plan).toMatchObject({ totalFinance: 800, resteACharge: 3400 });
  });

  it("le reste à charge borne aussi l'aide sur le solde : 500 € de solde, 300 € restant à financer → 300 €", () => {
    const p = avecSolde(500);
    const plan = construirePlan(null, evaluerPour(p, [forfait('nat-etat', 'etat', 3900), surSolde('nat-cpf')]), p);
    expect(paires(plan.financements)).toEqual([['nat-etat', 3900], ['nat-cpf', 300]]);
    expect(plan).toMatchObject({ totalFinance: 4200, resteACharge: 0 });
  });

  // 3 700 € déjà financés par l'État : il reste 500 € à financer ; le solde est juste au-dessous, égal, ou au-dessus.
  it.each([
    [499.99, 499.99, 0.01],
    [500, 500, 0],
    [500.01, 500, 0],
  ])('frontière entre le solde et le reste à charge : solde de %s € → ligne de %s €, reste à charge de %s €', (solde, ligne, reste) => {
    const p = avecSolde(solde);
    const plan = construirePlan(null, evaluerPour(p, [forfait('nat-etat', 'etat', 3700), surSolde('nat-cpf')]), p);
    expect(paires(plan.financements)).toEqual([['nat-etat', 3700], ['nat-cpf', ligne]]);
    expect(plan.resteACharge).toBe(reste);
  });

  it("une aide du financeur CPF qui ne prélève pas sur le solde (abondement de l'employeur, forfait) s'empile EN PLUS du solde", () => {
    const p = avecSolde(500);
    const solde = surSolde('nat-cpf');
    // À ordre égal (90) : le solde (500 €) d'abord, puis le forfait (150 €) : le solde épuisé ne le borne pas.
    const apres = construirePlan(null, evaluerPour(p, [forfait('nat-abondement', 'cpf', 150), solde]), p);
    expect(paires(apres.financements)).toEqual([['nat-cpf', 500], ['nat-abondement', 150]]);
    expect(apres).toMatchObject({ totalFinance: 650, resteACharge: 3550 });
    // Passant avant le solde (ordre 80) : le forfait ne consomme rien du solde, qui finance encore ses 500 €.
    const avant = construirePlan(null, evaluerPour(p, [solde, forfait('nat-abondement', 'cpf', 150, { ordre_empilement: 80 })]), p);
    expect(paires(avant.financements)).toEqual([['nat-abondement', 150], ['nat-cpf', 500]]);
    expect(avant).toMatchObject({ totalFinance: 650, resteACharge: 3550 });
  });

  it("c'est le mode de calcul qui compte, pas le financeur : une aide sur le solde d'un autre financeur partage le même solde", () => {
    const p = avecSolde(500);
    const aides = evaluerPour(p, [
      surSolde('nat-cpf'),
      surSolde('r11-solde', { financeur: 'region', financeur_nom: 'Région', ordre_empilement: 85 }),
    ]);
    const plan = construirePlan(null, aides, p);
    expect(plan.financements).toEqual([{ id: 'r11-solde', nom: 'Aide r11-solde', financeurNom: 'Région', montant: 500, confidence: 'exact' }]);
    expect(plan).toMatchObject({ totalFinance: 500, resteACharge: 3700 });
  });

  it("les autres financements (ligne OPCO, dispositif complémentaire, aide de la Région) ne consomment pas le solde CPF", () => {
    const p = avecSolde(800);
    const opco = resultatOpco([posteOpco('pedagogie', 1000)], [dispositif('additif', 'additif', 400)]);
    const plan = construirePlan(opco, evaluerPour(p, [forfait('r11-region', 'region', 700), surSolde('nat-cpf')]), p);
    expect(paires(plan.financements)).toEqual([
      ['opco-pdc', 1000],
      ['opco-additif', 400],
      ['r11-region', 700],
      ['nat-cpf', 800],
    ]);
  });

  it("solde CPF inconnu : les aides sur le solde n'ont pas de montant, elles vont dans nonChiffrees et ne créent aucune ligne", () => {
    const p = avecSolde(null);
    const aides = evaluerPour(p, [surSolde('nat-cpf'), surSolde('nat-vae')]);
    expect(aides.map((a) => a.montantEstime)).toEqual([null, null]);
    const plan = construirePlan(null, aides, p);
    expect(plan.nonChiffrees.map((a) => a.id)).toEqual(['nat-cpf', 'nat-vae']);
    expect(plan).toMatchObject({ financements: [], totalFinance: 0, resteACharge: 4200 });
  });

  it('solde CPF connu et nul : des aides chiffrées à 0 €, aucune ligne', () => {
    const p = avecSolde(0);
    const aides = evaluerPour(p, [surSolde('nat-cpf'), surSolde('nat-vae')]);
    expect(aides.map((a) => a.montantEstime)).toEqual([0, 0]);
    const plan = construirePlan(null, aides, p);
    expect(plan).toMatchObject({ financements: [], nonChiffrees: [], totalFinance: 0, resteACharge: 4200 });
  });

  it("le plan lit le solde dans le profil : rien n'est prélevé au-delà, et rien du tout quand le profil ne le connaît pas", () => {
    const aide = evaluerPour(avecSolde(500), [surSolde('nat-cpf')])[0]; // chiffrée à 500 €
    expect(aide.montantEstime).toBe(500);
    expect(paires(construirePlan(null, [aide], avecSolde(500)).financements)).toEqual([['nat-cpf', 500]]);
    expect(paires(construirePlan(null, [aide], avecSolde(300)).financements)).toEqual([['nat-cpf', 300]]);
    expect(construirePlan(null, [aide], avecSolde(0)).financements).toEqual([]);
    expect(construirePlan(null, [aide], avecSolde(null)).financements).toEqual([]);
  });
});

describe('construirePlan, arrondi au centime', () => {
  const troisDixiemes = makeProfil({ coutPedagogique: 0.1, coutFraisAnnexes: 0.2 });
  const unEuro = makeProfil({ coutPedagogique: 1, coutFraisAnnexes: 0 });

  it('le coût de la formation est arrondi au centime (0,1 + 0,2 = 0,3)', () => {
    expect(construirePlan(null, [], troisDixiemes).coutFormation).toBe(0.3);
  });

  it('le reste à charge et le total financé sont arrondis au centime (0,3 − 0,2 = 0,1)', () => {
    const plan = construirePlan(null, evaluerPour(troisDixiemes, [forfait('nat-b', 'etat', 0.2)]), troisDixiemes);
    expect(plan).toMatchObject({ totalFinance: 0.2, resteACharge: 0.1 });
  });

  it('deux aides de 0,1 € et 0,2 € totalisent 0,3 € (1 − 0,7 sans bruit de virgule flottante)', () => {
    const plan = construirePlan(null, evaluerPour(unEuro, [forfait('r11-a', 'region', 0.1), forfait('nat-b', 'etat', 0.2)]), unEuro);
    expect(paires(plan.financements)).toEqual([
      ['r11-a', 0.1],
      ['nat-b', 0.2],
    ]);
    expect(plan).toMatchObject({ totalFinance: 0.3, resteACharge: 0.7 });
  });

  it('la ligne OPCO somme les postes financés au centime (0,1 + 0,2 = 0,3)', () => {
    const opco = resultatOpco([posteOpco('pedagogie', 0.1), posteOpco('hebergement', 0.2)]);
    expect(construirePlan(opco, [], profil).financements).toEqual([expect.objectContaining({ id: 'opco-pdc', montant: 0.3 })]);
  });

  it("la somme OPCO arrondie sert aussi au tri : 0,7 + 0,1 est à égalité avec une aide de 0,8 € du même ordre (l'OPCO d'abord)", () => {
    const opco = resultatOpco([posteOpco('pedagogie', 0.7), posteOpco('hebergement', 0.1)]); // 0,7 + 0,1 = 0,7999999999999999
    const plan = construirePlan(opco, evaluer([forfait('nat-opco', 'opco', 0.8)]), profil);
    expect(paires(plan.financements)).toEqual([
      ['opco-pdc', 0.8],
      ['nat-opco', 0.8],
    ]);
  });

  it('un montant non arrondi fourni par une aide est arrondi au centime sur la ligne empilée (0,1 + 0,2)', () => {
    const aide: AideEvaluee = { ...evaluer([forfait('nat-a', 'etat', 1)])[0], montantEstime: 0.1 + 0.2 };
    const plan = construirePlan(null, [aide], profil);
    expect(paires(plan.financements)).toEqual([['nat-a', 0.3]]);
    expect(plan).toMatchObject({ totalFinance: 0.3, resteACharge: 4199.7 });
  });
});

describe('construirePlan, calcul OPCO', () => {
  const coutDe4500 = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 300 });

  it('pédagogie, hébergement, restauration et frais annexes financés forment UNE ligne opco-pdc : la somme des montants financés', () => {
    const opco = resultatOpco([
      posteOpco('pedagogie', 3000, 'exact', 4200), // 1 200 € restent à charge sur la pédagogie : seul le financé compte
      posteOpco('hebergement', 200, 'exact', 250),
      posteOpco('restauration', 100, 'exact', 150),
      posteOpco('frais_annexes', 50),
    ]);
    const plan = construirePlan(opco, [], coutDe4500);
    expect(plan.financements).toEqual([
      { id: 'opco-pdc', nom: 'Plan de développement des compétences', financeurNom: NOM_OPCO, montant: 3350, confidence: 'exact' },
    ]);
    expect(plan).toMatchObject({ coutFormation: 4500, totalFinance: 3350, resteACharge: 1150 });
  });

  it("les salaires et le transport financés sont des aides à l'employeur, jamais un financement de la formation", () => {
    const opco = resultatOpco([
      posteOpco('pedagogie', 3000),
      posteOpco('salaires', 1200, 'estimated', 1500), // seul le montant financé compte
      posteOpco('transport', 80, 'depends_on_branche', 120),
    ]);
    const plan = construirePlan(opco, [], coutDe4500);
    // La fiabilité de la ligne de formation ne dépend pas des salaires (estimés) ni du transport (dépend de la branche).
    expect(plan.financements).toEqual([
      { id: 'opco-pdc', nom: 'Plan de développement des compétences', financeurNom: NOM_OPCO, montant: 3000, confidence: 'exact' },
    ]);
    expect(plan.aidesEmployeur).toEqual([
      {
        id: 'opco-salaires', nom: 'Prise en charge des salaires pendant la formation', financeurNom: NOM_OPCO,
        montant: 1200, confidence: 'estimated',
      },
      {
        id: 'opco-transport', nom: 'Forfait de frais de transport', financeurNom: NOM_OPCO,
        montant: 80, confidence: 'depends_on_branche',
      },
    ]);
    expect(plan).toMatchObject({ totalFinance: 3000, resteACharge: 1500 });
  });

  it('avec le plafond annuel appliqué, la ligne opco-pdc prend la fiabilité la plus faible de toutes les lignes financées', () => {
    const opco = resultatOpco(
      [
        posteOpco('pedagogie', 3000),
        posteOpco('salaires', 1200, 'estimated', 1500),
        posteOpco('transport', 80, 'depends_on_branche', 120),
      ],
      [],
      { budgetCapApplied: true },
    );
    const plan = construirePlan(opco, [], coutDe4500);
    expect(plan.financements).toEqual([
      {
        id: 'opco-pdc', nom: 'Plan de développement des compétences', financeurNom: NOM_OPCO,
        montant: 3000, confidence: 'depends_on_branche',
      },
    ]);
    // Les aides à l'employeur gardent leur propre fiabilité et leur propre montant.
    expect(plan.aidesEmployeur).toEqual([
      expect.objectContaining({ id: 'opco-salaires', montant: 1200, confidence: 'estimated' }),
      expect.objectContaining({ id: 'opco-transport', montant: 80, confidence: 'depends_on_branche' }),
    ]);
  });

  it('un poste financé à 0 € ne crée aucune ligne : ni opco-pdc, ni salaires, ni transport', () => {
    const opco = resultatOpco([
      posteOpco('pedagogie', 0, 'depends_on_branche', 3000),
      posteOpco('hebergement', 0, 'exact', 200),
      posteOpco('salaires', 0),
      posteOpco('transport', 0),
    ]);
    const plan = construirePlan(opco, [], coutDe4500);
    expect(plan).toMatchObject({ financements: [], aidesEmployeur: [], totalFinance: 0, resteACharge: 4500 });
  });

  // Aucun poste financé ne disparaît du plan. Ces tables sont typées par les unions du moteur : si un poste ou une règle de
  // cumul y est ajouté, ce fichier ne compile plus tant que le plan et le test ne le traitent pas.
  const DESTINATION_POSTE: Record<PosteFinancement, 'financements' | 'aidesEmployeur'> = {
    pedagogie: 'financements',
    hebergement: 'financements',
    restauration: 'financements',
    frais_annexes: 'financements',
    salaires: 'aidesEmployeur',
    transport: 'aidesEmployeur',
  };
  const DESTINATION_DISPOSITIF: Record<DispositifEligible['cumul'], 'financements' | 'options'> = {
    hors_budget: 'financements',
    additif: 'financements',
    alternatif: 'options',
  };

  it.each(Object.entries(DESTINATION_POSTE) as [PosteFinancement, 'financements' | 'aidesEmployeur'][])(
    'le poste %s financé se retrouve dans %s, et seulement là',
    (poste, liste) => {
      const plan = construirePlan(resultatOpco([posteOpco(poste, 100)]), [], coutDe4500);
      expect(plan[liste].map((l) => l.montant)).toEqual([100]);
      expect(plan[liste === 'financements' ? 'aidesEmployeur' : 'financements']).toEqual([]);
      expect(plan.options).toEqual([]);
    },
  );

  it.each(Object.entries(DESTINATION_DISPOSITIF) as [DispositifEligible['cumul'], 'financements' | 'options'][])(
    'un dispositif %s chiffré se retrouve dans %s, et seulement là',
    (cumul, liste) => {
      const plan = construirePlan(resultatOpco([], [dispositif('d', cumul, 250)]), [], coutDe4500);
      const montants = liste === 'financements' ? plan.financements.map((l) => l.montant) : plan.options.map((o) => o.montantEstime);
      expect(montants).toEqual([250]);
      expect(liste === 'financements' ? plan.options : plan.financements).toEqual([]);
    },
  );

  // Fiabilité de opco-pdc : la plus faible (exact < estimated < depends_on_branche) des postes de FORMATION financés
  // (pédagogie, hébergement, restauration, frais annexes) ; un poste à 0 € est ignoré. Les salaires et le transport sont
  // présentés à part, avec leur propre fiabilité : ils n'entrent pas dans cette ligne, sauf quand le plafond annuel global a
  // été appliqué. Le calcul rééchelonne alors chaque ligne avec un même ratio : le montant de formation dépend aussi de
  // l'estimation des salaires, donc toutes les lignes financées comptent (la troisième colonne est `budgetCapApplied`).
  it.each<[string, FundingLine[], boolean, Confidence]>([
    ['tous exacts', [posteOpco('pedagogie', 1000), posteOpco('hebergement', 100)], false, 'exact'],
    ['une pédagogie estimée', [posteOpco('pedagogie', 1000, 'estimated'), posteOpco('hebergement', 100)], false, 'estimated'],
    ['un hébergement estimé', [posteOpco('pedagogie', 1000), posteOpco('hebergement', 100, 'estimated')], false, 'estimated'],
    ['une restauration estimée', [posteOpco('pedagogie', 1000), posteOpco('restauration', 100, 'estimated')], false, 'estimated'],
    ['des frais annexes estimés', [posteOpco('pedagogie', 1000), posteOpco('frais_annexes', 100, 'estimated')], false, 'estimated'],
    [
      'une pédagogie qui dépend de la branche',
      [posteOpco('pedagogie', 1000, 'depends_on_branche'), posteOpco('restauration', 100)],
      false,
      'depends_on_branche',
    ],
    [
      'un hébergement qui dépend de la branche',
      [posteOpco('pedagogie', 1000), posteOpco('hebergement', 100, 'depends_on_branche')],
      false,
      'depends_on_branche',
    ],
    [
      "estimé puis dépend de la branche : le plus faible l'emporte",
      [posteOpco('pedagogie', 1000, 'estimated'), posteOpco('restauration', 100, 'depends_on_branche')],
      false,
      'depends_on_branche',
    ],
    [
      "dépend de la branche puis estimé : le plus faible l'emporte",
      [posteOpco('pedagogie', 1000, 'depends_on_branche'), posteOpco('restauration', 100, 'estimated')],
      false,
      'depends_on_branche',
    ],
    [
      'un poste non financé (0 €) de fiabilité faible est ignoré',
      [posteOpco('pedagogie', 1000), posteOpco('hebergement', 0, 'depends_on_branche', 200)],
      false,
      'exact',
    ],
    [
      'un poste non financé (0 €) estimé est ignoré',
      [posteOpco('pedagogie', 1000), posteOpco('restauration', 0, 'estimated', 150)],
      false,
      'exact',
    ],
    [
      'des salaires financés et estimés ne comptent pas : ils ne sont pas dans la ligne',
      [posteOpco('pedagogie', 1000), posteOpco('salaires', 300, 'estimated')],
      false,
      'exact',
    ],
    [
      'un transport financé qui dépend de la branche ne compte pas non plus',
      [posteOpco('pedagogie', 1000), posteOpco('transport', 50, 'depends_on_branche')],
      false,
      'exact',
    ],
    [
      'plafond annuel appliqué : des salaires financés et estimés rendent la ligne estimée',
      [posteOpco('pedagogie', 1000), posteOpco('salaires', 300, 'estimated')],
      true,
      'estimated',
    ],
    [
      'plafond annuel appliqué : un transport financé qui dépend de la branche rend la ligne dépendante de la branche',
      [posteOpco('pedagogie', 1000), posteOpco('transport', 50, 'depends_on_branche')],
      true,
      'depends_on_branche',
    ],
    [
      'plafond annuel appliqué : toutes les lignes financées exactes, la ligne reste exacte',
      [posteOpco('pedagogie', 1000), posteOpco('salaires', 300), posteOpco('transport', 50)],
      true,
      'exact',
    ],
    [
      'plafond annuel appliqué : une ligne non financée (0 €) de fiabilité faible reste ignorée',
      [posteOpco('pedagogie', 1000), posteOpco('salaires', 0, 'estimated', 300), posteOpco('transport', 0, 'depends_on_branche', 120)],
      true,
      'exact',
    ],
  ])('fiabilité de opco-pdc : %s', (_cas, lignes, plafondAnnuelApplique, attendue) => {
    const plan = construirePlan(resultatOpco(lignes, [], { budgetCapApplied: plafondAnnuelApplique }), [], coutDe4500);
    expect(plan.financements).toEqual([expect.objectContaining({ id: 'opco-pdc', confidence: attendue })]);
  });

  it('un dispositif alternatif devient une option avec son montant estimé, jamais empilée', () => {
    const opco = resultatOpco(
      [posteOpco('pedagogie', 1000)],
      [dispositif('catalogue', 'alternatif', 2500, { nom: 'Catalogue dédié' }), dispositif('forfait', 'alternatif', null)],
    );
    const plan = construirePlan(opco, [], coutDe4500);
    expect(paires(plan.financements)).toEqual([['opco-pdc', 1000]]);
    expect(plan.options).toEqual([
      {
        id: 'opco-catalogue', nom: 'Catalogue dédié', financeurNom: NOM_OPCO,
        montantEstime: 2500, raison: expect.stringContaining('Alternative'),
      },
      {
        id: 'opco-forfait', nom: 'Dispositif forfait', financeurNom: NOM_OPCO,
        montantEstime: null, raison: expect.stringContaining('Alternative'),
      },
    ]);
    expect(plan.resteACharge).toBe(3500);
  });

  it("un dispositif additif ou hors budget chiffré est empilé à l'ordre 12 : entre les ordres 11 et 13, avant la branche (15)", () => {
    const opco = resultatOpco(
      [posteOpco('pedagogie', 1000)],
      [dispositif('additif', 'additif', 400, { confidence: 'estimated' }), dispositif('hors-budget', 'hors_budget', 600)],
    );
    const aides = evaluer([
      forfait('r11-region', 'region', 200), // 20 par défaut
      forfait('nat-branche', 'branche', 300), // 15 par défaut
      forfait('nat-onze', 'etat', 100, { ordre_empilement: 11 }),
      forfait('nat-treize', 'etat', 1500, { ordre_empilement: 13 }),
    ]);
    const plan = construirePlan(opco, aides, profil);
    // À ordre égal (12), le plus gros montant d'abord.
    expect(paires(plan.financements)).toEqual([
      ['opco-pdc', 1000],
      ['nat-onze', 100],
      ['opco-hors-budget', 600],
      ['opco-additif', 400],
      ['nat-treize', 1500],
      ['nat-branche', 300],
      ['r11-region', 200],
    ]);
    expect(plan.financements.find((l) => l.id === 'opco-additif')).toEqual({
      id: 'opco-additif', nom: 'Dispositif additif', financeurNom: NOM_OPCO, montant: 400, confidence: 'estimated',
    });
    expect(plan.options).toEqual([]);
  });

  it("la ligne opco-pdc a l'ordre 10 des aides du financeur OPCO du catalogue : à ordre égal, la plus grosse d'abord", () => {
    const opco = resultatOpco([posteOpco('pedagogie', 1000)]);
    const aides = evaluer([forfait('nat-opco-petite', 'opco', 500), forfait('nat-opco-grande', 'opco', 1500)]);
    const plan = construirePlan(opco, aides, profil);
    expect(paires(plan.financements)).toEqual([
      ['nat-opco-grande', 1500],
      ['opco-pdc', 1000],
      ['nat-opco-petite', 500],
    ]);
  });

  it('les dispositifs complémentaires sont eux aussi plafonnés au reste à charge', () => {
    const opco = resultatOpco([posteOpco('pedagogie', 4000)], [dispositif('additif', 'additif', 1000)]);
    const plan = construirePlan(opco, [], coutDe4500);
    expect(paires(plan.financements)).toEqual([
      ['opco-pdc', 4000],
      ['opco-additif', 500],
    ]);
    expect(plan).toMatchObject({ totalFinance: 4500, resteACharge: 0 });
  });

  it("un dispositif sans montant chiffré ou à 0 € n'apparaît ni dans le financement ni dans les options", () => {
    const opco = resultatOpco(
      [posteOpco('pedagogie', 1000)],
      [dispositif('non-chiffre', 'additif', null), dispositif('zero', 'hors_budget', 0)],
    );
    const plan = construirePlan(opco, [], coutDe4500);
    expect(paires(plan.financements)).toEqual([['opco-pdc', 1000]]);
    expect(plan.options).toEqual([]);
  });
});

describe('construirePlan, avec le vrai calcul OPCO', () => {
  const sourcee = (value: number) => ({ value, confidence: 'exact' as const, source_url: 'x' });
  const etat = (over: Parameters<typeof makeFormationState>[0] = {}) =>
    makeFormationState({ durationHours: 100, pedagogyCostPerHour: 30, pedagogyCostTotal: 3000, ...over });

  it("hébergement et restauration financés rejoignent la ligne opco-pdc ; le transport va aux aides à l'employeur", () => {
    const funding = calculateFunding(
      makeOpco({
        cout_horaire_inter: sourcee(40), frais_hebergement: sourcee(100), frais_restauration: sourcee(20), frais_transport: sourcee(20),
      }),
      etat({
        needsAccommodation: true, accommodationNights: 2, accommodationCostPerNight: 90,
        needsMeals: true, mealCostPerDay: 15, needsTransport: true, trainingDays: 3,
      }),
    );
    // Pédagogie 3 000 € + hébergement 2 × 90 € + restauration 3 × 15 € ; le transport (3 × 20 €) n'est pas un coût saisi.
    const plan = construirePlan(funding, [], makeProfil({ coutPedagogique: 3000, coutFraisAnnexes: 225 }));
    expect(plan.financements).toEqual([expect.objectContaining({ id: 'opco-pdc', montant: 3225 })]);
    expect(plan.aidesEmployeur).toEqual([expect.objectContaining({ id: 'opco-transport', montant: 60 })]);
    expect(plan).toMatchObject({ totalFinance: 3225, resteACharge: 0 });
  });

  it('le forfait de frais annexes en pourcentage compte dans opco-pdc sans jamais dépasser le coût', () => {
    const funding = calculateFunding(makeOpco({ cout_horaire_inter: sourcee(40), frais_annexes_pourcentage: sourcee(10) }), etat());
    expect(funding.totalFunded).toBe(3300); // garde-fou : pédagogie 3 000 € + forfait de 10 % (300 €)
    const plan = construirePlan(funding, [], makeProfil({ coutPedagogique: 3000, coutFraisAnnexes: 0 }));
    expect(plan.financements).toEqual([expect.objectContaining({ id: 'opco-pdc', montant: 3000 })]);
    expect(plan).toMatchObject({ totalFinance: 3000, resteACharge: 0 });
  });

  describe("fiabilité de opco-pdc quand le barème de salaires de l'OPCO est estimé", () => {
    const opcoSalairesEstimes = (over: Parameters<typeof makeOpco>[0] = {}) =>
      makeOpco({
        cout_horaire_inter: sourcee(40),
        prise_en_charge_salaires: { value: 12, confidence: 'estimated', source_url: 'x' },
        prise_en_charge_salaires_mode: 'euro_par_heure',
        ...over,
      });
    const profil3000 = makeProfil({ coutPedagogique: 3000, coutFraisAnnexes: 0 });

    it('sans plafond annuel appliqué : la pédagogie est exacte, la ligne opco-pdc aussi ; seuls les salaires sont estimés', () => {
      const funding = calculateFunding(opcoSalairesEstimes(), etat());
      // Garde-fous : salaires financés (12 € × 100 h) et estimés, pédagogie exacte, aucun plafond appliqué.
      expect(funding.lines.map((l) => [l.poste, l.fundedAmount, l.confidence])).toEqual(
        expect.arrayContaining([['pedagogie', 3000, 'exact'], ['salaires', 1200, 'estimated']]),
      );
      expect(funding.budgetCapApplied).toBe(false);
      const plan = construirePlan(funding, [], profil3000);
      expect(plan.financements).toEqual([
        { id: 'opco-pdc', nom: 'Plan de développement des compétences', financeurNom: 'Test OPCO', montant: 3000, confidence: 'exact' },
      ]);
      expect(plan.aidesEmployeur).toEqual([expect.objectContaining({ id: 'opco-salaires', montant: 1200, confidence: 'estimated' })]);
    });

    it('avec le plafond annuel global appliqué : chaque ligne est rééchelonnée, la ligne opco-pdc devient estimée', () => {
      const funding = calculateFunding(opcoSalairesEstimes({ budget_annuel_max: sourcee(2000) }), etat());
      // Garde-fous : pédagogie 3 000 € + salaires 1 200 € = 4 200 € ramenés à 2 000 € (même ratio sur chaque ligne).
      expect(funding.budgetCapApplied).toBe(true);
      expect(funding.totalFunded).toBe(2000);
      const plan = construirePlan(funding, [], profil3000);
      expect(plan.financements).toEqual([
        { id: 'opco-pdc', nom: 'Plan de développement des compétences', financeurNom: 'Test OPCO', montant: 1428.57, confidence: 'estimated' },
      ]);
      expect(plan.aidesEmployeur).toEqual([expect.objectContaining({ id: 'opco-salaires', montant: 571.43, confidence: 'estimated' })]);
    });
  });
});

describe('construirePlan, invariants sur des cas pseudo-aléatoires', () => {
  // Générateur déterministe (mulberry32) : les mêmes cas à chaque exécution.
  const generateur = (graine: number) => (): number => {
    graine = (graine + 0x6d2b79f5) | 0;
    let t = Math.imul(graine ^ (graine >>> 15), graine | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  it('le total financé ne dépasse jamais le coût, le reste à charge est positif ou nul et les comptes tombent juste au centime', () => {
    const hasard = generateur(20261005);
    const centimes = (max: number) => Math.round(hasard() * max * 100) / 100;
    const choisir = <T>(valeurs: readonly T[]): T => valeurs[Math.floor(hasard() * valeurs.length)];
    const financeurs = ['region', 'etat', 'cpf', 'agefiph', 'branche', 'europe', 'faf'] as const;
    const categories = [
      'cout_formation', 'cout_formation', 'cout_formation', 'aide_employeur', 'remuneration_beneficiaire', 'avantage_fiscal_social',
    ] as const;
    const statuts = ['actif', 'actif', 'actif', 'a_confirmer', 'suspendu'] as const;
    const ordres = [undefined, 10, 20, 50, 50, 90];

    for (let cas = 0; cas < 300; cas++) {
      const p = makeProfil({ coutPedagogique: centimes(6000), coutFraisAnnexes: centimes(600) });
      const aides = evaluerPour(
        p,
        Array.from({ length: 1 + Math.floor(hasard() * 7) }, (_, k) =>
          forfait(`nat-${k}`, choisir(financeurs), centimes(5000), {
            categorie: choisir(categories),
            statut: choisir(statuts),
            cumul: { cumulable: hasard() < 0.8 },
            ordre_empilement: choisir(ordres),
          }),
        ),
      );
      const plan = construirePlan(null, aides, p);
      const empilables = new Set(
        aides.filter((a) => a.statut === 'eligible' && a.categorie === 'cout_formation' && a.cumulable).map((a) => a.id),
      );
      const somme = plan.financements.reduce((s, l) => s + l.montant, 0);

      expect(plan.resteACharge, `cas ${cas}`).toBeGreaterThanOrEqual(0);
      expect(plan.totalFinance, `cas ${cas}`).toBeLessThanOrEqual(plan.coutFormation);
      expect(plan.totalFinance + plan.resteACharge, `cas ${cas}`).toBeCloseTo(plan.coutFormation, 2);
      expect(somme, `cas ${cas}`).toBeCloseTo(plan.totalFinance, 2);
      for (const ligne of plan.financements) {
        expect(ligne.montant, `cas ${cas} ${ligne.id}`).toBeGreaterThan(0);
        expect(empilables.has(ligne.id), `cas ${cas} ${ligne.id}`).toBe(true);
      }
    }
  });
});

describe('construirePlan, pureté', () => {
  const geler = <T>(valeur: T): T => {
    if (valeur !== null && typeof valeur === 'object') {
      Object.values(valeur).forEach((v) => geler(v));
      Object.freeze(valeur);
    }
    return valeur;
  };

  it('ne modifie ni les aides, ni le calcul OPCO, ni le profil (gelés) et redonne le même plan à chaque appel', () => {
    const opco = geler(
      resultatOpco(
        [posteOpco('pedagogie', 1000), posteOpco('salaires', 300)],
        [dispositif('additif', 'additif', 200), dispositif('alt', 'alternatif', 500)],
      ),
    );
    const aides = geler(
      evaluer([
        forfait('nat-a', 'etat', 700, { cumul: { cumulable: true, alternatives: ['nat-b'] } }),
        forfait('nat-b', 'etat', 900, { cumul: { cumulable: true, alternatives: ['nat-a'] } }),
        forfait('nat-c', 'cpf', 400),
        forfait('nat-d', 'etat', 100, { categorie: 'aide_employeur' }),
        makeAide({ id: 'nat-flou', montant: montantNonChiffre }),
      ]),
    );
    const unProfil = geler(makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 0 }));
    const premier = construirePlan(opco, aides, unProfil);
    expect(paires(premier.financements)).toEqual([
      ['opco-pdc', 1000],
      ['opco-additif', 200],
      ['nat-b', 900],
      ['nat-c', 400],
    ]);
    expect(construirePlan(opco, aides, unProfil)).toEqual(premier);
  });
});
