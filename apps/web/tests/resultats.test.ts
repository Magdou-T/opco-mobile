// Écran « Votre plan de financement » : logique de présentation (lib/resultats.ts). Les attentes sont écrites à la main
// (calculs détaillés en commentaire) ; les tirages au hasard ont une graine fixe.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EMBEDDED_AIDES, EMBEDDED_PORTAILS, PROJET_LABELS, REGIONS, createInitialWizardState } from '@opco/core';
import type { AideEvaluee, AlerteOpco, Financeur, LignePlan, PlanFinancement, ProjetType, WizardState } from '@opco/core';
import { INSECABLE } from '../src/lib/format';
import { coutsDeFormation } from '../src/lib/parcours';
import { etiquettesDeSituation } from '../src/lib/situation';
import {
  aidesNonEligiblesAffichees,
  calculer,
  cartesDuPlan,
  descriptionBarre,
  encadreSansFinancement,
  enRegion,
  etatEnTete,
  familleCouleur,
  financeurDeLigne,
  fondsEpuisesSurLePlan,
  groupesAidesVisibles,
  libellePart,
  montantAffiche,
  nommerAides,
  partFinancee,
  partsBarre,
  rappelsAucunFinancement,
  replierIdcc,
  sourcesDeLAide,
} from '../src/lib/resultats';
import type { PartBarre } from '../src/lib/resultats';

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
      akto: ['Former un salarié', 'AKTO', 'Île-de-France', '140 h'],
      grande: ['Former un salarié', 'ATLAS', 'Auvergne-Rhône-Alpes', '35 h'],
      demandeur: ["Recruter et former un demandeur d'emploi", 'AKTO', 'Occitanie', '280 h'],
      apprenti: ['Recruter en alternance', 'AKTO', 'Hauts-de-France', '800 h'],
      artisan: ['Former le dirigeant', 'Bretagne', '21 h'],
    };
    for (const [nom, parcours] of Object.entries(SCENARIOS)) assert.deepEqual(etiquettesDeSituation(etat(parcours)), attendu[nom], nom);
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
        state.durationHours ? `${state.durationHours} h` : null,
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
    // AKTO 8 400 € ; CPF 800 € et abondement de l'employeur 150 € (même famille : 950 €) ; reste 3 250 €, sur 12 600 €.
    // Parts exactes 66,67 / 7,54 / 25,79 : arrondis inférieurs 66 + 7 + 25 = 98 ; les deux points restants vont aux plus
    // grandes décimales (0,79 puis 0,67) : 67 / 7 / 26.
    assert.deepEqual(partsBarre(p, aides), [
      { cle: 'opco', libelle: 'AKTO', montant: 8400, part: 67 },
      { cle: 'cpf', libelle: 'Compte personnel de formation', montant: 950, part: 7 },
      { cle: 'reste', libelle: 'Reste à charge', montant: 3250, part: 26 },
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
    assert.deepEqual(rappelsAucunFinancement(simuler(SCENARIOS.demandeur).plan), [
      { carte: 'non-chiffrees', nombre: 11, libelle: '11 aides au montant selon dossier' },
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

  test('scénario 3 (demandeur d’emploi) : aides au montant selon dossier, rappels vers leurs cartes', () => {
    const { texte, rappels } = encadreSansFinancement(simuler(SCENARIOS.demandeur).plan, true);
    assert.equal(
      espaces(texte),
      "Aucun financement de la formation n'est chiffrable à ce stade : les financeurs fixent le montant après étude du dossier. Voici les aides identifiées.",
    );
    assert.deepEqual(rappels.map((r) => r.carte), ['non-chiffrees', 'personne']);
  });

  test('scénario 2 (120 salariés) : options au choix chiffrées et aides au montant selon dossier', () => {
    const { texte } = encadreSansFinancement(simuler(SCENARIOS.grande).plan, true);
    assert.equal(
      espaces(texte),
      "Aucun financement cumulable n'est chiffré pour cette formation : les options au choix ont un montant, à comparer, et les autres financeurs fixent le montant après étude du dossier.",
    );
  });

  test('dirigeant assimilé salarié en Île-de-France, 900 € : seul le conseil en évolution professionnelle suit, aucun financeur annoncé', () => {
    const { plan: p } = simuler({
      projetType: 'formation_dirigeant', regionCode: '11', companySize: 'less_11', statutDirigeant: 'assimile_salarie',
      ageBeneficiaire: 45, formationType: 'non_certifiante', organismeQualiopi: true, ...coutsDeFormation(900, 21),
    });
    assert.equal(etatEnTete(p), 'aucun_financement_chiffre');
    assert.deepEqual(cartesDuPlan(p), ['services']);
    const { texte, rappels } = encadreSansFinancement(p, true);
    assert.equal(
      espaces(texte),
      "Aucun financement de la formation n'est chiffrable et aucune autre aide à montant n'a été identifiée pour cette " +
        "situation. Seuls des services gratuits sont proposés ci-dessous. Interrogez l'OPCO ou le fonds d'assurance " +
        'formation compétent, et consultez les portails officiels de la région en bas de page.',
    );
    assert.deepEqual(rappels, []);
  });

  test('options chiffrées sans aide au montant selon dossier : aucun « autres financeurs »', () => {
    const p = plan({ coutFormation: 1000, resteACharge: 1000, options: [option('a', 400)], servicesGratuits: [aide({ id: 's' })] });
    assert.equal(
      espaces(encadreSansFinancement(p, true).texte),
      "Aucun financement cumulable n'est chiffré pour cette formation : les options au choix ont un montant, à comparer.",
    );
    // Une option sans montant est au montant selon dossier : la suite de la phrase redevient vraie.
    const avecDossier = { ...p, options: [option('a', 400), option('b', null)] };
    assert.match(encadreSansFinancement(avecDossier, true).texte, /les autres financeurs fixent le montant après étude du dossier\.$/);
  });

  test("aides versées à l'employeur seules : aucune « étude du dossier », elles ne réduisent pas le prix", () => {
    const p = plan({ coutFormation: 1000, resteACharge: 1000, aidesEmployeur: [ligne('e', 'E', 300)] });
    const { texte, rappels } = encadreSansFinancement(p, true);
    assert.equal(
      espaces(texte),
      "Aucun financement de la formation n'est chiffrable pour cette situation. Voici les aides identifiées, qui ne réduisent pas le prix de la formation.",
    );
    assert.deepEqual(rappels.map((r) => r.libelle), ["1 aide versée à l'employeur"]);
  });

  test('aucune aide à montant : services gratuits dits seulement quand ils sont seuls ; portails seulement quand ils existent', () => {
    const optionsSansMontant = plan({ coutFormation: 1000, resteACharge: 1000, options: [option('o', null)], servicesGratuits: [aide({ id: 's' })] });
    const texte = encadreSansFinancement(optionsSansMontant, true).texte;
    assert.ok(!texte.includes('Seuls des services gratuits'), texte);
    assert.ok(!texte.includes('Voici les aides identifiées'), texte);
    const rien = encadreSansFinancement(plan({ coutFormation: 1000, resteACharge: 1000 }), false);
    assert.equal(
      espaces(rien.texte),
      "Aucun financement de la formation n'est chiffrable et aucune autre aide à montant n'a été identifiée pour cette " +
        "situation. Interrogez l'OPCO ou le fonds d'assurance formation compétent.",
    );
  });

  test('1 500 états tirés au hasard (graine 19) : le texte ne cite que ce qui suit à l’écran', () => {
    const hasard = generateur(19);
    const un = <T,>(l: readonly T[]): T => l[hasard(l.length)];
    const PROJETS: ProjetType[] = ['formation_salarie', 'reconversion_salarie', 'recrutement_demandeur_emploi', 'alternance', 'formation_dirigeant'];
    const OPCOS = ['akto', 'atlas', 'afdas', 'constructys', 'ocapiat', 'opco-ep', 'opco-mobilites', 'opco-sante', 'opco2i', 'opcommerce', 'uniformation'];
    const REGIONS_CODES = EMBEDDED_PORTAILS.map((p) => p.region);
    const vus = new Set<string>();
    let sansFinancement = 0;
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
        soldeCpf: un([null, 0, 800]),
        ...coutsDeFormation(un([300, 900, 1400, 3500, 7000]), heures),
      };
      const { plan: p, portail } = calculer(etat(over), DATE);
      if (etatEnTete(p) !== 'aucun_financement_chiffre') continue;
      sansFinancement++;
      const { texte, rappels } = encadreSansFinancement(p, portail != null);
      const cartes = cartesDuPlan(p);
      const selonDossier = p.nonChiffrees.length > 0 || p.options.some((o) => o.montantEstime == null);
      const optionsChiffrees = p.options.some((o) => o.montantEstime != null && o.montantEstime > 0);
      const contexte = `${JSON.stringify(over)} : ${texte}`;
      assert.deepEqual(rappels, rappelsAucunFinancement(p), contexte);
      assert.equal(texte.includes('Voici les aides identifiées'), !optionsChiffrees && rappels.length > 0, contexte);
      assert.equal(texte.includes('après étude du dossier'), selonDossier && (optionsChiffrees || rappels.length > 0), contexte);
      assert.equal(texte.includes('Seuls des services gratuits'), cartes.length > 0 && cartes.every((c) => c === 'services'), contexte);
      assert.equal(texte.includes('les portails officiels de la région'), !optionsChiffrees && rappels.length === 0 && portail != null, contexte);
      assert.ok(!/ [:;?!]/.test(texte), `espace ordinaire avant une ponctuation haute : ${texte}`);
      vus.add(texte);
    }
    assert.ok(sansFinancement >= 500, `seulement ${sansFinancement} états sans financement chiffré`);
    // Les tirages passent par au moins quatre des variantes (options, aides selon dossier, services seuls…).
    assert.ok(vus.size >= 4, `seulement ${vus.size} textes distincts : ${[...vus].join(' | ')}`);
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
