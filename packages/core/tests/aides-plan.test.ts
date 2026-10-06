import { describe, it, expect } from 'vitest';
import { construirePlan } from '../src/aides/plan';
import { evaluerAide } from '../src/aides/evaluer';
import { calculateFunding } from '../src/calculator';
import type { Aide, AideEvaluee, ProfilAides } from '../src/aides/types';
import type { Confidence, DispositifEligible, FundingLine, FundingResult, PosteFinancement } from '../src/types';
import { makeAide, makeProfil } from './fixtures-aides';
import { makeFormationState, makeOpco } from './fixtures';

const AUJOURDHUI = '2026-10-05';
const profil = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 0 });
const evaluer = (aides: Aide[]) => aides.map((a) => evaluerAide(a, profil, AUJOURDHUI));
const forfait = (id: string, financeur: Aide['financeur'], valeur: number, over: Partial<Aide> = {}) =>
  makeAide({ id, financeur, montant: { ...makeAide().montant, valeur }, ...over });

describe('construirePlan — empilement', () => {
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

describe('construirePlan — alternatives et catégories', () => {
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

describe('construirePlan — intégration du calcul OPCO', () => {
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

// === Tests ajoutés au-delà du brief : ils épinglent les règles du plan (une mutation du code doit les faire échouer) ===

const montantNonChiffre = { ...makeAide().montant, mode: 'non_chiffre' as const, valeur: null };
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
/** Calcul OPCO fabriqué à la main : le plan ne lit que `opcoName`, `lines` et `dispositifsComplementaires`. */
const resultatOpco = (lines: FundingLine[], dispositifsComplementaires: DispositifEligible[] = []): FundingResult => ({
  opcoName: NOM_OPCO,
  opcoSlug: 'opco-de-test',
  opcoEmail: 'contact@example.opco.fr',
  opcoUrl: 'https://example.opco.fr/criteres',
  dispositifPrincipal: 'Plan de développement des compétences (fonds mutualisés OPCO)',
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
});

describe('construirePlan — seules les aides éligibles comptent', () => {
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

describe('construirePlan — coût nul ou inconnu', () => {
  it.each<[string, ProfilAides, number[]]>([
    ['inconnu (null)', makeProfil({ coutPedagogique: null, coutFraisAnnexes: 0 }), [500, 1000]],
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

describe("construirePlan — ordre d'empilement et plafond au reste à charge", () => {
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

  it('un coût négatif (saisie invalide) ne donne jamais un reste à charge négatif ni une ligne de financement', () => {
    const p = makeProfil({ coutPedagogique: -100, coutFraisAnnexes: 0 });
    const plan = construirePlan(null, evaluerPour(p, [forfait('nat-a', 'etat', 500)]), p);
    expect(plan.financements).toEqual([]);
    expect(plan.resteACharge).toBe(0);
  });

  it('le coût comprend les frais annexes : une aide qui couvre tout finance aussi les frais annexes', () => {
    const p = makeProfil({ coutPedagogique: 4200, coutFraisAnnexes: 300 });
    const plan = construirePlan(null, evaluerPour(p, [forfait('nat-a', 'etat', 9000)]), p);
    expect(plan.coutFormation).toBe(4500);
    expect(paires(plan.financements)).toEqual([['nat-a', 4500]]);
    expect(plan).toMatchObject({ totalFinance: 4500, resteACharge: 0 });
  });
});

describe('construirePlan — ce qui ne réduit pas le coût de la formation', () => {
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

describe('construirePlan — aides au choix : détails', () => {
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

  it("quand deux aides retenues sont ses alternatives, l'option nomme la mieux chiffrée", () => {
    const aides = evaluer([
      forfait('nat-a', 'etat', 3000, { nom: 'Aide A' }),
      forfait('nat-c', 'etat', 1000, { nom: 'Aide C' }),
      forfait('nat-b', 'etat', 500, { nom: 'Aide B', cumul: { cumulable: true, alternatives: ['nat-a', 'nat-c'] } }),
    ]);
    const plan = construirePlan(null, aides, profil);
    // a (3000) et c (1000) sont retenues avant b (500), qui est l'alternative des deux : elle nomme la mieux chiffrée.
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

describe('construirePlan — arrondi au centime', () => {
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

describe('construirePlan — calcul OPCO', () => {
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
    expect(paires(plan.financements)).toEqual([['opco-pdc', 3000]]);
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

  // Fiabilité de opco-pdc : la plus faible des postes financés (exact < estimated < depends_on_branche) ; un poste à 0 € est
  // ignoré. Choix prudent du brief : tous les postes financés du calcul comptent, salaires et transport compris.
  it.each<[string, FundingLine[], Confidence]>([
    ['tous exacts', [posteOpco('pedagogie', 1000), posteOpco('hebergement', 100)], 'exact'],
    ['un poste estimé', [posteOpco('pedagogie', 1000), posteOpco('hebergement', 100, 'estimated')], 'estimated'],
    [
      'un poste dépend de la branche',
      [posteOpco('pedagogie', 1000, 'depends_on_branche'), posteOpco('restauration', 100)],
      'depends_on_branche',
    ],
    [
      "estimé puis dépend de la branche : le plus faible l'emporte",
      [posteOpco('pedagogie', 1000, 'estimated'), posteOpco('restauration', 100, 'depends_on_branche')],
      'depends_on_branche',
    ],
    [
      "dépend de la branche puis estimé : le plus faible l'emporte",
      [posteOpco('pedagogie', 1000, 'depends_on_branche'), posteOpco('restauration', 100, 'estimated')],
      'depends_on_branche',
    ],
    [
      'un poste non financé (0 €) de fiabilité faible est ignoré',
      [posteOpco('pedagogie', 1000), posteOpco('hebergement', 0, 'depends_on_branche', 200)],
      'exact',
    ],
    [
      'un poste non financé (0 €) estimé est ignoré',
      [posteOpco('pedagogie', 1000), posteOpco('restauration', 0, 'estimated', 150)],
      'exact',
    ],
    [
      'des salaires financés et estimés comptent aussi',
      [posteOpco('pedagogie', 1000), posteOpco('salaires', 300, 'estimated')],
      'estimated',
    ],
    [
      'un transport financé qui dépend de la branche compte aussi',
      [posteOpco('pedagogie', 1000), posteOpco('transport', 50, 'depends_on_branche')],
      'depends_on_branche',
    ],
  ])('fiabilité de opco-pdc : %s', (_cas, lignes, attendue) => {
    const plan = construirePlan(resultatOpco(lignes), [], coutDe4500);
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

describe('construirePlan — avec le vrai calcul OPCO', () => {
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
});

describe('construirePlan — invariants sur des cas pseudo-aléatoires', () => {
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

describe('construirePlan — pureté', () => {
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
