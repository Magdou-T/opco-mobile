// Écran « Votre plan de financement » : logique de présentation (lib/resultats.ts). Les attentes sont écrites à la main
// (calculs détaillés en commentaire) ; les tirages au hasard ont une graine fixe.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  EMBEDDED_AIDES,
  EMBEDDED_PORTAILS,
  PROJET_LABELS,
  REGIONS,
  createInitialWizardState,
  getEmbeddedOpcoBySlug,
  resolveVarianteBranche,
} from '@opco/core';
import type {
  AideEvaluee,
  AlerteOpco,
  Confidence,
  Financeur,
  FundingLine,
  LignePlan,
  PlanFinancement,
  ProjetType,
  WizardState,
} from '@opco/core';
import { nombreEtUnite } from '../src/lib/format';
import { INSECABLE } from '../src/lib/insecable';
import { coutsDeFormation } from '../src/lib/parcours';
import { etiquettesDeSituation } from '../src/lib/situation';
import {
  aidesNonEligiblesAffichees,
  calculer,
  cartesDuPlan,
  chapeauDetailOpco,
  confianceDOption,
  descriptionBarre,
  enRegion,
  etatEnTete,
  familleCouleur,
  financeurDeLigne,
  groupesAidesVisibles,
  siglesDesTitres,
  libellePart,
  lignesDuDetail,
  montantAffiche,
  nommerAides,
  partFinancee,
  partsBarre,
  replierIdcc,
  sansMontantEstime,
  dispositifAffiche,
  libellesDeLigne,
  relaisDuPlanConventionnel,
  sourcesDeLAide,
  titreNoteOpco,
} from '../src/lib/resultats';
import type { PartBarre } from '../src/lib/resultats';
import {
  ID_DETAIL_OPCO,
  encadrePlanFerme,
  encadreSansFinancement,
  fondsEpuisesSurLePlan,
  planFermeDe,
  raisonPlanFerme,
  rappelsAucunFinancement,
  texteFondsEpuises,
  titreFondsEpuises,
} from '../src/lib/encadres-resultats';

const nb = INSECABLE;

/** Aide évaluée minimale ; chaque test ne précise que ce qui compte pour lui. */
function aide(over: Partial<AideEvaluee> & Pick<AideEvaluee, 'id'>): AideEvaluee {
  return {
    nom: `Aide ${over.id}`,
    financeur: 'autre',
    financeurNom: 'Financeur',
    categorie: 'cout_formation',
    description: '',
    statut: 'eligible',
    raisons: [],
    horsPerimetre: false,
    conditions: [],
    montantEstime: null,
    libelleMontant: '',
    modeMontant: 'forfait',
    cumulable: true,
    alternatives: [],
    noteCumul: null,
    demarches: [],
    urlDemarche: null,
    sources: [],
    derniereVerification: '2026-10-01',
    confidence: 'exact',
    ordreEmpilement: 50,
    ...over,
  };
}

function plan(over: Partial<PlanFinancement>): PlanFinancement {
  return {
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
  };
}

const ligne = (id: string, financeurNom: string, montant: number): LignePlan => ({
  id,
  nom: `Ligne ${id}`,
  financeurNom,
  montant,
  confidence: 'exact',
});

/** Date du jour fixe : le résultat ne dépend pas du jour du test. */
const DATE = '2026-10-07';

/** État du parcours d'un scénario : état de départ, formation en présentiel, réponses du scénario. */
const etat = (over: Partial<WizardState>): WizardState => ({
  ...createInitialWizardState(),
  trainingMode: 'presentiel',
  ...over,
});

/** Un scénario passé par le calcul de l'écran de résultats (`calculer`, le code de l'écran). */
function simuler(over: Partial<WizardState>) {
  const { aidesEvaluees, plan } = calculer(etat(over), DATE);
  return { aides: aidesEvaluees, plan };
}

const SCENARIOS: Record<string, Partial<WizardState>> = {
  akto: {
    projetType: 'formation_salarie', selectedOpcoSlug: 'akto', detectedIdcc: '1516', regionCode: '11', departementCode: '95',
    companySize: 'less_11', contractType: 'cdi', ageBeneficiaire: 35, certificationLevel: 'rncp', formationType: 'certification',
    eligibleCpf: true, durationHours: 140, pedagogyCostTotal: 4200, pedagogyCostPerHour: 30,
  },
  grande: {
    projetType: 'formation_salarie', selectedOpcoSlug: 'atlas', regionCode: '84', companySize: '50_299', effectif: 120,
    contractType: 'cdi', formationType: 'non_certifiante', durationHours: 35, pedagogyCostTotal: 1400, pedagogyCostPerHour: 40,
  },
  demandeur: {
    projetType: 'recrutement_demandeur_emploi', selectedOpcoSlug: 'akto', regionCode: '76', companySize: '11_49',
    inscritFranceTravail: true, ageBeneficiaire: 28, formationType: 'qualification', durationHours: 280, pedagogyCostTotal: 3500,
  },
  apprenti: {
    projetType: 'alternance', selectedOpcoSlug: 'akto', regionCode: '32', companySize: '11_49', typeAlternance: 'apprentissage',
    ageBeneficiaire: 19, niveauFormationVise: 4, formationType: 'qualification', durationHours: 800, pedagogyCostTotal: 7000,
  },
  artisan: {
    projetType: 'formation_dirigeant', regionCode: '53', companySize: 'less_11', statutDirigeant: 'artisan',
    microEntrepreneur: false, ageBeneficiaire: 45, formationType: 'non_certifiante', organismeQualiopi: true,
    // Coût horaire tel que le parcours le pose (coutsDeFormation : 900 € sur 21 h, sans arrondi).
    ...coutsDeFormation(900, 21),
  },
};

/** mulberry32 : tirages indépendants et reproductibles. */
function generateur(graine: number) {
  let etat = graine;
  return (n: number) => {
    etat = (etat + 0x6d2b79f5) | 0;
    let t = Math.imul(etat ^ (etat >>> 15), 1 | etat);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
}

const TOUS_LES_FINANCEURS: Financeur[] = [
  'etat', 'region', 'departement', 'france_travail', 'transitions_pro', 'agefiph', 'europe', 'cpf', 'opco', 'faf', 'fiscal',
  'branche', 'autre',
];

describe("calcul de l'écran (calculer)", () => {
  const TOUS_LES_PROJETS: ProjetType[] = [
    'formation_salarie',
    'reconversion_salarie',
    'recrutement_demandeur_emploi',
    'alternance',
    'formation_dirigeant',
  ];

  test("plan de développement des compétences de l'OPCO pour former ou reconvertir un salarié seulement, même avec un OPCO connu", () => {
    const attendu: Record<ProjetType, boolean> = {
      formation_salarie: true,
      reconversion_salarie: true,
      recrutement_demandeur_emploi: false,
      alternance: false,
      formation_dirigeant: false,
    };
    for (const projet of TOUS_LES_PROJETS) {
      const r = calculer(etat({ ...SCENARIOS.akto, projetType: projet, statutDirigeant: 'assimile_salarie' }), DATE);
      assert.equal(r.opco?.slug, 'akto', projet);
      assert.equal(r.funding != null, attendu[projet], projet);
      assert.equal(r.plan.financements.some((l) => l.id === 'opco-pdc'), attendu[projet], projet);
    }
    // Scénarios 3 et 4 (demandeur d'emploi, alternance) : AKTO est connu, son plan n'est pas calculé.
    for (const nom of ['demandeur', 'apprenti']) {
      const r = calculer(etat(SCENARIOS[nom]), DATE);
      assert.ok(r.opco, nom);
      assert.equal(r.funding, null, nom);
    }
  });

  test('projet non choisi : celui de « former un salarié »', () => {
    const r = calculer(etat({ ...SCENARIOS.akto, projetType: null }), DATE);
    assert.equal(r.projet, 'formation_salarie');
    assert.ok(r.funding);
  });

  test("OPCO retenu : le choix de l'utilisateur, sinon celui détecté ; aucun : aucun calcul de l'OPCO", () => {
    const base = { ...SCENARIOS.akto, selectedOpcoSlug: null };
    assert.equal(calculer(etat({ ...base, selectedOpcoSlug: 'atlas', detectedOpcoSlug: 'akto' }), DATE).funding?.opcoName, 'ATLAS');
    assert.equal(calculer(etat({ ...base, detectedOpcoSlug: 'akto' }), DATE).funding?.opcoName, 'AKTO');
    const sans = calculer(etat(base), DATE);
    assert.equal(sans.opco, undefined);
    assert.equal(sans.funding, null);
  });

  test('jours de formation non saisis : 7 heures par jour, comme une saisie de ce nombre de jours', () => {
    // Repas à 20 € par jour : 140 h font 20 jours, donc 400 € de repas comptés par l'OPCO et par le profil des aides.
    const repas = { ...SCENARIOS.akto, needsMeals: true, mealCostPerDay: 20 };
    const deduit = calculer(etat(repas), DATE);
    const saisi = calculer(etat({ ...repas, trainingDays: 20 }), DATE);
    assert.equal(deduit.profil.coutFraisAnnexes, 400);
    assert.deepEqual(deduit.funding, saisi.funding);
    assert.deepEqual(deduit.plan, saisi.plan);
  });

  test("date de référence des aides : le début de formation s'il est futur, sinon la date du jour", () => {
    // L'aide exceptionnelle à l'apprentissage (PME, niveau 5) prend fin le 31/12/2026.
    const id = 'nat-aide-exceptionnelle-apprentissage-pme-niveau5';
    const apprenti = { ...SCENARIOS.apprenti, niveauFormationVise: 5 as const };
    const statut = (debut: string | null, jour: string) =>
      calculer(etat({ ...apprenti, dateDebutFormation: debut }), jour).aidesEvaluees.find((a) => a.id === id);
    assert.notEqual(statut(null, DATE)?.statut, 'non_eligible');
    const futur = statut('2027-03', DATE);
    assert.equal(futur?.statut, 'non_eligible');
    assert.ok(futur?.raisons.some((r) => r.includes('terminé le 31/12/2026')), futur?.raisons.join(' | '));
    // Un début déjà passé ne compte pas : la date du jour fait référence.
    assert.notEqual(statut('2026-01', DATE)?.statut, 'non_eligible');
  });

  test("portail officiel de la région de l'entreprise ; aucun sans région", () => {
    assert.equal(calculer(etat(SCENARIOS.akto), DATE).portail?.region, '11');
    assert.equal(calculer(etat(SCENARIOS.artisan), DATE).portail?.nom_region, 'Bretagne');
    assert.equal(calculer(etat({ ...SCENARIOS.akto, regionCode: null }), DATE).portail, null);
  });
});

describe("étiquettes de la situation en tête de l'écran (etiquettesDeSituation, lot initial)", () => {
  test('les cinq scénarios', () => {
    const attendu: Record<string, string[]> = {
      akto: ['Former un salarié', 'AKTO', 'Île-de-France', `140${nb}h`],
      grande: ['Former un salarié', 'ATLAS', 'Auvergne-Rhône-Alpes', `35${nb}h`],
      demandeur: ["Recruter et former un demandeur d'emploi", 'AKTO', 'Occitanie', `280${nb}h`],
      apprenti: ['Recruter en alternance', 'AKTO', 'Hauts-de-France', `800${nb}h`],
      artisan: ['Former le dirigeant', 'Bretagne', `21${nb}h`],
    };
    for (const [nom, parcours] of Object.entries(SCENARIOS)) assert.deepEqual(etiquettesDeSituation(etat(parcours)), attendu[nom], nom);
  });

  test('durée : milliers séparés et unité insécable, comme au récapitulatif (« 1 500 h », jamais « 1500 h »)', () => {
    const fine = String.fromCharCode(0x202f);
    assert.deepEqual(etiquettesDeSituation(etat({ durationHours: 1500 })), ['Former un salarié', `1${fine}500${nb}h`]);
    assert.equal(nombreEtUnite(1500, 'h'), `1${fine}500${nb}h`);
    assert.equal(nombreEtUnite(24, 'mois'), `24${nb}mois`);
    // Une durée décimale garde sa virgule (Intl, fr-FR).
    assert.equal(nombreEtUnite(3.5, 'h'), `3,5${nb}h`);
  });

  test('projet non choisi : « Former un salarié » ; OPCO choisi, sinon détecté ; région inconnue ou durée vide : rien', () => {
    // Code de région que le moteur ne reconnaît pas (estCodeRegion) : ni étiquette ni portail.
    const perime = '99' as WizardState['regionCode'];
    assert.deepEqual(etiquettesDeSituation(etat({ selectedOpcoSlug: 'atlas', detectedOpcoSlug: 'akto' })), ['Former un salarié', 'ATLAS']);
    assert.deepEqual(etiquettesDeSituation(etat({ detectedOpcoSlug: 'akto', regionCode: perime })), ['Former un salarié', 'AKTO']);
    assert.deepEqual(etiquettesDeSituation(etat({ selectedOpcoSlug: 'inconnu', durationHours: 0 })), ['Former un salarié']);
  });

  test('400 états tirés au hasard (graine 5) : mêmes projet, OPCO et région que le calcul de l’écran', () => {
    const hasard = generateur(5);
    const un = <T,>(l: readonly T[]): T => l[hasard(l.length)];
    const projets: (ProjetType | null)[] = [null, 'formation_salarie', 'reconversion_salarie', 'recrutement_demandeur_emploi', 'alternance', 'formation_dirigeant'];
    for (let i = 0; i < 400; i++) {
      const state = etat({
        projetType: un(projets),
        selectedOpcoSlug: un([null, 'akto', 'atlas', 'opcommerce', 'inconnu']),
        detectedOpcoSlug: un([null, 'uniformation', 'afdas']),
        regionCode: un([null, '11', '53', '04', '99'] as WizardState['regionCode'][]),
        durationHours: un([null, 0, 21, 140]),
        pedagogyCostTotal: 1000,
      });
      const r = calculer(state, DATE);
      const attendu = [
        PROJET_LABELS[r.projet].label,
        r.opco?.name,
        r.profil.regionEntreprise ? REGIONS[r.profil.regionEntreprise] : null,
        state.durationHours ? `${state.durationHours}${nb}h` : null,
      ].filter((e): e is string => !!e);
      assert.deepEqual(etiquettesDeSituation(state), attendu, JSON.stringify(state));
    }
  });
});

describe('familles de couleur', () => {
  test('chaque financeur a sa famille (table fixée dans DESIGN.md, section 15)', () => {
    const attendu: Record<Financeur, string> = {
      opco: 'opco',
      branche: 'opco',
      faf: 'faf',
      cpf: 'cpf',
      region: 'region',
      departement: 'region',
      etat: 'etat',
      france_travail: 'etat',
      europe: 'europe',
      transitions_pro: 'autre',
      agefiph: 'autre',
      fiscal: 'autre',
      autre: 'autre',
    };
    for (const f of TOUS_LES_FINANCEURS) assert.equal(familleCouleur(f), attendu[f], f);
  });

  test("financeur d'une ligne du plan : l'aide du catalogue, sinon l'OPCO pour les lignes « opco-… »", () => {
    const aides = [aide({ id: 'r76-x', financeur: 'region' }), aide({ id: 'nat-cpf', financeur: 'cpf' })];
    assert.equal(financeurDeLigne('r76-x', aides), 'region');
    assert.equal(financeurDeLigne('nat-cpf', aides), 'cpf');
    assert.equal(financeurDeLigne('opco-pdc', aides), 'opco');
    assert.equal(financeurDeLigne('opco-fne', aides), 'opco');
    assert.equal(financeurDeLigne('inconnue', aides), 'autre');
    // Une aide du catalogue l'emporte sur le préfixe.
    assert.equal(financeurDeLigne('opco-y', [aide({ id: 'opco-y', financeur: 'europe' })]), 'europe');
  });
});

describe("état de l'en-tête", () => {
  test('coût inconnu, aucun financement chiffré, plan chiffré', () => {
    assert.equal(etatEnTete(plan({ coutFormation: 0 })), 'cout_inconnu');
    assert.equal(etatEnTete(plan({ coutFormation: Number.NaN })), 'cout_inconnu');
    // Coût inconnu même si une ligne traînait : jamais de « Financé » sur un coût de 0 €.
    assert.equal(etatEnTete(plan({ coutFormation: 0, financements: [ligne('a', 'X', 10)], totalFinance: 10 })), 'cout_inconnu');
    assert.equal(etatEnTete(plan({ coutFormation: 3500, resteACharge: 3500 })), 'aucun_financement_chiffre');
    assert.equal(etatEnTete(plan({ coutFormation: 3500, financements: [ligne('a', 'X', 0)], totalFinance: 0 })), 'aucun_financement_chiffre');
    assert.equal(
      etatEnTete(plan({ coutFormation: 900, financements: [ligne('faf', 'FAFCEA', 735)], totalFinance: 735, resteACharge: 165 })),
      'plan_chiffre',
    );
  });

  test('les cinq scénarios', () => {
    const attendu: Record<string, string> = {
      akto: 'plan_chiffre',
      grande: 'aucun_financement_chiffre',
      demandeur: 'aucun_financement_chiffre',
      apprenti: 'aucun_financement_chiffre',
      artisan: 'plan_chiffre',
    };
    for (const [nom, parcours] of Object.entries(SCENARIOS)) assert.equal(etatEnTete(simuler(parcours).plan), attendu[nom], nom);
  });
});

describe('barre empilée', () => {
  const sansAides: AideEvaluee[] = [];

  test('scénario 1 : AKTO couvre tout le coût, aucune part de reste à charge', () => {
    const { plan: p, aides } = simuler(SCENARIOS.akto);
    assert.deepEqual(partsBarre(p, aides), [{ cle: 'opco', libelle: 'AKTO', montant: 4200, part: 100 }]);
  });

  test('scénario 1 à 90 €/h avec 800 € de CPF : une part par famille, la somme vaut 100', () => {
    const { plan: p, aides } = simuler({ ...SCENARIOS.akto, pedagogyCostPerHour: 90, pedagogyCostTotal: 12600, soldeCpf: 800 });
    // AKTO 8 400 € ; CPF 800 € (la dotation de l'employeur est son propre argent : listée sans montant, jamais une part) ;
    // reste 3 400 €, sur 12 600 €. Parts exactes 66,67 / 6,35 / 26,98 : arrondis inférieurs 66 + 6 + 26 = 98 ; les deux points
    // restants vont aux plus grandes décimales (0,98 puis 0,67) : 67 / 6 / 27.
    assert.deepEqual(partsBarre(p, aides), [
      { cle: 'opco', libelle: 'AKTO', montant: 8400, part: 67 },
      { cle: 'cpf', libelle: 'Compte personnel de formation', montant: 800, part: 6 },
      { cle: 'reste', libelle: 'Reste à charge', montant: 3400, part: 27 },
    ]);
  });

  test('scénario 5 : fonds d’assurance formation et reste à charge', () => {
    const { plan: p, aides } = simuler(SCENARIOS.artisan);
    // 735 / 900 = 81,67 % et 165 / 900 = 18,33 % : 81 + 18 = 99, le point restant va à 0,67 : 82 / 18.
    assert.deepEqual(partsBarre(p, aides), [
      { cle: 'faf', libelle: 'FAFCEA', montant: 735, part: 82 },
      { cle: 'reste', libelle: 'Reste à charge', montant: 165, part: 18 },
    ]);
  });

  test('coût inconnu : aucune part ; aucun financement : le reste à charge seul', () => {
    assert.deepEqual(partsBarre(plan({ coutFormation: 0 }), sansAides), []);
    assert.deepEqual(partsBarre(plan({ coutFormation: 1400, resteACharge: 1400 }), sansAides), [
      { cle: 'reste', libelle: 'Reste à charge', montant: 1400, part: 100 },
    ]);
  });

  test("égalités : trois tiers, le point restant va à la première part ; une part sous 1 % peut valoir 0", () => {
    const aides = [aide({ id: 'r', financeur: 'region', financeurNom: 'Région Occitanie' }), aide({ id: 'c', financeur: 'cpf' })];
    const tiers = partsBarre(plan({ coutFormation: 300, financements: [ligne('r', 'Région Occitanie', 100), ligne('c', 'Caisse', 100)] }), aides);
    assert.deepEqual(tiers.map((x) => [x.cle, x.part]), [['region', 34], ['cpf', 33], ['reste', 33]]);
    const minuscule = partsBarre(plan({ coutFormation: 10000, financements: [ligne('r', 'Région Occitanie', 20)] }), aides);
    assert.deepEqual(minuscule.map((x) => [x.cle, x.montant, x.part]), [['region', 20, 0], ['reste', 9980, 100]]);
  });

  test('défense : une ligne au-delà du coût est plafonnée, une ligne négative ou nulle est ignorée', () => {
    const aides = [aide({ id: 'a', financeur: 'region' }), aide({ id: 'b', financeur: 'cpf' }), aide({ id: 'c', financeur: 'etat' })];
    const parts = partsBarre(
      plan({ coutFormation: 1000, financements: [ligne('a', 'X', 800), ligne('c', 'Z', -50), ligne('b', 'Y', 500)] }),
      aides,
    );
    assert.deepEqual(parts.map((x) => [x.cle, x.montant, x.part]), [['region', 800, 80], ['cpf', 200, 20]]);
  });

  test('libellé : le nom commun du financeur s’il est court, sinon celui de la famille', () => {
    const aides = [
      aide({ id: 'r1', financeur: 'region' }),
      aide({ id: 'r2', financeur: 'departement' }),
      aide({ id: 'e', financeur: 'etat' }),
    ];
    const parts = partsBarre(
      plan({
        coutFormation: 1000,
        financements: [ligne('r1', 'Région Bretagne', 100), ligne('r2', 'Département du Finistère', 100), ligne('e', 'État', 100)],
      }),
      aides,
    );
    assert.deepEqual(parts.map((x) => x.libelle), ['Région', 'État', 'Reste à charge']);
  });

  test('2 000 plans tirés au hasard (graine 31) : parts entières, somme 100, reste complément du coût', () => {
    const hasard = generateur(31);
    const aides = TOUS_LES_FINANCEURS.map((f) => aide({ id: `id-${f}`, financeur: f }));
    for (let i = 0; i < 2000; i++) {
      const coutCentimes = 1 + hasard(5_000_000);
      let restant = coutCentimes;
      const financements: LignePlan[] = [];
      for (let k = hasard(7); k > 0; k--) {
        const centimes = hasard(restant + 1);
        restant -= centimes;
        financements.push(ligne(`id-${TOUS_LES_FINANCEURS[hasard(TOUS_LES_FINANCEURS.length)]}`, `F${k}`, centimes / 100));
      }
      const p = plan({ coutFormation: coutCentimes / 100, financements });
      const parts = partsBarre(p, aides);
      const contexte = JSON.stringify({ coutCentimes, financements: financements.map((l) => [l.id, l.montant]) });
      assert.equal(parts.reduce((s, x) => s + x.part, 0), 100, contexte);
      const totalCentimes = parts.reduce((s, x) => s + Math.round(x.montant * 100), 0);
      assert.equal(totalCentimes, coutCentimes, contexte);
      for (const x of parts) {
        assert.ok(Number.isInteger(x.part) && x.part >= 0 && x.part <= 100, contexte);
        assert.ok(x.montant > 0, `part vide : ${contexte}`);
        assert.ok(Math.abs(x.part - (Math.round(x.montant * 100) * 100) / coutCentimes) < 1, contexte);
      }
      const reste = parts.find((x) => x.cle === 'reste');
      assert.equal(Math.round((reste?.montant ?? 0) * 100), restant, contexte);
      assert.equal(new Set(parts.map((x) => x.cle)).size, parts.length, contexte);
      // Ordre des familles : celui de leur première ligne dans l'empilement, le reste à charge en dernier.
      const ordre = [...new Set(financements.filter((l) => l.montant > 0).map((l) => familleCouleur(financeurDeLigne(l.id, aides))))];
      assert.deepEqual(parts.filter((x) => x.cle !== 'reste').map((x) => x.cle), ordre, contexte);
      if (reste) assert.equal(parts[parts.length - 1], reste, contexte);
    }
  });

  test('part financée sous le chiffre « Financé » : jamais « 100 % » avec un reste, jamais « 0 % » avec un financement', () => {
    const p = (cle: PartBarre['cle'], montant: number, part: number): PartBarre => ({ cle, libelle: cle, montant, part });
    assert.equal(partFinancee([p('opco', 4200, 100)]), `100${nb}% du coût`);
    assert.equal(partFinancee([p('opco', 8400, 67), p('cpf', 950, 7), p('reste', 3250, 26)]), `74${nb}% du coût`);
    assert.equal(partFinancee([p('opco', 9980, 100), p('reste', 20, 0)]), `plus de 99${nb}% du coût`);
    assert.equal(partFinancee([p('region', 20, 0), p('reste', 9980, 100)]), `moins de 1${nb}% du coût`);
    assert.equal(partFinancee([p('reste', 1400, 100)]), null);
    assert.equal(partFinancee([]), null);
  });

  test('libellé de part et description pour les lecteurs d’écran', () => {
    assert.equal(libellePart({ cle: 'opco', libelle: 'AKTO', montant: 8400, part: 67 }), `67${nb}%`);
    assert.equal(libellePart({ cle: 'region', libelle: 'Région', montant: 20, part: 0 }), `moins de 1${nb}%`);
    const parts: PartBarre[] = [
      { cle: 'opco', libelle: 'AKTO', montant: 8400, part: 67 },
      { cle: 'cpf', libelle: 'Compte personnel de formation', montant: 950, part: 7 },
      { cle: 'reste', libelle: 'Reste à charge', montant: 3250, part: 26 },
    ];
    const texte = descriptionBarre(parts, 12600).replace(/\s/g, ' ');
    assert.equal(
      texte,
      'Répartition du coût de la formation (12 600 €) : AKTO, 8 400 €, 67 % ; Compte personnel de formation, 950 €, 7 % ; ' +
        'reste à charge, 3 250 €, 26 %.',
    );
  });
});

describe('aides par financeur', () => {
  const liste = [
    aide({ id: 'r1', financeur: 'region', financeurNom: 'Région Occitanie' }),
    aide({ id: 'f1', financeur: 'france_travail', financeurNom: 'France Travail' }),
    aide({ id: 'r2', financeur: 'region', financeurNom: 'Région Occitanie', statut: 'a_verifier' }),
    aide({ id: 'c1', financeur: 'cpf', financeurNom: 'Caisse des Dépôts', statut: 'non_eligible' }),
    aide({ id: 'c2', financeur: 'cpf', financeurNom: 'Caisse des Dépôts – Mon Compte Formation' }),
    aide({ id: 'c3', financeur: 'cpf', financeurNom: "Caisse des Dépôts – Mon Compte Formation (dotation de l'employeur via l'EDEF)", statut: 'a_verifier' }),
    aide({
      id: 'e1',
      financeur: 'etat',
      financeurNom: 'France compétences (salariés, indépendants) ; France Travail, Apec, Missions locales, Cap emploi',
    }),
    aide({ id: 'h1', financeur: 'agefiph', statut: 'non_eligible', horsPerimetre: true }),
  ];

  test("groupes par famille de financeur, dans l'ordre de la liste évaluée ; jamais d'aide non éligible", () => {
    const groupes = groupesAidesVisibles(liste);
    assert.deepEqual(
      groupes.map((g) => [g.financeur, g.famille, g.titre, g.aides.map((a) => a.id)]),
      [
        ['region', 'region', 'Région Occitanie', ['r1', 'r2']],
        ['france_travail', 'etat', 'France Travail', ['f1']],
        ['cpf', 'cpf', 'Compte personnel de formation', ['c2', 'c3']],
        ['etat', 'etat', 'État', ['e1']],
      ],
    );
  });

  test("titre stable : libellé de la famille pour CPF, État, Europe, OPCO… ; nom propre commun pour Région, FAF, autres", () => {
    const titres = groupesAidesVisibles([
      aide({ id: 'c1', financeur: 'cpf', financeurNom: 'Caisse des Dépôts – Mon Compte Formation' }),
      aide({ id: 'c2', financeur: 'cpf', financeurNom: 'Caisse des Dépôts – Mon Compte Formation' }),
      aide({ id: 'o1', financeur: 'opco', financeurNom: 'OPCO de branche et France Travail' }),
      aide({ id: 'u1', financeur: 'europe', financeurNom: 'Union européenne – FSE+' }),
      aide({ id: 'f1', financeur: 'faf', financeurNom: 'FAFCEA' }),
      aide({ id: 'a1', financeur: 'autre', financeurNom: 'Action Logement' }),
      aide({ id: 'd1', financeur: 'departement', financeurNom: 'Département du Nord' }),
      aide({ id: 'd2', financeur: 'departement', financeurNom: 'Département du Pas-de-Calais' }),
    ]).map((g) => g.titre);
    assert.deepEqual(titres, ['Compte personnel de formation', 'OPCO', 'Union européenne', 'FAFCEA', 'Action Logement', 'Département']);
  });

  test('aucune aide visible : aucun groupe', () => {
    assert.deepEqual(groupesAidesVisibles([aide({ id: 'x', statut: 'non_eligible' })]), []);
  });

  test('non éligibles affichées : hors du périmètre jamais', () => {
    assert.deepEqual(aidesNonEligiblesAffichees(liste).map((a) => a.id), ['c1']);
  });

  test('sigle FSE+ défini une seule fois par écran : dans le titre de la première carte qui le cite', () => {
    const groupes = groupesAidesVisibles([
      aide({ id: 'r1', financeur: 'region', nom: 'Chèque formation régional' }),
      aide({ id: 'u1', financeur: 'europe', nom: 'FSE+ – Cofinancement de la formation des salariés via les OPCO' }),
      aide({ id: 'u2', financeur: 'europe', nom: 'FSE+ – Formations cofinancées par les programmes FEDER-FSE+' }),
      aide({ id: 'x1', financeur: 'autre', nom: 'Aide FSE+X sans le sigle', statut: 'a_verifier' }),
    ]);
    assert.deepEqual([...siglesDesTitres(groupes)], [['u1', { 'FSE+': 'Fonds social européen plus' }]]);
    // Aucune carte ne le cite : rien à définir. Le sigle doit être un mot entier, en capitales.
    assert.equal(siglesDesTitres(groupesAidesVisibles([aide({ id: 'a', nom: 'fse+ ou FSE+X' })])).size, 0);
    assert.equal(siglesDesTitres([]).size, 0);
  });

  test('scénarios réels : le sigle FSE+ est défini dans une carte au plus, celle du premier titre qui le cite', () => {
    let definitions = 0;
    for (const [nom, parcours] of Object.entries(SCENARIOS)) {
      const groupes = groupesAidesVisibles(simuler(parcours).aides);
      const sigles = siglesDesTitres(groupes);
      const premiere = groupes.flatMap((g) => g.aides).find((a) => /(?<![\p{L}\p{N}])FSE\+(?![\p{L}\p{N}])/u.test(a.nom));
      assert.deepEqual([...sigles.keys()], premiere ? [premiere.id] : [], nom);
      definitions += sigles.size;
    }
    assert.ok(definitions > 0, 'aucun scénario ne montre une aide FSE+ : le test ne prouve plus rien');
  });

  test('scénarios réels : chaque aide visible dans un seul groupe, les groupes dans l’ordre de première apparition', () => {
    for (const [nom, parcours] of Object.entries(SCENARIOS)) {
      const { aides } = simuler(parcours);
      const visibles = aides.filter((a) => a.statut !== 'non_eligible');
      const groupes = groupesAidesVisibles(aides);
      assert.deepEqual(groupes.flatMap((g) => g.aides.map((a) => a.id)).sort(), visibles.map((a) => a.id).sort(), nom);
      assert.deepEqual(groupes.map((g) => g.financeur), [...new Set(visibles.map((a) => a.financeur))], nom);
      for (const g of groupes) {
        assert.ok(g.aides.every((a) => a.financeur === g.financeur), nom);
        assert.ok(g.titre.length > 0 && g.titre.length <= 40, `${nom} : ${g.titre}`);
      }
      const nonEligibles = aidesNonEligiblesAffichees(aides);
      assert.ok(nonEligibles.every((a) => a.statut === 'non_eligible' && !a.horsPerimetre), nom);
    }
  });
});

describe("montant d'une aide", () => {
  test("jamais pour une aide non éligible ; « jusqu'à », selon dossier ou aucun montant", () => {
    assert.equal(montantAffiche({ statut: 'non_eligible', montantEstime: 5000 }), null);
    assert.equal(montantAffiche({ statut: 'non_eligible', montantEstime: null }), null);
    assert.deepEqual(montantAffiche({ statut: 'eligible', montantEstime: 1431.94 }), { genre: 'jusqua', montant: 1431.94 });
    assert.deepEqual(montantAffiche({ statut: 'a_verifier', montantEstime: 2000 }), { genre: 'jusqua', montant: 2000 });
    assert.deepEqual(montantAffiche({ statut: 'eligible', montantEstime: null }), { genre: 'selon_dossier' });
    assert.deepEqual(montantAffiche({ statut: 'eligible', montantEstime: 0 }), { genre: 'aucun' });
  });
});

describe('sources d’une aide', () => {
  const sources = [
    { url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F10705', titre: 'CPF d’un salarié - Service Public' },
    { url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F10705', titre: 'CPF d’un salarié - Service Public' },
    { url: 'https://www.moncompteformation.gouv.fr/espace-public/a', titre: 'Mes droits formation' },
    { url: 'https://www.service-public.gouv.fr/particuliers/actualites/A17364', titre: 'Participation forfaitaire' },
    { url: 'pas une adresse', titre: 'Note interne' },
    { url: 'https://moncompteformation.gouv.fr/b', titre: 'Sans www' },
    { url: 'https://financeurs.moncompteformation.gouv.fr/c', titre: 'Espace des financeurs' },
  ];

  test("pages : une fois par adresse, dans l'ordre des données, titre complet", () => {
    assert.deepEqual(
      sourcesDeLAide(sources).pages.map((p) => p.titre),
      ['CPF d’un salarié - Service Public', 'Mes droits formation', 'Participation forfaitaire', 'Note interne', 'Sans www', 'Espace des financeurs'],
    );
  });

  test('sites : un lien par site (sans « www. »), vers sa première page ; adresse illisible : « Source »', () => {
    assert.deepEqual(
      sourcesDeLAide(sources).sites.map((s) => [s.site, s.url]),
      [
        ['service-public.gouv.fr', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F10705'],
        ['moncompteformation.gouv.fr', 'https://www.moncompteformation.gouv.fr/espace-public/a'],
        ['Source', 'pas une adresse'],
        ['financeurs.moncompteformation.gouv.fr', 'https://financeurs.moncompteformation.gouv.fr/c'],
      ],
    );
    assert.deepEqual(sourcesDeLAide([]), { pages: [], sites: [] });
  });

  test('catalogue entier : pages distinctes, sites distincts, chaque site renvoie à une de ses pages', () => {
    let pagesRetirees = 0;
    let sitesMax = 0;
    for (const a of EMBEDDED_AIDES) {
      const { pages, sites } = sourcesDeLAide(a.sources);
      pagesRetirees += a.sources.length - pages.length;
      sitesMax = Math.max(sitesMax, sites.length);
      assert.equal(pages.length, new Set(a.sources.map((s) => s.url)).size, a.id);
      assert.equal(new Set(pages.map((p) => p.url)).size, pages.length, a.id);
      assert.equal(new Set(sites.map((s) => s.site)).size, sites.length, a.id);
      assert.ok(sites.length >= 1 && sites.length <= pages.length, a.id);
      for (const s of sites) assert.ok(pages.some((p) => p.url === s.url), `${a.id} : ${s.url}`);
    }
    assert.ok(pagesRetirees > 100, `seulement ${pagesRetirees} doublons retirés`);
    assert.ok(sitesMax <= 6, `jusqu'à ${sitesMax} sites pour une aide`);
  });
});

describe("identifiants d'aides dans les textes du catalogue", () => {
  const noms = new Map([
    ['nat-cpf', 'Compte personnel de formation (CPF)'],
    ['nat-ptp', 'Projet de transition professionnelle (PTP)'],
    ['nat-ptp-remuneration', 'Rémunération pendant le PTP'],
  ]);

  test('un identifiant connu devient le nom de son aide, entre guillemets', () => {
    assert.equal(
      nommerAides('Levier associé à nat-cpf (le solde reste mobilisé).', noms),
      `Levier associé à «${nb}Compte personnel de formation (CPF)${nb}» (le solde reste mobilisé).`,
    );
    // Le plus long identifiant connu l'emporte sur son préfixe.
    assert.equal(
      nommerAides('Se cumule avec nat-ptp-remuneration ; voir nat-ptp.', noms),
      `Se cumule avec «${nb}Rémunération pendant le PTP${nb}» ; voir «${nb}Projet de transition professionnelle (PTP)${nb}».`,
    );
  });

  test('un identifiant inconnu, un mot ordinaire ou un extrait cité restent tels quels', () => {
    assert.equal(nommerAides('Voir nat-inconnue et nat-cpfx.', noms), 'Voir nat-inconnue et nat-cpfx.');
    assert.equal(nommerAides('Formation natale, signature.', noms), 'Formation natale, signature.');
    assert.equal(nommerAides('« cité : nat-cpf » puis nat-cpf', noms), `« cité : nat-cpf » puis «${nb}Compte personnel de formation (CPF)${nb}»`);
  });

  test("catalogue entier : plus aucun identifiant d'aide dans les textes affichés", () => {
    const nomParId = new Map(EMBEDDED_AIDES.map((a) => [a.id, a.nom]));
    const motif = /\b(?:nat|r\d{2}|ue|faf|fis)-[a-z0-9]+(?:-[a-z0-9]+)*/g;
    let remplaces = 0;
    for (const a of EMBEDDED_AIDES) {
      for (const texte of [a.description, a.cumul.note ?? '', ...a.conditions, ...a.demarches]) {
        const avant = (texte.match(motif) ?? []).filter((m) => nomParId.has(m)).length;
        remplaces += avant;
        const apres = nommerAides(texte, nomParId);
        const restants = (apres.replace(/«[^»]*»/g, '').match(motif) ?? []).filter((m) => nomParId.has(m));
        assert.deepEqual(restants, [], `${a.id} : ${apres}`);
      }
    }
    assert.ok(remplaces >= 40, `seulement ${remplaces} identifiants remplacés`);
  });
});

describe('cartes du plan', () => {
  const plein = plan({
    coutFormation: 1000,
    financements: [ligne('a', 'A', 100)],
    totalFinance: 100,
    resteACharge: 900,
    aidesEmployeur: [ligne('b', 'B', 10)],
    remunerations: [ligne('c', 'C', 10)],
    avantagesFiscauxSociaux: [ligne('d', 'D', 10)],
    options: [{ id: 'e', nom: 'E', financeurNom: 'E', montantEstime: null, raison: 'r' }],
    nonChiffrees: [aide({ id: 'f' })],
    servicesGratuits: [aide({ id: 'g' })],
  });

  test("ordre de la consigne quand le plan est chiffré, cartes vides retirées", () => {
    assert.deepEqual(cartesDuPlan(plein), ['financements', 'options', 'employeur', 'personne', 'avantages', 'non-chiffrees', 'services']);
    assert.deepEqual(cartesDuPlan(plan({ coutFormation: 1000, nonChiffrees: [aide({ id: 'f' })] })), ['non-chiffrees']);
    assert.deepEqual(cartesDuPlan(plan({})), []);
  });

  test('aucun financement chiffré : montant selon dossier, employeur et personne en tête', () => {
    const sansFinancement = { ...plein, financements: [], totalFinance: 0, resteACharge: 1000 };
    assert.deepEqual(cartesDuPlan(sansFinancement), ['non-chiffrees', 'employeur', 'personne', 'options', 'avantages', 'services']);
  });

  test("rappels du bandeau quand aucun financement n'est chiffré (scénarios 3 et 4)", () => {
    // Scénario 3 : CléA n'est plus éligible sans certification précisée (« à vérifier »), il quitte les aides au montant selon dossier.
    assert.deepEqual(rappelsAucunFinancement(simuler(SCENARIOS.demandeur).plan), [
      { carte: 'non-chiffrees', nombre: 10, libelle: '10 aides au montant selon dossier' },
      { carte: 'personne', nombre: 2, libelle: '2 revenus et aides à la personne' },
    ]);
    assert.deepEqual(rappelsAucunFinancement(simuler(SCENARIOS.apprenti).plan), [
      { carte: 'non-chiffrees', nombre: 7, libelle: '7 aides au montant selon dossier' },
      { carte: 'employeur', nombre: 1, libelle: "1 aide versée à l'employeur" },
      { carte: 'personne', nombre: 5, libelle: '5 revenus et aides à la personne' },
    ]);
    assert.deepEqual(
      rappelsAucunFinancement(
        plan({ coutFormation: 10, nonChiffrees: [aide({ id: 'f' })], aidesEmployeur: [ligne('b', 'B', 1), ligne('c', 'C', 1)], remunerations: [ligne('d', 'D', 1)] }),
      ).map((r) => r.libelle),
      ['1 aide au montant selon dossier', "2 aides versées à l'employeur", '1 revenu ou aide à la personne'],
    );
    assert.deepEqual(rappelsAucunFinancement(plan({ coutFormation: 10 })), []);
  });
});

describe('encadré du bandeau quand aucun financement de la formation n’est chiffré (encadreSansFinancement)', () => {
  const espaces = (s: string) => s.replace(/\s/g, ' ');
  const option = (id: string, montantEstime: number | null) => ({ id, nom: id, financeurNom: 'F', montantEstime, raison: 'r' });

  /** Phrases attendues (espaces insécables lues comme ordinaires). */
  const UNE_CHIFFREE =
    "Le montant d'une aide « à vérifier » listée plus bas n'est pas compté dans le plan : une information manque ou le financeur doit confirmer.";
  const PLUSIEURS_CHIFFREES =
    "Les montants des aides « à vérifier » listées plus bas ne sont pas comptés dans le plan : une information manque ou le financeur doit confirmer.";
  const UNE_SANS_MONTANT = "Une aide « à vérifier » est listée plus bas : une information manque ou le financeur doit confirmer.";
  const CONSEIL =
    "Interrogez l'OPCO ou le fonds d'assurance formation compétent, et consultez les portails officiels de la région en bas de page.";

  /** Dirigeant assimilé salarié en Île-de-France, formation de 900 € sur 21 h chez un organisme certifié Qualiopi. */
  const ASSIMILE: Partial<WizardState> = {
    projetType: 'formation_dirigeant', regionCode: '11', companySize: 'less_11', statutDirigeant: 'assimile_salarie',
    ageBeneficiaire: 45, formationType: 'non_certifiante', organismeQualiopi: true, ...coutsDeFormation(900, 21),
  };

  /** L'état passé par le calcul de l'écran, puis l'encadré, avec les aides évaluées (celles que la page liste). */
  function encadreDe(over: Partial<WizardState>) {
    const { plan: p, aidesEvaluees, portail } = calculer(etat(over), DATE);
    return { p, aides: aidesEvaluees, ...encadreSansFinancement(p, aidesEvaluees, portail != null) };
  }
  const listees = (aides: readonly AideEvaluee[]) => groupesAidesVisibles(aides).flatMap((g) => g.aides);

  test('scénario 5 avec « Organisme certifié Qualiopi : Je ne sais pas » : le FAFCEA « à vérifier » chiffré est cité, lien vers les aides', () => {
    const { p, aides, texte, rappels, aidesAVerifier } = encadreDe({ ...SCENARIOS.artisan, organismeQualiopi: null });
    assert.equal(etatEnTete(p), 'aucun_financement_chiffre');
    // Plus bas, « Aides et financements identifiés » : FAFCEA, à vérifier, jusqu'à 735 €.
    assert.ok(listees(aides).some((a) => a.id === 'faf-fafcea' && a.statut === 'a_verifier' && a.montantEstime === 735));
    assert.equal(espaces(texte), `Aucun financement de la formation n'est chiffrable à ce stade. ${UNE_CHIFFREE} ${CONSEIL}`);
    assert.deepEqual(rappels, []);
    // FAFCEA (735 €), CPF et Pass transitions (sans montant) : trois aides « à vérifier » listées.
    assert.deepEqual(aidesAVerifier, { nombre: 3, libelle: '3 aides à vérifier' });
  });

  test('dirigeant assimilé salarié, Île-de-France, 900 €, solde CPF de 2 000 €, éligibilité au CPF inconnue : le CPF « à vérifier » (900 €) est cité', () => {
    const { aides, texte, aidesAVerifier } = encadreDe({ ...ASSIMILE, soldeCpf: 2000, eligibleCpf: null });
    assert.ok(listees(aides).some((a) => a.id === 'nat-cpf' && a.statut === 'a_verifier' && a.montantEstime === 900));
    assert.equal(espaces(texte), `Aucun financement de la formation n'est chiffrable à ce stade. ${UNE_CHIFFREE} ${CONSEIL}`);
    assert.ok(!texte.includes('aucune autre aide à montant') && !texte.includes('Seuls des services gratuits'), texte);
    assert.deepEqual(aidesAVerifier, { nombre: 1, libelle: '1 aide à vérifier' });
  });

  test('dirigeant assimilé salarié, formation non éligible au CPF : aucune aide à vérifier, le texte d’origine reste vrai', () => {
    const { p, aides, texte, rappels, aidesAVerifier } = encadreDe({ ...ASSIMILE, eligibleCpf: false });
    assert.equal(etatEnTete(p), 'aucun_financement_chiffre');
    // Seul le conseil en évolution professionnelle (service gratuit) est listé, et seule sa carte suit.
    assert.deepEqual(listees(aides).map((a) => a.id), ['nat-cep']);
    assert.deepEqual(cartesDuPlan(p), ['services']);
    assert.equal(
      espaces(texte),
      "Aucun financement de la formation n'est chiffrable et aucune autre aide à montant n'a été identifiée pour cette " +
        `situation. Seuls des services gratuits sont proposés ci-dessous. ${CONSEIL}`,
    );
    assert.deepEqual(rappels, []);
    assert.equal(aidesAVerifier, null);
  });

  test('dirigeant assimilé salarié, éligibilité au CPF inconnue sans solde : le CPF « à vérifier » sans montant est cité, jamais « seuls des services gratuits »', () => {
    const { p, texte, aidesAVerifier } = encadreDe(ASSIMILE);
    assert.deepEqual(cartesDuPlan(p), ['services']);
    assert.equal(espaces(texte), `Aucun financement de la formation n'est chiffrable à ce stade. ${UNE_SANS_MONTANT} ${CONSEIL}`);
    assert.deepEqual(aidesAVerifier, { nombre: 1, libelle: '1 aide à vérifier' });
  });

  test('scénario 3 (demandeur d’emploi) : aides au montant selon dossier, rappels vers leurs cartes, aides à vérifier chiffrées citées', () => {
    const { texte, rappels, aidesAVerifier } = encadreDe(SCENARIOS.demandeur);
    assert.equal(
      espaces(texte),
      "Aucun financement de la formation n'est chiffrable à ce stade : les financeurs fixent le montant après étude du dossier. " +
        `Voici les aides identifiées. ${PLUSIEURS_CHIFFREES}`,
    );
    assert.deepEqual(rappels.map((r) => r.carte), ['non-chiffrees', 'personne']);
    // Aide aux employeurs (contrat de professionnalisation, 2 000 €) et GEIQ (814 €) chiffrées ; CPF, CléA (certification non
    // précisée) et PEC sans montant.
    assert.deepEqual(aidesAVerifier, { nombre: 5, libelle: '5 aides à vérifier' });
  });

  test('scénario 2 (120 salariés) : options au choix chiffrées et aides au montant selon dossier ; aucune aide « à vérifier » chiffrée, rien à citer', () => {
    const { texte, aidesAVerifier } = encadreDe(SCENARIOS.grande);
    // La dotation de l'employeur sur le CPF, « à vérifier » (éligibilité au CPF inconnue), n'a plus de montant : c'est l'argent de
    // l'employeur. Les aides « à vérifier » (dotation, CPF, CléA, FSE+ de l'OPCO) sont toutes sans montant.
    assert.equal(
      espaces(texte),
      "Aucun financement cumulable n'est chiffré pour cette formation : les options au choix ont un montant, à comparer, et les " +
        'autres financeurs fixent le montant après étude du dossier.',
    );
    assert.equal(aidesAVerifier, null);
  });

  test('options chiffrées sans aide au montant selon dossier : aucun « autres financeurs »', () => {
    const s = aide({ id: 's', categorie: 'service_gratuit' });
    const p = plan({ coutFormation: 1000, resteACharge: 1000, options: [option('a', 400)], servicesGratuits: [s] });
    const { texte, aidesAVerifier } = encadreSansFinancement(p, [s], true);
    assert.equal(espaces(texte), "Aucun financement cumulable n'est chiffré pour cette formation : les options au choix ont un montant, à comparer.");
    assert.equal(aidesAVerifier, null);
    // Une option sans montant est au montant selon dossier : la suite de la phrase redevient vraie.
    const avecDossier = { ...p, options: [option('a', 400), option('b', null)] };
    assert.match(encadreSansFinancement(avecDossier, [s], true).texte, /les autres financeurs fixent le montant après étude du dossier\.$/);
  });

  test("aides versées à l'employeur seules : aucune « étude du dossier », elles ne réduisent pas le prix", () => {
    const p = plan({ coutFormation: 1000, resteACharge: 1000, aidesEmployeur: [ligne('e', 'E', 300)] });
    const employeur = aide({ id: 'e', categorie: 'aide_employeur', montantEstime: 300 });
    const { texte, rappels } = encadreSansFinancement(p, [employeur], true);
    assert.equal(
      espaces(texte),
      "Aucun financement de la formation n'est chiffrable pour cette situation. Voici les aides identifiées, qui ne réduisent pas le prix de la formation.",
    );
    assert.deepEqual(rappels.map((r) => r.libelle), ["1 aide versée à l'employeur"]);
    // Une aide « à vérifier » chiffrée est listée plus bas : « à ce stade », jamais « pour cette situation », et elle est citée.
    const aVerifier = aide({ id: 'v', statut: 'a_verifier', montantEstime: 500 });
    const avec = encadreSansFinancement(p, [employeur, aVerifier], true);
    assert.equal(
      espaces(avec.texte),
      "Aucun financement de la formation n'est chiffrable à ce stade. Voici les aides identifiées, qui ne réduisent pas le prix de la formation. " +
        UNE_CHIFFREE,
    );
    assert.deepEqual(avec.aidesAVerifier, { nombre: 1, libelle: '1 aide à vérifier' });
  });

  test('aucune aide à montant : services gratuits dits seulement quand ils sont seuls ; portails seulement quand ils existent', () => {
    const s = aide({ id: 's', categorie: 'service_gratuit' });
    const optionsSansMontant = plan({ coutFormation: 1000, resteACharge: 1000, options: [option('o', null)], servicesGratuits: [s] });
    const texte = encadreSansFinancement(optionsSansMontant, [aide({ id: 'o' }), s], true).texte;
    assert.ok(!texte.includes('Seuls des services gratuits'), texte);
    assert.ok(!texte.includes('Voici les aides identifiées'), texte);
    const rien = encadreSansFinancement(plan({ coutFormation: 1000, resteACharge: 1000 }), [], false);
    assert.equal(
      espaces(rien.texte),
      "Aucun financement de la formation n'est chiffrable et aucune autre aide à montant n'a été identifiée pour cette " +
        "situation. Interrogez l'OPCO ou le fonds d'assurance formation compétent.",
    );
  });

  test("aides listées plus bas : une aide éligible chiffrée (avantage fiscal) interdit « aucune autre aide à montant » ; un service « à vérifier » est cité", () => {
    const avantage = aide({ id: 'a', categorie: 'avantage_fiscal_social', montantEstime: 300 });
    const p = plan({ coutFormation: 1000, resteACharge: 1000, avantagesFiscauxSociaux: [ligne('a', 'A', 300)] });
    assert.equal(
      espaces(encadreSansFinancement(p, [avantage], false).texte),
      "Aucun financement de la formation n'est chiffrable à ce stade. Interrogez l'OPCO ou le fonds d'assurance formation compétent.",
    );
    // Services gratuits seuls, dont un « à vérifier » : les services restent seuls, l'aide à vérifier est citée.
    const s = aide({ id: 's', categorie: 'service_gratuit' });
    const t = aide({ id: 't', categorie: 'service_gratuit', statut: 'a_verifier' });
    const services = encadreSansFinancement(plan({ coutFormation: 1000, resteACharge: 1000, servicesGratuits: [s] }), [s, t], true);
    assert.equal(
      espaces(services.texte),
      `Aucun financement de la formation n'est chiffrable à ce stade. ${UNE_SANS_MONTANT} Seuls des services gratuits sont proposés ci-dessous. ${CONSEIL}`,
    );
    // Plusieurs aides « à vérifier » chiffrées : les montants, au pluriel ; une aide non éligible n'est jamais comptée.
    const deux = encadreSansFinancement(
      plan({ coutFormation: 1000, resteACharge: 1000 }),
      [
        aide({ id: 'v1', statut: 'a_verifier', montantEstime: 200 }),
        aide({ id: 'v2', statut: 'a_verifier', montantEstime: 300 }),
        aide({ id: 'v3', statut: 'a_verifier' }),
        aide({ id: 'n', statut: 'non_eligible', montantEstime: 900 }),
      ],
      false,
    );
    assert.equal(
      espaces(deux.texte),
      `Aucun financement de la formation n'est chiffrable à ce stade. ${PLUSIEURS_CHIFFREES} Interrogez l'OPCO ou le fonds d'assurance formation compétent.`,
    );
    assert.deepEqual(deux.aidesAVerifier, { nombre: 3, libelle: '3 aides à vérifier' });
  });

  test('1 500 états tirés au hasard (graine 29) : chaque affirmation de l’encadré est vraie au regard des aides et des cartes affichées', () => {
    // Vérification écrite sans la logique de l'encadré : elle lit la liste des aides rendue plus bas (groupesAidesVisibles,
    // celle d'AidesList) et les cartes du plan (cartesDuPlan), puis confronte chaque phrase écrite à ce qu'elles montrent.
    const hasard = generateur(29);
    const un = <T,>(l: readonly T[]): T => l[hasard(l.length)];
    const PROJETS: ProjetType[] = ['formation_salarie', 'reconversion_salarie', 'recrutement_demandeur_emploi', 'alternance', 'formation_dirigeant'];
    const OPCOS = ['akto', 'atlas', 'afdas', 'constructys', 'ocapiat', 'opco-ep', 'opco-mobilites', 'opco-sante', 'opco2i', 'opcommerce', 'uniformation'];
    const REGIONS_CODES = EMBEDDED_PORTAILS.map((p) => p.region);
    const vus = new Set<string>();
    const compte = { sansFinancement: 0, aVerifierChiffrees: 0, troisiemeAvecAVerifierChiffrees: 0, servicesSeuls: 0, aucuneAideAMontant: 0 };
    for (let i = 0; i < 1500; i++) {
      const projet = un(PROJETS);
      const heures = un([7, 21, 35, 140, 280, 800]);
      const over: Partial<WizardState> = {
        projetType: projet,
        selectedOpcoSlug: projet === 'formation_dirigeant' && hasard(2) === 0 ? null : un(OPCOS),
        regionCode: un(REGIONS_CODES),
        companySize: un(['less_11', '11_49', '50_299', '300_plus'] as const),
        ageBeneficiaire: un([19, 28, 45, 58]),
        formationType: un(['non_certifiante', 'qualification', 'certification', 'cqp'] as const),
        eligibleCpf: un([null, true, false]),
        organismeQualiopi: un([null, true, false]),
        contractType: projet === 'alternance' ? 'alternance' : un(['cdi', 'cdd'] as const),
        typeAlternance: un(['apprentissage', 'professionnalisation'] as const),
        inscritFranceTravail: un([true, false]),
        statutDirigeant: un(['artisan', 'commercant', 'profession_liberale', 'assimile_salarie'] as const),
        microEntrepreneur: un([null, true, false]),
        soldeCpf: un([null, 0, 800, 2000]),
        ...coutsDeFormation(un([300, 900, 1400, 3500, 7000]), heures),
      };
      const { plan: p, portail, aidesEvaluees, funding } = calculer(etat(over), DATE);
      if (etatEnTete(p) !== 'aucun_financement_chiffre') continue;
      compte.sansFinancement++;
      // Comme l'écran : le plan de l'OPCO fermé aux 50 salariés et plus (planFermeDe) ouvre l'encadré par sa raison.
      const planFerme = planFermeDe(funding);
      const { texte, rappels, aidesAVerifier, detailOpco } = encadreSansFinancement(p, aidesEvaluees, portail != null, planFerme);
      const contexte = `${JSON.stringify(over)} : ${texte}`;
      assert.equal(texte.startsWith(planFerme ? raisonPlanFerme(planFerme) : 'Aucun financement'), true, contexte);
      assert.equal(detailOpco, planFerme != null, contexte);

      // Ce que la page montre sous le bandeau.
      const listeesPlusBas = listees(aidesEvaluees);
      const aVerifier = listeesPlusBas.filter((a) => a.statut === 'a_verifier');
      const aVerifierChiffrees = aVerifier.filter((a) => (a.montantEstime ?? 0) > 0);
      const cartes = cartesDuPlan(p);
      const montantsDesCartes = [
        ...p.options.map((o) => o.montantEstime ?? 0),
        ...[...p.aidesEmployeur, ...p.remunerations, ...p.avantagesFiscauxSociaux].map((l) => l.montant),
      ];
      const aideAMontant = listeesPlusBas.some((a) => (a.montantEstime ?? 0) > 0) || montantsDesCartes.some((m) => m > 0);
      if (aVerifierChiffrees.length > 0) compte.aVerifierChiffrees++;

      // « aucune autre aide à montant n'a été identifiée » : ni aide listée ni ligne d'une carte n'a de montant.
      if (texte.includes('aucune autre aide à montant')) {
        compte.aucuneAideAMontant++;
        assert.ok(!aideAMontant, contexte);
      }
      // « Seuls des services gratuits sont proposés ci-dessous » : toute carte et toute aide listée sont des services gratuits.
      if (texte.includes('Seuls des services gratuits')) {
        compte.servicesSeuls++;
        assert.ok(cartes.length > 0 && cartes.every((c) => c === 'services'), contexte);
        assert.ok(listeesPlusBas.every((a) => a.categorie === 'service_gratuit'), contexte);
      }
      // Des aides « à vérifier » chiffrées sont listées : l'encadré le dit, avec le lien vers la liste et leur nombre.
      if (aVerifierChiffrees.length > 0) {
        assert.ok(/aides? «\s?à vérifier\s?»/.test(texte) && texte.includes('montant'), contexte);
        assert.deepEqual(aidesAVerifier?.nombre, aVerifier.length, contexte);
        if (rappels.length === 0 && !p.options.some((o) => (o.montantEstime ?? 0) > 0)) compte.troisiemeAvecAVerifierChiffrees++;
      }
      // L'encadré ne cite des aides « à vérifier », leur nombre et leurs montants que si la liste les montre.
      if (texte.includes('à vérifier')) assert.ok(aVerifier.length > 0, contexte);
      if (aidesAVerifier) assert.equal(aidesAVerifier.nombre, aVerifier.length, contexte);
      if (texte.includes("Le montant d'une aide")) assert.equal(aVerifierChiffrees.length, 1, contexte);
      if (texte.includes('Les montants des aides')) assert.ok(aVerifierChiffrees.length >= 2, contexte);
      if (texte.includes('est listée plus bas') || texte.includes('sont listées plus bas')) assert.equal(aVerifierChiffrees.length, 0, contexte);
      // « pour cette situation », sans réserve : aucune aide chiffrée n'attend une vérification.
      if (texte.includes('pour cette situation')) assert.equal(aVerifierChiffrees.length, 0, contexte);
      // « Voici les aides identifiées » : des cartes d'aides suivent ; « qui ne réduisent pas le prix » : aucune au montant selon dossier.
      assert.deepEqual(rappels, rappelsAucunFinancement(p), contexte);
      if (texte.includes('Voici les aides identifiées')) assert.ok(rappels.length > 0, contexte);
      if (texte.includes('qui ne réduisent pas le prix')) assert.ok(!cartes.includes('non-chiffrees'), contexte);
      // « après étude du dossier » : une aide ou une option au montant selon dossier est affichée.
      if (texte.includes('après étude du dossier')) assert.ok(p.nonChiffrees.length > 0 || p.options.some((o) => o.montantEstime == null), contexte);
      // « les options au choix ont un montant » : une option chiffrée est affichée.
      if (texte.includes('options au choix ont un montant')) assert.ok(p.options.some((o) => (o.montantEstime ?? 0) > 0), contexte);
      // Portails « en bas de page » : seulement s'ils existent.
      if (texte.includes('les portails officiels de la région')) assert.ok(portail != null, contexte);
      assert.ok(!/ [:;?!]/.test(texte), `espace ordinaire avant une ponctuation haute : ${texte}`);
      vus.add(texte);
    }
    assert.ok(compte.sansFinancement >= 500, JSON.stringify(compte));
    // Le cas du constat est bien tiré (troisième variante et aides « à vérifier » chiffrées), comme les phrases d'origine.
    assert.ok(compte.troisiemeAvecAVerifierChiffrees >= 30, JSON.stringify(compte));
    assert.ok(compte.servicesSeuls >= 10 && compte.aucuneAideAMontant >= 10, JSON.stringify(compte));
    assert.ok(vus.size >= 8, `seulement ${vus.size} textes distincts : ${[...vus].join(' | ')}`);
  });
});

describe('plan de développement des compétences fermé aux 50 salariés et plus : la raison dans le bandeau', () => {
  const espaces = (s: string) => s.replace(/\s/g, ' ');
  /** Scénario du constat : AKTO, Occitanie, 50 à 299 salariés, 14 h à 1 000 €. */
  const AKTO_GRANDE: Partial<WizardState> = {
    projetType: 'formation_salarie', selectedOpcoSlug: 'akto', regionCode: '76', companySize: '50_299', contractType: 'cdi',
    formationType: 'non_certifiante', ...coutsDeFormation(1000, 14),
  };

  test('raison : la taille, les fonds mutualisés de l’OPCO et le barème appliqué (général, ou celui de la branche)', () => {
    assert.equal(
      espaces(raisonPlanFerme({ opco: 'AKTO', branche: null })),
      "Votre entreprise compte 50 salariés ou plus : les fonds mutualisés du plan de développement des compétences d'AKTO ne lui sont pas ouverts, et le barème général d'AKTO ne prévoit pas d'enveloppe pour sa taille.",
    );
    assert.equal(
      espaces(raisonPlanFerme({ opco: "L'Opcommerce", branche: 'Optique' })),
      "Votre entreprise compte 50 salariés ou plus : les fonds mutualisés du plan de développement des compétences de l'Opcommerce ne lui sont pas ouverts, et le barème de la branche « Optique » ne prévoit pas d'enveloppe pour sa taille.",
    );
    assert.equal(planFermeDe(null), null);
  });

  test('scénario du constat : l’encadré dit la raison avant tout, renvoie au détail de l’OPCO, « les autres financeurs » fixent le montant', () => {
    const { plan: p, aidesEvaluees, portail, funding } = calculer(etat(AKTO_GRANDE), DATE);
    assert.ok(funding?.pdcFerme);
    assert.equal(etatEnTete(p), 'aucun_financement_chiffre');
    const planFerme = planFermeDe(funding);
    assert.deepEqual(planFerme, { opco: 'AKTO', branche: null });
    const { texte, detailOpco } = encadreSansFinancement(p, aidesEvaluees, portail != null, planFerme);
    assert.ok(texte.startsWith(raisonPlanFerme(planFerme)), texte);
    assert.equal(detailOpco, true);
    assert.equal(ID_DETAIL_OPCO, 'titre-detail-opco');
    // Dans cet état, la raison est dans l'encadré sans financement : pas de second encadré.
    assert.equal(encadrePlanFerme('aucun_financement_chiffre', planFerme), null);
    // Sans plan fermé (même plan), l'encadré reste celui d'avant : ni raison ni lien.
    const ouvert = encadreSansFinancement(p, aidesEvaluees, portail != null);
    assert.ok(!ouvert.texte.includes('50 salariés'), ouvert.texte);
    assert.equal(ouvert.detailOpco, false);
    assert.equal(texte, `${raisonPlanFerme(planFerme)} ${ouvert.texte}`);
  });

  test('aides au montant selon dossier : « les autres financeurs » fixent le montant, jamais « les financeurs » seuls', () => {
    const selonDossier = aide({ id: 'f' });
    const p = plan({ coutFormation: 1000, resteACharge: 1000, nonChiffrees: [selonDossier] });
    const planFerme = { opco: 'AKTO', branche: null };
    assert.equal(
      espaces(encadreSansFinancement(p, [selonDossier], true, planFerme).texte),
      `${espaces(raisonPlanFerme(planFerme))} Aucun financement de la formation n'est chiffrable à ce stade : les autres financeurs ` +
        "fixent le montant après étude du dossier. Voici les aides identifiées.",
    );
    // Le même plan sans plan fermé : la phrase d'avant, inchangée.
    assert.equal(
      espaces(encadreSansFinancement(p, [selonDossier], true).texte),
      "Aucun financement de la formation n'est chiffrable à ce stade : les financeurs fixent le montant après étude du dossier. Voici les aides identifiées.",
    );
  });

  test('plan chiffré par d’autres financeurs (CPF) ou coût inconnu : un encadré du plan fermé, avec la même raison', () => {
    const planFerme = { opco: 'AKTO', branche: null };
    for (const etatDuBandeau of ['plan_chiffre', 'cout_inconnu'] as const) {
      const e = encadrePlanFerme(etatDuBandeau, planFerme);
      assert.ok(e, etatDuBandeau);
      assert.equal(e.texte, raisonPlanFerme(planFerme));
      assert.equal(espaces(e.titre), "Aucune prise en charge estimée sur le plan de développement des compétences d'AKTO");
    }
    assert.equal(encadrePlanFerme('plan_chiffre', null), null);
    // CPF de 800 € sur la formation : le plan est chiffré sans l'OPCO, dont le plan reste fermé.
    const { plan: p, funding } = calculer(etat({ ...AKTO_GRANDE, formationType: 'certification', eligibleCpf: true, soldeCpf: 800 }), DATE);
    assert.ok(funding?.pdcFerme);
    assert.equal(etatEnTete(p), 'plan_chiffre');
    assert.ok(encadrePlanFerme(etatEnTete(p), planFermeDe(funding)));
  });

  test('états tirés au hasard (graine 41) jusqu’à 1 000 plans fermés : le bandeau dit la raison quand le plan est fermé, jamais sinon', () => {
    const hasard = generateur(41);
    const un = <T,>(l: readonly T[]): T => l[hasard(l.length)];
    const OPCOS = ['akto', 'atlas', 'afdas', 'constructys', 'ocapiat', 'opco-ep', 'opco-mobilites', 'opco-sante', 'opco2i', 'opcommerce', 'uniformation'];
    const REGIONS_CODES = EMBEDDED_PORTAILS.map((x) => x.region);
    const compte = { tirages: 0, ferme: 0, ouvert: 0, sansFinancement: 0, chiffre: 0, branche: 0 };
    for (; compte.ferme < 1000 && compte.tirages < 6000; compte.tirages++) {
      const slug = un(OPCOS);
      const variantes = getEmbeddedOpcoBySlug(slug)?.variantes_branche ?? [];
      const over: Partial<WizardState> = {
        projetType: un(['formation_salarie', 'reconversion_salarie'] as const),
        selectedOpcoSlug: slug,
        selectedBrancheId: variantes.length > 0 && hasard(2) === 0 ? un(variantes).id : null,
        regionCode: un(REGIONS_CODES),
        companySize: un(['50_299', '50_299', '300_plus', '11_49'] as const),
        contractType: un(['cdi', 'cdd'] as const),
        anciennete_mois: 24,
        formationType: un(['non_certifiante', 'qualification', 'certification', 'cqp'] as const),
        eligibleCpf: un([null, true, false]),
        soldeCpf: un([null, 0, 800, 2000]),
        ...coutsDeFormation(un([300, 1000, 1400, 3500, 7000]), un([7, 14, 35, 140, 280])),
      };
      const { plan: p, aidesEvaluees, portail, funding } = calculer(etat(over), DATE);
      const planFerme = planFermeDe(funding);
      const etatDuBandeau = etatEnTete(p);
      // Ce que le bandeau écrit sous ses chiffres : l'encadré du plan fermé et, sans financement chiffré, l'encadré qui le dit.
      const textes = [
        encadrePlanFerme(etatDuBandeau, planFerme)?.texte,
        etatDuBandeau === 'aucun_financement_chiffre' ? encadreSansFinancement(p, aidesEvaluees, portail != null, planFerme).texte : null,
      ].filter((t): t is string => t != null);
      const contexte = `${JSON.stringify(over)} : ${textes.join(' | ')}`;
      const raison = (t: string) => espaces(t).includes('Votre entreprise compte 50 salariés ou plus : les fonds mutualisés');
      if (funding?.pdcFerme) {
        compte.ferme++;
        if (etatDuBandeau === 'aucun_financement_chiffre') compte.sansFinancement++;
        if (etatDuBandeau === 'plan_chiffre') compte.chiffre++;
        if (funding.brancheAppliquee) compte.branche++;
        assert.equal(textes.filter(raison).length, 1, contexte);
        assert.ok(textes.some((t) => t.includes(raisonPlanFerme({ opco: funding.opcoName, branche: funding.brancheAppliquee }))), contexte);
      } else {
        compte.ouvert++;
        assert.ok(!textes.some(raison), contexte);
      }
      for (const t of textes) assert.ok(!/ [:;?!]/.test(t), `espace ordinaire avant une ponctuation haute : ${t}`);
    }
    assert.ok(compte.ferme >= 1000, JSON.stringify(compte));
    assert.ok(compte.sansFinancement >= 100 && compte.chiffre >= 20 && compte.branche >= 20 && compte.ouvert >= 50, JSON.stringify(compte));
  });
});

describe('note sous le bandeau quand le plan de l’OPCO n’est pas compté (titreNoteOpco)', () => {
  test('dirigeant sans OPCO (la saisie manuelle ne lui en propose pas) : jamais « Aucun OPCO renseigné »', () => {
    assert.equal(titreNoteOpco('formation_dirigeant', true), 'Pas de calcul du plan de développement des compétences pour ce projet');
    assert.equal(titreNoteOpco('formation_dirigeant', false), 'OPCO non compté pour un dirigeant');
  });

  test('projet salarié sans OPCO : « Aucun OPCO renseigné » ; avec OPCO, ou projet qui ne passe pas par ce plan : aucune note', () => {
    assert.equal(titreNoteOpco('formation_salarie', true), 'Aucun OPCO renseigné');
    assert.equal(titreNoteOpco('reconversion_salarie', true), 'Aucun OPCO renseigné');
    assert.equal(titreNoteOpco(null, true), 'Aucun OPCO renseigné');
    assert.equal(titreNoteOpco('formation_salarie', false), null);
    assert.equal(titreNoteOpco('alternance', true), null);
    assert.equal(titreNoteOpco('recrutement_demandeur_emploi', true), null);
  });
});

describe("chapeau du détail de l'estimation OPCO (chapeauDetailOpco)", () => {
  const poste = (over: Partial<FundingLine> & Pick<FundingLine, 'poste'>): FundingLine => ({
    label: over.poste,
    requestedAmount: 1000,
    fundedAmount: 1000,
    remainder: 0,
    confidence: 'exact',
    sourceUrl: 'https://exemple.fr',
    ...over,
  });
  const SALAIRES =
    "Le calcul de l'OPCO poste par poste. Le plan ci-dessus ne retient que les postes de la formation : salaires et transport y figurent parmi les aides versées à l'employeur.";
  const SIMPLE = "Le calcul de l'OPCO poste par poste, avec la règle et la source de chaque montant.";

  test('scénario 1 : salaires financés, le chapeau dit où ils figurent dans le plan', () => {
    const { funding } = calculer(etat(SCENARIOS.akto), DATE);
    assert.ok(funding);
    assert.equal(chapeauDetailOpco(funding), SALAIRES);
  });

  test('scénario 2 (120 salariés, plan fermé) : aucun tableau, aucun chapeau « poste par poste »', () => {
    const { funding } = calculer(etat(SCENARIOS.grande), DATE);
    assert.ok(funding?.pdcFerme);
    assert.equal(chapeauDetailOpco(funding), null);
  });

  test('pédagogie seule : le chapeau simple ; aucune ligne affichable : pas de chapeau', () => {
    assert.equal(chapeauDetailOpco({ pdcFerme: false, lines: [poste({ poste: 'pedagogie' })] }), SIMPLE);
    // Transport demandé mais non financé : rien à signaler hors formation.
    assert.equal(
      chapeauDetailOpco({ pdcFerme: false, lines: [poste({ poste: 'pedagogie' }), poste({ poste: 'transport', fundedAmount: 0, remainder: 1000 })] }),
      SIMPLE,
    );
    assert.equal(chapeauDetailOpco({ pdcFerme: false, lines: [poste({ poste: 'pedagogie', requestedAmount: 0, fundedAmount: 0 })] }), null);
    assert.equal(chapeauDetailOpco({ pdcFerme: true, lines: [poste({ poste: 'pedagogie' })] }), null);
  });

  test('lignes du tableau : un montant demandé ou financé, ou une règle sans montant estimé (selon branche, 0 €)', () => {
    const lignes = [
      poste({ poste: 'pedagogie' }),
      poste({ poste: 'salaires', requestedAmount: 0, fundedAmount: 0 }),
      poste({ poste: 'transport', requestedAmount: 0, fundedAmount: 0, confidence: 'depends_on_branche' }),
      poste({ poste: 'hebergement', requestedAmount: 0, fundedAmount: 0, confidence: 'estimated' }),
    ];
    assert.deepEqual(lignesDuDetail({ lines: lignes }).map((l) => l.poste), ['pedagogie', 'transport']);
    assert.equal(sansMontantEstime(lignes[2]), true);
    assert.equal(sansMontantEstime(poste({ poste: 'pedagogie', fundedAmount: 0, confidence: 'estimated' })), false);
    assert.equal(sansMontantEstime(poste({ poste: 'pedagogie', fundedAmount: 10, confidence: 'depends_on_branche' })), false);
  });
});

describe('fiabilité du montant d’une option au choix (confianceDOption)', () => {
  const option = (id: string, montantEstime: number | null) => ({ id, nom: id, financeurNom: 'F', montantEstime, raison: 'r' });
  const dispositif = (id: string, confidence: Confidence) => ({ id, confidence });

  test('dispositif de l’OPCO (« opco-<id> ») : sa fiabilité ; aide du catalogue : la sienne', () => {
    const aides = [aide({ id: 'nat-cpf', confidence: 'estimated' })];
    const dispositifs = [dispositif('espace-formation', 'depends_on_branche')];
    assert.equal(confianceDOption(option('opco-espace-formation', 4200), aides, dispositifs), 'depends_on_branche');
    assert.equal(confianceDOption(option('nat-cpf', 800), aides, dispositifs), 'estimated');
    // Une aide du catalogue et un dispositif de l'OPCO qui désignent la même option (« opco-x » : l'aide porte cet
    // identifiant, le dispositif « x » le reçoit du plan) : la fiabilité de l'aide l'emporte ; sans l'aide, celle du dispositif.
    const homonymes = [aide({ id: 'opco-x', confidence: 'estimated' })];
    assert.equal(confianceDOption(option('opco-x', 800), homonymes, [dispositif('x', 'exact')]), 'estimated');
    assert.equal(confianceDOption(option('opco-x', 800), [], [dispositif('x', 'exact')]), 'exact');
  });

  test('sans montant à qualifier (selon dossier, nul) ou sans source connue : aucune étiquette', () => {
    const aides = [aide({ id: 'a', confidence: 'exact' })];
    assert.equal(confianceDOption(option('a', null), aides, []), null);
    assert.equal(confianceDOption(option('a', 0), aides, []), null);
    assert.equal(confianceDOption(option('inconnue', 500), aides, []), null);
    assert.equal(confianceDOption(option('opco-absent', 500), aides, [dispositif('autre', 'exact')]), null);
  });

  test('scénarios 1 et 2 : chaque option chiffrée a la fiabilité de sa source (Espace Formation, campusAtlas…)', () => {
    let chiffrees = 0;
    for (const nom of ['akto', 'grande']) {
      const { plan: p, aidesEvaluees, funding } = calculer(etat(SCENARIOS[nom]), DATE);
      const dispositifs = funding?.dispositifsComplementaires ?? [];
      for (const o of p.options) {
        const c = confianceDOption(o, aidesEvaluees, dispositifs);
        if (o.montantEstime != null && o.montantEstime > 0) {
          chiffrees++;
          const source = aidesEvaluees.find((a) => a.id === o.id) ?? dispositifs.find((d) => `opco-${d.id}` === o.id);
          assert.ok(source, `${nom} : ${o.id} sans source`);
          assert.equal(c, source.confidence, `${nom} : ${o.id}`);
        } else {
          assert.equal(c, null, `${nom} : ${o.id}`);
        }
      }
    }
    assert.ok(chiffrees >= 2, `seulement ${chiffrees} options chiffrées`);
  });
});

describe("fonds épuisés signalés par l'OPCO", () => {
  const alerte = (type: AlerteOpco['type'], branche: string): AlerteOpco => ({
    type,
    branche,
    idcc: [],
    source_url: 'https://exemple.fr',
    extrait: 'extrait',
    verifie_le: '2026-10-05',
  });

  test('scénario 1 : AKTO signale la branche « Organismes de formation » épuisée, et le plan compte son PDC', () => {
    const { plan: p, funding } = calculer(etat(SCENARIOS.akto), DATE);
    assert.ok(funding);
    assert.deepEqual(fondsEpuisesSurLePlan(p, funding.alertes), ['Organismes de formation']);
  });

  test("seulement quand le plan compte le plan de développement des compétences ; branches sans doublon", () => {
    const avecPdc = plan({ coutFormation: 100, financements: [ligne('opco-pdc', 'AKTO', 100)], totalFinance: 100 });
    const sansPdc = plan({ coutFormation: 100, financements: [ligne('r76-x', 'Région', 100)], totalFinance: 100 });
    const alertes = [alerte('fonds_epuises', 'Propreté'), alerte('changement_criteres', 'HCR'), alerte('fonds_epuises', 'Propreté')];
    assert.deepEqual(fondsEpuisesSurLePlan(avecPdc, alertes), ['Propreté']);
    assert.deepEqual(fondsEpuisesSurLePlan(sansPdc, alertes), []);
    assert.deepEqual(fondsEpuisesSurLePlan(avecPdc, [alerte('dispositif_termine', 'FSE+')]), []);
  });
});

describe('relais du plan conventionnel de la branche (AKTO, organismes de formation)', () => {
  const espaces = (s: string) => s.replace(/\s/g, ' ');
  /** SFG Développement : AKTO, organismes de formation (IDCC 1516), moins de 11 salariés, 35 h à 1 750 €. */
  const AKTO_OF: Partial<WizardState> = {
    projetType: 'formation_salarie', selectedOpcoSlug: 'akto', detectedIdcc: '1516', regionCode: '11', departementCode: '95',
    companySize: 'less_11', contractType: 'cdi', formationType: 'non_certifiante', ...coutsDeFormation(1750, 35),
  };
  const RELAIS =
    "AKTO signale que l'enveloppe du plan de développement des compétences de la branche « Organismes de formation » est épuisée : " +
    'les demandes sont financées sur le plan conventionnel de la branche, dans la limite de 10 000 € par entreprise et par an. ' +
    "La prise en charge reste soumise à l'accord d'AKTO.";

  test('scénario de SFG Développement : la ligne s’appelle « Plan conventionnel de branche », AKTO, et l’encadré dit le relais', () => {
    const r = calculer(etat(AKTO_OF), DATE);
    assert.ok(r.funding && r.opco);
    const relais = relaisDuPlanConventionnel(r);
    assert.deepEqual(relais, { opco: 'AKTO', plafondAnnuel: 10000 });
    const ligneOpco = r.plan.financements.find((l) => l.id === 'opco-pdc');
    assert.ok(ligneOpco);
    assert.equal(ligneOpco.montant, 1750);
    assert.deepEqual(libellesDeLigne(ligneOpco, relais), { nom: 'Plan conventionnel de branche', financeurNom: 'AKTO' });
    const branches = fondsEpuisesSurLePlan(r.plan, r.funding.alertes);
    assert.deepEqual(branches, ['Organismes de formation']);
    assert.equal(espaces(texteFondsEpuises({ opco: 'AKTO', branches }, relais)), espaces(RELAIS));
    assert.equal(titreFondsEpuises({ opco: 'AKTO', branches }, relais), 'Le plan conventionnel de la branche prend le relais');
    assert.ok(!texteFondsEpuises({ opco: 'AKTO', branches }, relais).includes('peut être refusée'));
    // Le détail de l'OPCO nomme le même financement.
    assert.equal(
      dispositifAffiche(r.funding, relais),
      'Plan conventionnel de branche, en relais du plan de développement des compétences épuisé',
    );
    // Une autre ligne du plan garde ses libellés.
    assert.deepEqual(libellesDeLigne({ id: 'nat-cpf', nom: 'CPF', financeurNom: 'Caisse des Dépôts' }, relais), {
      nom: 'CPF',
      financeurNom: 'Caisse des Dépôts',
    });
  });

  test('autre branche d’AKTO dont l’enveloppe est épuisée, sans relais dans les données : texte d’origine inchangé', () => {
    // Enseignement privé non lucratif (IDCC 3218) : barème général d'AKTO, alerte de fonds épuisés.
    const r = calculer(etat({ ...AKTO_OF, detectedIdcc: '3218' }), DATE);
    assert.ok(r.funding);
    const relais = relaisDuPlanConventionnel(r);
    assert.equal(relais, null);
    const branches = fondsEpuisesSurLePlan(r.plan, r.funding.alertes);
    assert.equal(branches.length, 1);
    assert.equal(
      espaces(texteFondsEpuises({ opco: 'AKTO', branches }, relais)),
      `AKTO signale que l'enveloppe du plan de développement des compétences est épuisée pour la branche « ${branches[0]} » : la prise en charge peut être refusée.`,
    );
    assert.equal(titreFondsEpuises({ opco: 'AKTO', branches }, relais), 'Fonds épuisés selon AKTO');
    const ligneOpco = r.plan.financements.find((l) => l.id === 'opco-pdc');
    assert.ok(ligneOpco);
    assert.deepEqual(libellesDeLigne(ligneOpco, relais), { nom: 'Plan de développement des compétences', financeurNom: 'AKTO' });
    assert.equal(dispositifAffiche(r.funding, relais), r.funding.dispositifPrincipal);
    // Plusieurs branches : au pluriel.
    assert.match(espaces(texteFondsEpuises({ opco: 'AKTO', branches: ['A', 'B'] }, null)), /pour les branches « A », « B » : /);
  });

  test("le bandeau de synthèse passe le relais au titre et au texte de l'encadré des fonds épuisés", () => {
    // Aucun test ne rend le composant : sans le relais, l'encadré titrerait « Fonds épuisés selon AKTO » et annoncerait un
    // refus possible au-dessus d'un plan qui compte le plan conventionnel de la branche.
    const bandeau = readFileSync(fileURLToPath(new URL('../src/components/results/BandeauSynthese.tsx', import.meta.url)), 'utf8');
    assert.match(bandeau, /titre=\{titreFondsEpuises\(fondsEpuises, relais\)\}/);
    assert.match(bandeau, /\{texteFondsEpuises\(fondsEpuises, relais\)\}/);
  });

  test('600 états tirés au hasard (graine 23) : le relais n’apparaît que si la variante appliquée porte le champ', () => {
    const hasard = generateur(23);
    const un = <T,>(l: readonly T[]): T => l[hasard(l.length)];
    const akto = getEmbeddedOpcoBySlug('akto');
    assert.ok(akto);
    const IDCC = [null, '1516', '1516', '1516', '3218', '0573', '1979', '3043', '1501', '1351', '9999'];
    const compte = { relais: 0, sans: 0, encadreRelais: 0 };
    for (let i = 0; i < 600; i++) {
      const variantes = akto.variantes_branche ?? [];
      const over: Partial<WizardState> = {
        ...AKTO_OF,
        selectedOpcoSlug: un(['akto', 'akto', 'akto', 'atlas', 'opcommerce']),
        detectedIdcc: un(IDCC),
        selectedBrancheId: hasard(3) === 0 ? un(variantes).id : null,
        companySize: un(['less_11', '11_49', '50_299'] as const),
        ...coutsDeFormation(un([700, 1750, 3500, 9000]), un([7, 35, 140])),
      };
      const r = calculer(etat(over), DATE);
      const variante = r.opco ? resolveVarianteBranche(r.opco, etat(over)) : null;
      // Le relais vaut pour le plan de développement des compétences que le calcul compte : jamais quand ce plan est
      // fermé aux 50 salariés et plus (le bandeau dit alors pourquoi).
      const attendu = variante?.relais_plan_conventionnel === true && r.funding != null && !r.funding.pdcFerme;
      const relais = relaisDuPlanConventionnel(r);
      assert.equal(relais != null, attendu, JSON.stringify(over));
      if (relais) compte.relais++;
      else compte.sans++;
      for (const l of r.plan.financements) {
        const renommee = libellesDeLigne(l, relais).nom !== l.nom;
        assert.equal(renommee, attendu && l.id === 'opco-pdc', `${JSON.stringify(over)} : ${l.id}`);
      }
      if (r.funding) {
        const branches = fondsEpuisesSurLePlan(r.plan, r.funding.alertes);
        if (branches.length > 0) {
          const texte = texteFondsEpuises({ opco: r.funding.opcoName, branches }, relais);
          assert.equal(texte.includes('plan conventionnel'), attendu, `${JSON.stringify(over)} : ${texte}`);
          assert.equal(texte.includes('peut être refusée'), !attendu, texte);
          if (attendu) compte.encadreRelais++;
        }
        assert.equal(dispositifAffiche(r.funding, relais) !== r.funding.dispositifPrincipal, attendu);
      }
    }
    assert.ok(compte.relais >= 30 && compte.sans >= 300 && compte.encadreRelais >= 20, JSON.stringify(compte));
  });
});

describe('listes de conventions collectives', () => {
  test('au-delà de 6 codes, la liste « IDCC … » est repliée ; en deçà, le texte reste tel quel', () => {
    const tp = 'Entreprise relevant des Travaux publics (IDCC 1702, 2614, 3212, 2409, 1888, 2034, 2582)';
    assert.deepEqual(replierIdcc(tp), [
      { genre: 'texte', valeur: 'Entreprise relevant des Travaux publics (' },
      { genre: 'idcc', codes: ['1702', '2614', '3212', '2409', '1888', '2034', '2582'] },
      { genre: 'texte', valeur: ')' },
    ]);
    const six = 'Branches (IDCC 1702, 2614, 3212, 2409, 1888, 2034) seulement';
    assert.deepEqual(replierIdcc(six), [{ genre: 'texte', valeur: six }]);
    assert.deepEqual(replierIdcc('Sans code'), [{ genre: 'texte', valeur: 'Sans code' }]);
    assert.deepEqual(replierIdcc(''), []);
  });

  test('plusieurs listes dans un texte (condition réelle d’OCAPIAT) : chacune est repliée, le reste du texte gardé', () => {
    const texte =
      'Entreprise de 50 salariés et plus relevant des industries alimentaires (IDCC 0112, 1396, 1513, 1534, 1586, 1747, 1930, ' +
      '1938, 1987, 2728, 3109, 3255), de la coopération agricole (IDCC 7001, 7002, 7003, 7004, 7005, 7006, 7007, 7020, 7023, ' +
      '7027, 7503, 8435) ou du négoce agricole (IDCC 1077)';
    const morceaux = replierIdcc(texte);
    assert.deepEqual(
      morceaux.map((m) => (m.genre === 'texte' ? m.valeur : m.codes.length)),
      [
        'Entreprise de 50 salariés et plus relevant des industries alimentaires (',
        12,
        '), de la coopération agricole (',
        12,
        ') ou du négoce agricole (IDCC 1077)',
      ],
    );
    // Rien ne se perd : le texte se recompose à l'identique.
    const recompose = morceaux.map((m) => (m.genre === 'texte' ? m.valeur : `IDCC ${m.codes.join(', ')}`)).join('');
    assert.equal(recompose, texte);
  });
});

describe('région', () => {
  test('préposition de chaque région des portails', () => {
    const attendu: Record<string, string> = {
      Guadeloupe: 'en Guadeloupe',
      Martinique: 'en Martinique',
      Guyane: 'en Guyane',
      'La Réunion': 'à La Réunion',
      Mayotte: 'à Mayotte',
      'Île-de-France': 'en Île-de-France',
      'Centre-Val de Loire': 'en Centre-Val de Loire',
      'Bourgogne-Franche-Comté': 'en Bourgogne-Franche-Comté',
      Normandie: 'en Normandie',
      'Hauts-de-France': 'dans les Hauts-de-France',
      'Grand Est': 'dans le Grand Est',
      'Pays de la Loire': 'dans les Pays de la Loire',
      Bretagne: 'en Bretagne',
      'Nouvelle-Aquitaine': 'en Nouvelle-Aquitaine',
      Occitanie: 'en Occitanie',
      'Auvergne-Rhône-Alpes': 'en Auvergne-Rhône-Alpes',
      "Provence-Alpes-Côte d'Azur": "en Provence-Alpes-Côte d'Azur",
      Corse: 'en Corse',
    };
    assert.equal(EMBEDDED_PORTAILS.length, Object.keys(attendu).length);
    for (const p of EMBEDDED_PORTAILS) assert.equal(enRegion(p.nom_region), attendu[p.nom_region], p.nom_region);
  });
});
