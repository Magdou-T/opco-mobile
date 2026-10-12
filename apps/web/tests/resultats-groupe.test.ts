// Écran de résultats d'un groupe (lib/resultats.ts) : identité pour une personne seule, plan du groupe, répartition entre
// profils, notes de l'OPCO, détails du bandeau, tableau par profil. Les attentes sont écrites à la main ; les tirages au
// hasard ont une graine fixe.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMBEDDED_AIDES,
  EMBEDDED_PORTAILS,
  calculateFunding,
  construirePlan,
  createInitialWizardState,
  dateDeReference,
  evaluerAides,
  fusionnerAides,
  getEmbeddedOpcoBySlug,
  profilDepuisWizard,
  profilsDuGroupe,
  repartirFinancement,
  resolveVarianteBranche,
} from '@opco/core';
import type { AideEvaluee, PlanFinancement, ProjetType, WizardState } from '@opco/core';
import { ouvreBudgetOpco } from '../src/lib/entreprise';
import { formatEuro, texteMoteur } from '../src/lib/format';
import { INSECABLE } from '../src/lib/insecable';
import { ajouterProfil, changerProjetDuProfil, definirNombre, etatDepuisPrix, majProfil } from '../src/lib/groupe';
import { coutsDeFormation } from '../src/lib/parcours';
import {
  calculer,
  cartesDuPlan,
  colonnesParProfil,
  concerneAAfficher,
  concerneParAide,
  detailsDuBandeau,
  etatEnTete,
  groupesAidesVisibles,
  libellesDesProfils,
  lignesParProfil,
  mentionOpcoDuGroupe,
  notesOpco,
  pourPersonnes,
} from '../src/lib/resultats';
import { encadreSansFinancement, planFermeDe, raisonPlanFerme, rappelsAucunFinancement } from '../src/lib/encadres-resultats';

const nb = INSECABLE;
const DATE = '2026-10-07';
const etat = (over: Partial<WizardState>): WizardState => ({ ...createInitialWizardState(), trainingMode: 'presentiel', ...over });

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
    microEntrepreneur: false, ageBeneficiaire: 45, formationType: 'non_certifiante', organismeQualiopi: true, ...coutsDeFormation(900, 21),
  },
};

/** mulberry32 : tirages indépendants et reproductibles. */
function generateur(graine: number) {
  let s = graine;
  return (n: number) => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
}

/** Le calcul de l'écran tel qu'il était avant les groupes (copie de l'ancien `calculer`) : l'oracle de l'identité pour une personne. */
function ancienCalcul(state: WizardState, aujourdhui: string) {
  const slug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = slug ? getEmbeddedOpcoBySlug(slug) : undefined;
  const effectiveState =
    !state.trainingDays && state.durationHours ? { ...state, trainingDays: Math.ceil(state.durationHours / 7) } : state;
  const projet = effectiveState.projetType ?? 'formation_salarie';
  const avecPdc = opco != null && ouvreBudgetOpco(projet);
  const funding = avecPdc ? calculateFunding(opco, effectiveState) : null;
  const variante = opco ? resolveVarianteBranche(opco, effectiveState) : null;
  const profil = profilDepuisWizard(effectiveState, slug);
  const aidesEvaluees = evaluerAides(EMBEDDED_AIDES, profil, dateDeReference(effectiveState.dateDebutFormation, aujourdhui));
  const plan = construirePlan(funding, aidesEvaluees, profil);
  const portail = EMBEDDED_PORTAILS.find((p) => p.region === profil.regionEntreprise) ?? null;
  return { opco, projet, funding, variante, profil, aidesEvaluees, plan, portail };
}

const PROJETS: ProjetType[] = ['formation_salarie', 'reconversion_salarie', 'recrutement_demandeur_emploi', 'alternance', 'formation_dirigeant'];
const OPCOS = ['akto', 'atlas', 'afdas', 'constructys', 'ocapiat', 'opco-ep', 'opco-mobilites', 'opco-sante', 'opco2i', 'opcommerce', 'uniformation'];

/** Un état de groupe tiré au hasard : projet, OPCO, taille, formation, puis 0 à 3 profils supplémentaires de 1 à 5 personnes. */
function groupeAleatoire(hasard: (n: number) => number): WizardState {
  const un = <T,>(l: readonly T[]): T => l[hasard(l.length)];
  const projet = un(PROJETS);
  let e = etat({
    projetType: projet,
    selectedOpcoSlug: hasard(6) === 0 ? null : un(OPCOS),
    regionCode: un(['11', '53', '76', '84'] as const),
    companySize: un(['less_11', '11_49', '50_299'] as const),
    ageBeneficiaire: un([19, 35, 58]),
    contractType: projet === 'alternance' ? 'alternance' : un(['cdi', 'cdd'] as const),
    typeAlternance: un(['apprentissage', 'professionnalisation'] as const),
    inscritFranceTravail: un([true, false]),
    statutDirigeant: un(['artisan', 'commercant', 'assimile_salarie'] as const),
    microEntrepreneur: un([null, false]),
    soldeCpf: un([null, 0, 800]),
    formationType: un(['non_certifiante', 'certification', 'cqp'] as const),
    eligibleCpf: un([null, true]),
    organismeQualiopi: un([null, true]),
    budgetDejaConsomme: un([null, 0, 3000]),
    ...coutsDeFormation(un([null, 900, 3500, 7000]), un([7, 21, 35, 140])),
  });
  e = definirNombre(e, 'principal', 1 + hasard(5));
  for (let i = hasard(4); i > 0; i--) {
    e = ajouterProfil(e);
    const id = e.autresProfils[e.autresProfils.length - 1].id;
    e = changerProjetDuProfil(e, id, un(PROJETS));
    e = majProfil(e, id, { ageBeneficiaire: un([19, 35, 58]), isHandicap: hasard(3) === 0, soldeCpf: un([null, 800]) });
    e = definirNombre(e, id, 1 + hasard(5));
  }
  return e;
}

/**
 * Un état de groupe aussi varié que ceux du test d'une personne seule (tests/resultats.test.ts, graine 29) : le profil principal
 * est tiré comme là-bas (projet, OPCO, région, taille, âge, formation, solde CPF, coût, durée), puis 0 à 3 profils supplémentaires de
 * 1 à 5 personnes, qui ont souvent le projet du profil principal (un groupe réunit le plus souvent des personnes de même statut).
 */
function groupeVaste(hasard: (n: number) => number): WizardState {
  const un = <T,>(l: readonly T[]): T => l[hasard(l.length)];
  const projet = un(PROJETS);
  const heures = un([7, 21, 35, 140, 280, 800]);
  let e = etat({
    projetType: projet,
    selectedOpcoSlug: projet === 'formation_dirigeant' && hasard(2) === 0 ? null : un(OPCOS),
    regionCode: un([null, ...EMBEDDED_PORTAILS.map((p) => p.region)]), // la région peut manquer : alors aucun portail à citer
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
  });
  e = definirNombre(e, 'principal', 1 + hasard(5));
  for (let i = hasard(4); i > 0; i--) {
    e = ajouterProfil(e);
    const id = e.autresProfils[e.autresProfils.length - 1].id;
    const projetDuProfil = un([projet, projet, ...PROJETS]);
    e = changerProjetDuProfil(e, id, projetDuProfil);
    e = majProfil(e, id, {
      ageBeneficiaire: un([19, 28, 45, 58]),
      isHandicap: hasard(3) === 0,
      contractType: projetDuProfil === 'alternance' ? 'alternance' : un(['cdi', 'cdd'] as const),
      typeAlternance: un(['apprentissage', 'professionnalisation'] as const),
      inscritFranceTravail: un([true, false]),
      statutDirigeant: un(['artisan', 'commercant', 'profession_liberale', 'assimile_salarie'] as const),
      microEntrepreneur: un([null, true, false]),
      soldeCpf: un([null, 0, 800, 2000]),
    });
    e = definirNombre(e, id, 1 + hasard(5));
  }
  return e;
}

const centimes = (euros: number) => Math.round(euros * 100);
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

describe("une personne : le calcul de l'écran rend ce qu'il rendait avant les groupes", () => {
  test('les cinq scénarios', () => {
    for (const [nom, parcours] of Object.entries(SCENARIOS)) {
      const { groupe, ...apres } = calculer(etat(parcours), DATE);
      assert.deepEqual(apres, ancienCalcul(etat(parcours), DATE), nom);
      assert.equal(groupe.personnes, 1, nom);
      assert.equal(groupe.blocs.length, 1, nom);
      assert.equal(groupe.personnesPdc, apres.funding ? 1 : 0, nom); // la personne relève du plan de l'OPCO quand le moteur est appelé
      assert.equal(groupe.blocs[0].funding, apres.funding, nom); // le même objet : la part du seul profil salarié est le résultat entier
      assert.deepEqual(groupe.blocs[0].aides, apres.aidesEvaluees, nom);
    }
  });

  test("400 états tirés au hasard (graine 5), un seul profil d'une personne", () => {
    const hasard = generateur(5);
    for (let i = 0; i < 400; i++) {
      const e = groupeAleatoire(hasard);
      const seul = { ...e, nombrePersonnes: 1, autresProfils: [] };
      const { groupe, ...apres } = calculer(seul, DATE);
      assert.deepEqual(apres, ancienCalcul(seul, DATE), JSON.stringify(seul));
      assert.equal(groupe.blocs[0].plan, apres.plan);
      assert.equal(groupe.personnesPdc, apres.funding ? 1 : 0, JSON.stringify(seul));
      assert.equal(groupe.blocs[0].funding, apres.funding, JSON.stringify(seul));
      assert.deepEqual(groupe.blocs[0].aides, apres.aidesEvaluees, JSON.stringify(seul));
    }
  });
});

describe('un groupe de profils identiques', () => {
  const quatre = () => calculer(etat({ ...SCENARIOS.akto, nombrePersonnes: 4 }), DATE);
  const une = () => calculer(etat(SCENARIOS.akto), DATE);

  test("quatre salariés : un profil, quatre personnes, le calcul de l'OPCO pour quatre", () => {
    const r = quatre();
    assert.deepEqual([r.groupe.personnes, r.groupe.personnesPdc, r.groupe.blocs.length], [4, 4, 1]);
    assert.equal(r.funding?.personnes, 4);
    assert.equal(r.plan.coutFormation, 4 * une().plan.coutFormation);
    assert.ok(r.plan.financements.length > 0);
    assert.ok(r.plan.financements.every((l) => l.personnes === 4));
  });

  const pdc = (r: ReturnType<typeof calculer>) => r.plan.financements.find((l) => l.id === 'opco-pdc')!.montant;
  const cpf = (r: ReturnType<typeof calculer>) => r.aidesEvaluees.find((a) => a.id === 'nat-cpf');
  const ligneCpf = (r: ReturnType<typeof calculer>) => r.plan.financements.find((l) => l.id === 'nat-cpf');

  test("sous le plafond annuel, le financement de l'OPCO vaut exactement 4 fois celui d'une personne", () => {
    // 35 h à 30 € de l'heure, comme le scénario : le coût de quatre personnes reste sous le plafond annuel (prémisse vérifiée).
    const parcours = { ...SCENARIOS.akto, ...coutsDeFormation(1050, 35) };
    const seul = calculer(etat(parcours), DATE);
    const groupe = calculer(etat({ ...parcours, nombrePersonnes: 4 }), DATE);
    assert.equal(seul.funding?.budgetCapApplied, false);
    assert.equal(groupe.funding?.budgetCapApplied, false);
    assert.equal(centimes(groupe.funding!.totalFunded), 4 * centimes(seul.funding!.totalFunded));
    assert.equal(centimes(pdc(groupe)), 4 * centimes(pdc(seul)));
  });

  test("plafond annuel atteint par quatre personnes : le financement de l'OPCO ne dépasse ni ce plafond ni 4 fois celui d'une personne", () => {
    const seul = une();
    const groupe = quatre();
    assert.equal(seul.funding?.budgetCapApplied, false); // une personne reste sous le plafond : 4 fois son financement est celui du groupe sans plafond
    assert.equal(groupe.funding?.budgetCapApplied, true);
    const plafond = groupe.funding!.budgetCapAmount!; // le plafond restant, tel que le moteur l'applique
    assert.ok(pdc(groupe) <= plafond, `${pdc(groupe)} dépasse le plafond ${plafond}`);
    assert.ok(pdc(groupe) < 4 * pdc(seul), `${pdc(groupe)} n'est pas sous 4 fois ${pdc(seul)}`);
  });

  test("une aide du catalogue : son montant par personne est celui d'une personne, le plan le multiplie", () => {
    // Le CPF se chiffre sur le solde de chaque personne : 800 €. Dans un plan, sa ligne ne dépasse ni son montant, ni le reste à
    // charge après les financements empilés avant elle, ni le solde restant (construirePlan).
    const avecSolde = { ...SCENARIOS.akto, soldeCpf: 800 };
    const seul = calculer(etat(avecSolde), DATE);
    const groupe = calculer(etat({ ...avecSolde, nombrePersonnes: 4 }), DATE);
    assert.equal(cpf(seul)?.montantEstime, 800);
    assert.equal(cpf(groupe)?.montantEstime, 800); // par personne, quel que soit l'effectif
    assert.equal(cpf(groupe)?.profils, undefined); // un seul profil : aucun champ « profils »
    // Une personne : l'OPCO couvre à lui seul le coût, le reste à charge est nul, le CPF n'a plus rien à financer : pas de ligne.
    assert.equal(pdc(seul), seul.plan.coutFormation);
    assert.equal(ligneCpf(seul), undefined);
    // Quatre personnes : le CPF prend le montant de quatre personnes (4 × 800 €, comme leur solde), le reste après l'OPCO suffit.
    const reste = groupe.plan.coutFormation - pdc(groupe);
    assert.ok(reste >= 4 * 800, `le reste à charge après l'OPCO (${reste} €) plafonnerait la ligne`);
    assert.deepEqual([ligneCpf(groupe)?.montant, ligneCpf(groupe)?.personnes], [Math.min(4 * 800, reste), 4]);
  });

  test('sans OPCO, le CPF ouvre le plan : 800 € pour une personne, quatre fois plus pour quatre', () => {
    const sansOpco = { ...SCENARIOS.akto, selectedOpcoSlug: null, soldeCpf: 800 };
    const seul = calculer(etat(sansOpco), DATE);
    const groupe = calculer(etat({ ...sansOpco, nombrePersonnes: 4 }), DATE);
    assert.equal(cpf(groupe)?.montantEstime, cpf(seul)?.montantEstime);
    // Une personne : min(800 €, 4 200 € de reste, 800 € de solde) ; quatre : min(3 200 €, 16 800 €, 3 200 €), pour 4 personnes.
    assert.deepEqual([ligneCpf(seul)?.montant, ligneCpf(seul)?.personnes], [800, undefined]);
    assert.deepEqual([ligneCpf(groupe)?.montant, ligneCpf(groupe)?.personnes], [3200, 4]);
    assert.equal(groupe.plan.coutFormation, 4 * seul.plan.coutFormation);
  });
});

describe('un groupe mixte : trois salariés et un dirigeant artisan', () => {
  const mixte = () => {
    let e = etat({
      ...SCENARIOS.artisan,
      selectedOpcoSlug: 'akto',
      projetType: 'formation_salarie',
      contractType: 'cdi',
      statutDirigeant: null,
      microEntrepreneur: null,
      ageBeneficiaire: 35,
      nombrePersonnes: 3,
    });
    e = ajouterProfil(e);
    e = changerProjetDuProfil(e, 'profil-2', 'formation_dirigeant');
    return majProfil(e, 'profil-2', { statutDirigeant: 'artisan', microEntrepreneur: false, ageBeneficiaire: 45 });
  };

  test("l'OPCO est calculé pour les trois salariés seulement, le dirigeant passe par ses aides", () => {
    const r = calculer(mixte(), DATE);
    assert.deepEqual([r.groupe.personnes, r.groupe.personnesPdc, r.groupe.blocs.length], [4, 3, 2]);
    assert.equal(r.funding?.personnes, 3);
    assert.equal(r.groupe.blocs[0].funding?.personnes, 3);
    assert.equal(r.groupe.blocs[1].funding, null);
    assert.equal(r.plan.coutFormation, 3600); // 4 × 900 €
  });

  test("le plan du groupe cumule la ligne de l'OPCO (3 personnes) et le fonds du dirigeant (1 personne)", () => {
    const r = calculer(mixte(), DATE);
    assert.equal(r.plan.financements.find((l) => l.id === 'opco-pdc')?.personnes, 3);
    assert.deepEqual(
      r.groupe.blocs[1].plan.financements.map((l) => [l.id, l.montant]),
      [['faf-fafcea', 735]],
    );
    assert.equal(r.groupe.blocs[0].plan.financements.some((l) => l.id === 'faf-fafcea'), false);
    assert.equal(r.plan.financements.find((l) => l.id === 'faf-fafcea')?.personnes, 1);
  });

  test('les aides du catalogue indiquent les profils concernés', () => {
    const r = calculer(mixte(), DATE);
    const faf = r.aidesEvaluees.find((a) => a.id === 'faf-fafcea');
    assert.deepEqual(faf?.profils?.map((p) => [p.profilId, p.nombre, p.statut, p.montantEstime]), [['profil-2', 1, 'eligible', 735]]);
  });
});

describe('le coût de la formation du groupe est exactement le prix saisi', () => {
  // Trois profils d'une personne (le profil principal et deux profils supplémentaires de même statut), prix saisi pour le groupe.
  const profilsD = (n: number, prixDuGroupe: number) => {
    let e = etat({ ...SCENARIOS.akto, selectedOpcoSlug: null, nombrePersonnes: 1 });
    for (let i = 1; i < n; i++) e = ajouterProfil(e);
    return etatDepuisPrix(e, prixDuGroupe, 140, true);
  };

  test("1 000 € pour trois profils d'une personne : le plan coûte 1 000 €, réparti 333,34 / 333,33 / 333,33 (jamais 999,99 €)", () => {
    const r = calculer(profilsD(3, 1000), DATE);
    assert.equal(r.plan.coutFormation, 1000);
    assert.deepEqual(r.groupe.blocs.map((b) => b.plan.coutFormation), [333.34, 333.33, 333.33]);
  });

  test("1 000 € pour six profils d'une personne : le plan coûte 1 000 €, jamais 1 000,02 €", () => {
    const r = calculer(profilsD(6, 1000), DATE);
    assert.equal(r.plan.coutFormation, 1000);
    assert.deepEqual(r.groupe.blocs.map((b) => b.plan.coutFormation), [166.67, 166.67, 166.67, 166.67, 166.66, 166.66]);
  });

  test("un seul profil de trois personnes : le coût d'une personne multiplié par trois, sans répartition", () => {
    let e = etat({ ...SCENARIOS.akto, selectedOpcoSlug: null, nombrePersonnes: 3 });
    e = etatDepuisPrix(e, 1000, 140, true);
    const r = calculer(e, DATE);
    assert.equal(r.plan.coutFormation, 1000);
    assert.equal(r.groupe.blocs.length, 1);
  });

  test("coût par personne au centime : le plan du groupe vaut ce coût multiplié par l'effectif, quels que soient les profils", () => {
    let e = etat({ ...SCENARIOS.akto, selectedOpcoSlug: null, nombrePersonnes: 2, ...coutsDeFormation(800.2, 35) });
    e = definirNombre(ajouterProfil(e), 'profil-2', 3);
    assert.equal(calculer(e, DATE).plan.coutFormation, 4001);
  });
});

describe("situations limites d'un groupe", () => {
  test("aucun salarié (dirigeant et alternant) : pas de calcul de l'OPCO, même avec un OPCO connu", () => {
    let e = etat({ ...SCENARIOS.artisan, selectedOpcoSlug: 'akto', nombrePersonnes: 2 });
    e = ajouterProfil(e);
    e = changerProjetDuProfil(e, 'profil-2', 'alternance');
    e = majProfil(e, 'profil-2', { typeAlternance: 'apprentissage', ageBeneficiaire: 19 });
    const r = calculer(e, DATE);
    assert.equal(r.funding, null);
    assert.equal(r.groupe.personnesPdc, 0);
    assert.ok(r.groupe.blocs.every((b) => b.funding === null));
    assert.equal(r.groupe.personnes, 3);
  });

  test("sans OPCO connu : pas de calcul de l'OPCO pour les salariés non plus", () => {
    const r = calculer(etat({ ...SCENARIOS.akto, selectedOpcoSlug: null, nombrePersonnes: 3 }), DATE);
    assert.equal(r.opco, undefined);
    assert.equal(r.funding, null);
    assert.equal(r.groupe.personnesPdc, 0);
  });

  test('coût de la formation inconnu : coût nul, état « coût inconnu », aucun nombre invalide', () => {
    const r = calculer(etat({ ...SCENARIOS.akto, nombrePersonnes: 3, ...coutsDeFormation(null, 140) }), DATE);
    assert.equal(r.plan.coutFormation, 0);
    assert.equal(etatEnTete(r.plan), 'cout_inconnu');
    assert.deepEqual(detailsDuBandeau(r.plan, r.groupe.personnes), { cout: null, reste: null });
    for (const n of [r.plan.coutFormation, r.plan.totalFinance, r.plan.resteACharge]) assert.ok(Number.isFinite(n));
  });

  test("plafond annuel épuisé par le budget déjà consommé : rien de financé par l'OPCO pour le groupe, jamais de montant négatif", () => {
    const r = calculer(etat({ ...SCENARIOS.akto, nombrePersonnes: 5, budgetDejaConsomme: 10_000_000 }), DATE);
    assert.equal(r.plan.financements.find((l) => l.id === 'opco-pdc'), undefined);
    assert.ok(r.plan.resteACharge >= 0 && r.plan.totalFinance >= 0);
  });
});

describe('groupes tirés au hasard : cohérence du plan et des parts (1 000, graine 17), textes du calcul (300, graine 23), encadré sans financement (2 500, graine 29)', () => {
  test("les profils s'additionnent en centimes, aucun plan ne dépasse son coût, aucune aide n'est à la fois en ligne et sans montant, rien n'est invalide", () => {
    const hasard = generateur(17);
    let avecPlusieursProfils = 0;
    let avecPlusieursSalaries = 0;
    let avecAideEnLigneEtSansMontant = 0;
    /** Identifiants des aides qui ont une ligne dans un plan : chiffrée, ou option (même selon dossier). */
    const idsEnLigne = (p: PlanFinancement) =>
      [...p.financements, ...p.options, ...p.aidesEmployeur, ...p.remunerations, ...p.avantagesFiscauxSociaux].map((l) => l.id);
    for (let i = 0; i < 1000; i++) {
      const e = groupeAleatoire(hasard);
      const r = calculer(e, DATE);
      const contexte = JSON.stringify(e);
      const { blocs, personnes } = r.groupe;
      assert.equal(personnes, blocs.reduce((s, b) => s + b.profil.nombre, 0), contexte);
      for (const champ of ['coutFormation', 'totalFinance', 'resteACharge'] as const) {
        assert.equal(centimes(r.plan[champ]), blocs.reduce((s, b) => s + centimes(b.plan[champ]), 0), `${champ} ${contexte}`);
        assert.ok(Number.isFinite(r.plan[champ]) && r.plan[champ] >= 0, `${champ} ${contexte}`);
      }
      assert.equal(centimes(r.plan.coutFormation - r.plan.resteACharge), centimes(r.plan.totalFinance), contexte);
      for (const b of blocs) {
        assert.ok(b.plan.totalFinance <= b.plan.coutFormation + 0.001, contexte);
        assert.ok(b.plan.resteACharge >= 0, contexte);
      }
      if (blocs.length > 1) {
        avecPlusieursProfils++;
        const lignes = [...r.plan.financements, ...r.plan.aidesEmployeur, ...r.plan.remunerations, ...r.plan.avantagesFiscauxSociaux];
        assert.ok(lignes.every((l) => l.personnes != null && l.personnes >= 1), contexte);
      }
      // Disjoints : aucune aide du plan du groupe n'est à la fois une ligne (financements, options, aides à l'employeur,
      // rémunérations, avantages) et une aide sans montant ou un service gratuit.
      const enLigne = new Set(idsEnLigne(r.plan));
      const aussiSansMontant = [...r.plan.nonChiffrees, ...r.plan.servicesGratuits].filter((a) => enLigne.has(a.id));
      assert.deepEqual(aussiSansMontant.map((a) => a.id), [], contexte);
      // Les tirages où un profil a en ligne une aide qu'un autre profil n'a que sans montant : la propriété s'y exerce.
      const enLigneDesProfils = new Set(blocs.flatMap((b) => idsEnLigne(b.plan)));
      if (blocs.some((b) => [...b.plan.nonChiffrees, ...b.plan.servicesGratuits].some((a) => enLigneDesProfils.has(a.id)))) {
        avecAideEnLigneEtSansMontant++;
      }
      // Les parts de l'OPCO s'additionnent au résultat du groupe, poste par poste, au centime.
      const parts = blocs.filter((b) => b.funding);
      if (r.funding && parts.length > 1) {
        avecPlusieursSalaries++;
        r.funding.lines.forEach((l, j) => {
          assert.equal(centimes(l.fundedAmount), parts.reduce((s, b) => s + centimes(b.funding!.lines[j].fundedAmount), 0), contexte);
          assert.equal(centimes(l.requestedAmount), parts.reduce((s, b) => s + centimes(b.funding!.lines[j].requestedAmount), 0), contexte);
        });
      }
      if (r.funding) assert.equal(r.funding.personnes, r.groupe.personnesPdc, contexte);
    }
    assert.ok(avecPlusieursProfils >= 300, String(avecPlusieursProfils));
    assert.ok(avecPlusieursSalaries >= 60, String(avecPlusieursSalaries));
    assert.ok(avecAideEnLigneEtSansMontant >= 100, String(avecAideEnLigneEtSansMontant));
  });

  test("les textes du calcul d'un groupe, une fois rendus, ne contiennent aucun nombre à point (hors adresses et citations)", () => {
    const hasard = generateur(23);
    let textes = 0;
    for (let i = 0; i < 300; i++) {
      const { funding } = calculer(groupeAleatoire(hasard), DATE);
      if (!funding) continue;
      for (const t of [...funding.lines.flatMap((l) => [l.note ?? '', ...(l.details ?? [])]), ...funding.warnings]) {
        const lu = texteMoteur(t).replace(/https?:\S+/g, '').replace(/«[^»]*»/g, '');
        textes++;
        assert.doesNotMatch(lu, /\d\.\d/, t);
      }
    }
    assert.ok(textes > 1000, String(textes));
  });

  test("l'encadré « aucun financement chiffré » ne dit rien de faux sur un groupe", () => {
    // Les conditions du test d'une personne seule (tests/resultats.test.ts, graine 29), toutes, sur des groupes. Elles s'écrivent sans
    // la logique de l'encadré : on lit la liste des aides rendue plus bas (groupesAidesVisibles, celle d'AidesList) et les cartes du
    // plan du groupe (cartesDuPlan), puis on confronte chaque phrase à ce qu'elles montrent. Aucune condition n'est retirée : elles
    // ne comparent que la présence d'un montant, d'une carte ou d'une aide. Pour un groupe, le montant d'une aide listée est le plus
    // grand montant PAR PERSONNE des profils concernés (jamais une somme, vérifié plus bas) ; seules les cartes portent des sommes.
    const hasard = generateur(29);
    const vus = new Set<string>();
    const compte = {
      sansFinancement: 0,
      plusieursProfils: 0,
      sansPortail: 0,
      aVerifierChiffrees: 0,
      troisiemeAvecAVerifierChiffrees: 0,
      servicesSeuls: 0,
      aucuneAideAMontant: 0,
    };
    for (let i = 0; i < 2500; i++) {
      const e = groupeVaste(hasard);
      const { plan: p, portail, aidesEvaluees, funding, groupe } = calculer(e, DATE);
      if (etatEnTete(p) !== 'aucun_financement_chiffre') continue;
      compte.sansFinancement++;
      if (groupe.blocs.length > 1) compte.plusieursProfils++;
      if (portail == null) compte.sansPortail++;
      // Comme l'écran : le plan de l'OPCO fermé aux 50 salariés et plus (planFermeDe) ouvre l'encadré par sa raison.
      const planFerme = planFermeDe(funding);
      const { texte, rappels, aidesAVerifier, detailOpco } = encadreSansFinancement(p, aidesEvaluees, portail != null, planFerme);
      const contexte = `${JSON.stringify(e)} : ${texte}`;
      assert.equal(texte.startsWith(planFerme ? raisonPlanFerme(planFerme) : 'Aucun financement'), true, contexte);
      assert.equal(detailOpco, planFerme != null, contexte);

      // Ce que la page montre sous le bandeau.
      const listeesPlusBas = groupesAidesVisibles(aidesEvaluees).flatMap((g) => g.aides);
      const aVerifier = listeesPlusBas.filter((a) => a.statut === 'a_verifier');
      const aVerifierChiffrees = aVerifier.filter((a) => (a.montantEstime ?? 0) > 0);
      const cartes = cartesDuPlan(p);
      const montantsDesCartes = [
        ...p.options.map((o) => o.montantEstime ?? 0),
        ...[...p.aidesEmployeur, ...p.remunerations, ...p.avantagesFiscauxSociaux].map((l) => l.montant),
      ];
      const aideAMontant = listeesPlusBas.some((a) => (a.montantEstime ?? 0) > 0) || montantsDesCartes.some((m) => m > 0);
      if (aVerifierChiffrees.length > 0) compte.aVerifierChiffrees++;
      // Le montant d'une aide listée pour plusieurs profils est leur plus grand montant par personne : l'encadré n'en lit jamais une somme.
      for (const a of listeesPlusBas) {
        if (!a.profils) continue;
        const montants = a.profils.flatMap((x) => (x.montantEstime == null ? [] : [x.montantEstime]));
        assert.equal(a.montantEstime, montants.length > 0 ? Math.max(...montants) : null, `${a.id} ${contexte}`);
      }

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
    assert.ok(compte.plusieursProfils >= 500 && compte.sansPortail >= 30, JSON.stringify(compte));
    // Les tirages atteignent au moins 30 fois la troisième variante de l'encadré (ni option chiffrée ni carte d'aides) avec des aides
    // « à vérifier » chiffrées : les conditions ci-dessus s'y exercent aussi, pas seulement sur les deux premières variantes.
    assert.ok(compte.troisiemeAvecAVerifierChiffrees >= 30, JSON.stringify(compte));
    assert.ok(compte.servicesSeuls >= 10 && compte.aucuneAideAMontant >= 10, JSON.stringify(compte));
    assert.ok(vus.size >= 8, `seulement ${vus.size} textes distincts : ${[...vus].join(' | ')}`);
  });
});

describe("encadré « aucun financement chiffré » : les aides fusionnées d'un groupe, là où les tirages n'atteignent pas", () => {
  // Le catalogue ne produit aucun état où une aide listée porte un montant sans que sa carte soit un financement ou un rappel, ni où
  // seuls des services « à vérifier » sont listés sans carte : ni pour une personne ni pour un groupe (la propriété ci-dessus garde ces
  // conditions écrites). Ces deux cas se lisent donc sur des aides construites, fusionnées comme le fait le calcul du groupe.
  const [p1, p2] = profilsDuGroupe(definirNombre(ajouterProfil(etat({ projetType: 'formation_salarie' })), 'profil-2', 3));
  const aide = (id: string, over: Partial<AideEvaluee>): AideEvaluee => ({
    id,
    nom: `Aide ${id}`,
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
  });

  test('une aide chiffrée pour un seul profil : son montant est un maximum par personne, et il interdit « aucune autre aide à montant »', () => {
    const avantage = (statut: AideEvaluee['statut'], montantEstime: number | null) =>
      aide('avantage', { categorie: 'avantage_fiscal_social', statut, montantEstime });
    const aides = fusionnerAides([
      { profil: p1, aides: [avantage('non_eligible', null)] },
      { profil: p2, aides: [avantage('eligible', 300)] },
    ]);
    assert.deepEqual(aides[0].profils, [{ profilId: 'profil-2', nombre: 3, statut: 'eligible', montantEstime: 300 }]);
    assert.equal(aides[0].montantEstime, 300); // par personne ; la carte du plan, elle, porte la somme du groupe
    const planDuGroupe = plan({
      coutFormation: 4000,
      resteACharge: 4000,
      avantagesFiscauxSociaux: [{ id: 'avantage', nom: 'Aide avantage', financeurNom: 'Financeur', montant: 900, confidence: 'exact', personnes: 3 }],
    });
    const { texte } = encadreSansFinancement(planDuGroupe, aides, false);
    assert.ok(!texte.includes('aucune autre aide à montant'), texte);
  });

  test('des services seuls : dits quand la carte des services les montre, tus quand le service reste « à vérifier » pour tous les profils', () => {
    const service = (statut: AideEvaluee['statut']) => aide('cep', { categorie: 'service_gratuit', statut });
    const aVerifier = fusionnerAides([
      { profil: p1, aides: [service('a_verifier')] },
      { profil: p2, aides: [service('a_verifier')] },
    ]);
    const sansCarte = encadreSansFinancement(plan({ coutFormation: 4000, resteACharge: 4000 }), aVerifier, false);
    assert.ok(!sansCarte.texte.includes('Seuls des services gratuits'), sansCarte.texte);
    const eligible = fusionnerAides([
      { profil: p1, aides: [service('non_eligible')] },
      { profil: p2, aides: [service('eligible')] },
    ]);
    const avecCarte = encadreSansFinancement(plan({ coutFormation: 4000, resteACharge: 4000, servicesGratuits: [eligible[0]] }), eligible, false);
    assert.ok(avecCarte.texte.includes('Seuls des services gratuits'), avecCarte.texte);
  });
});

describe('notes sous le bandeau pour un groupe (notesOpco)', () => {
  test("un seul projet : les notes d'une personne seule", () => {
    assert.deepEqual(notesOpco(['formation_salarie'], true), [{ genre: 'sans-opco', titre: 'Aucun OPCO renseigné' }]);
    assert.deepEqual(notesOpco(['formation_salarie', 'formation_salarie'], false), []);
    assert.deepEqual(notesOpco(['formation_dirigeant'], true), [
      { genre: 'dirigeant', titre: 'Pas de calcul du plan de développement des compétences pour ce projet' },
    ]);
    assert.deepEqual(notesOpco(['formation_dirigeant', 'formation_dirigeant'], false), [
      { genre: 'dirigeant', titre: 'OPCO non compté pour un dirigeant' },
    ]);
    assert.deepEqual(notesOpco(['alternance'], true), []);
    assert.deepEqual(notesOpco([null], true), [{ genre: 'sans-opco', titre: 'Aucun OPCO renseigné' }]);
  });

  test("plusieurs projets : chaque note qui s'applique, une fois", () => {
    assert.deepEqual(notesOpco(['formation_salarie', 'formation_dirigeant'], false), [
      { genre: 'dirigeant', titre: 'OPCO non compté pour le dirigeant du groupe' },
    ]);
    assert.deepEqual(notesOpco(['formation_dirigeant', 'formation_salarie'], true), [
      { genre: 'sans-opco', titre: 'Aucun OPCO renseigné' },
      { genre: 'dirigeant', titre: 'OPCO non compté pour le dirigeant du groupe' },
    ]);
    assert.deepEqual(notesOpco(['alternance', 'recrutement_demandeur_emploi'], true), []);
    assert.deepEqual(notesOpco(['alternance', 'formation_dirigeant'], true), [
      { genre: 'dirigeant', titre: 'OPCO non compté pour le dirigeant du groupe' },
    ]);
  });
});

describe('détails du bandeau, mentions et tableau par profil', () => {
  test('detailsDuBandeau : rien pour une personne ou un coût inconnu ; sinon le coût par personne et le reste moyen', () => {
    assert.deepEqual(detailsDuBandeau({ coutFormation: 2800, resteACharge: 1750 }, 1), { cout: null, reste: null });
    assert.deepEqual(detailsDuBandeau({ coutFormation: 0, resteACharge: 0 }, 4), { cout: null, reste: null });
    assert.deepEqual(detailsDuBandeau({ coutFormation: 11200, resteACharge: 6825 }, 4), {
      cout: `4${nb}×${nb}${formatEuro(2800)}`,
      reste: `${formatEuro(1706.25)} par personne en moyenne`,
    });
    assert.equal(detailsDuBandeau({ coutFormation: 11200, resteACharge: 0 }, 4).reste, null);
    // Prix du groupe qui ne se divise pas au centime : 3 × 333,33 € ferait 999,99 €, le détail dit la moyenne, jamais un produit faux.
    assert.equal(detailsDuBandeau({ coutFormation: 1000, resteACharge: 0 }, 3).cout, `${formatEuro(333.33)} par personne en moyenne`);
  });

  test('pourPersonnes : « pour 3 personnes », « pour 1 personne », espace insécable', () => {
    assert.equal(pourPersonnes(3), `pour 3${nb}personnes`);
    assert.equal(pourPersonnes(1), `pour 1${nb}personne`);
  });

  test('mentionOpcoDuGroupe : pour qui le calcul est fait ; rien pour une personne ou sans salarié', () => {
    assert.equal(mentionOpcoDuGroupe(3, 1), null);
    assert.equal(mentionOpcoDuGroupe(0, 4), null);
    assert.equal(mentionOpcoDuGroupe(4, 4), `Calcul pour les 4${nb}personnes du groupe.`);
    assert.equal(mentionOpcoDuGroupe(3, 5), `Calcul pour les 3${nb}salariés du groupe (5${nb}personnes au total).`);
    assert.equal(mentionOpcoDuGroupe(1, 5), `Calcul pour le salarié du groupe (5${nb}personnes au total).`);
  });

  test('lignesParProfil : une ligne par profil, le total en centimes', () => {
    let e = etat({ projetType: 'formation_salarie', contractType: 'cdi', ageBeneficiaire: 35, nombrePersonnes: 3 });
    e = ajouterProfil(e);
    e = changerProjetDuProfil(e, 'profil-2', 'formation_dirigeant');
    e = majProfil(e, 'profil-2', { statutDirigeant: 'artisan', ageBeneficiaire: 52, isHandicap: true });
    const [p1, p2] = profilsDuGroupe(e);
    const { lignes, total } = lignesParProfil([
      { profil: p1, plan: plan({ coutFormation: 8400, totalFinance: 3150, resteACharge: 5250 }) },
      { profil: p2, plan: plan({ coutFormation: 2800, totalFinance: 1225, resteACharge: 1575 }) },
    ]);
    assert.deepEqual(lignes.map((l) => [l.rang, l.nombre, l.cout, l.finance, l.reste]), [
      [1, 3, 8400, 3150, 5250],
      [2, 1, 2800, 1225, 1575],
    ]);
    assert.equal(lignes[0].libelle, `Salarié en CDI, 35${nb}ans`);
    assert.equal(lignes[1].libelle, `Dirigeant artisan, 52${nb}ans, RQTH`);
    assert.deepEqual(total, { nombre: 4, cout: 11200, finance: 4375, reste: 6825 });
  });

  test('concerneParAide : une ligne par profil concerné, avec son effectif et son statut', () => {
    let e = etat({ projetType: 'formation_salarie', contractType: 'cdi', ageBeneficiaire: 35, nombrePersonnes: 3 });
    e = ajouterProfil(e);
    const libelles = libellesDesProfils(profilsDuGroupe(e));
    assert.equal(libelles.get('principal'), `Profil 1 · Salarié en CDI, 35${nb}ans`);
    assert.deepEqual(
      concerneParAide(
        {
          profils: [
            { profilId: 'principal', nombre: 3, statut: 'eligible', montantEstime: 1000 },
            { profilId: 'profil-2', nombre: 1, statut: 'a_verifier', montantEstime: null },
          ],
        },
        libelles,
      ),
      [`Profil 1 · Salarié en CDI, 35${nb}ans, 3${nb}personnes${nb}: éligible`, `Profil 2 · Salarié, 1${nb}personne${nb}: à vérifier`],
    );
    assert.deepEqual(concerneParAide({}, libelles), []);
  });
});

// --- Ce que le calcul d'un groupe garantit, au-delà des cas de base ---------------------------------------------------------
// Une personne seule rend l'ancien calcul même hors des cas courants. Le moteur de l'OPCO est appelé une fois pour les salariés et
// chaque profil salarié porte sa part, dans l'ordre. Le coût du groupe se répartit au centime entre les profils. Les financements
// suivent l'ordre d'empilement des aides. Les détails du bandeau, les mentions et les totaux du tableau restent justes à deux
// personnes et au centime près.

/** Postes du résultat de l'OPCO qui forment la ligne « plan de développement des compétences » du plan. */
const POSTES_DE_FORMATION = ['pedagogie', 'hebergement', 'restauration', 'frais_annexes'];
const ligneOpco = (p: PlanFinancement) => p.financements.find((l) => l.id === 'opco-pdc');
const salairesOpco = (p: PlanFinancement) => p.aidesEmployeur.find((l) => l.id === 'opco-salaires')?.montant;
/** Tout montant d'un plan est un nombre fini, positif ou nul. */
const verifierMontants = (p: PlanFinancement, contexte: string) => {
  const montants = [
    p.coutFormation,
    p.totalFinance,
    p.resteACharge,
    ...[...p.financements, ...p.aidesEmployeur, ...p.remunerations, ...p.avantagesFiscauxSociaux].map((l) => l.montant),
    ...p.options.flatMap((o) => (o.montantEstime == null ? [] : [o.montantEstime])),
  ];
  for (const n of montants) assert.ok(Number.isFinite(n) && n >= 0, `${n} ${contexte}`);
};

describe("une personne seule : l'ancien calcul, même hors des cas courants", () => {
  test("un coût à trois décimales avec des frais annexes : aucune répartition du coût, le plan d'avant les groupes", () => {
    for (const cout of [0.025, 0.035, 0.065]) {
      const e = etat({ ...SCENARIOS.akto, selectedOpcoSlug: null, needsMeals: true, mealCostPerDay: 33.33, trainingDays: 1, pedagogyCostTotal: cout });
      const { groupe, ...apres } = calculer(e, DATE);
      assert.deepEqual(apres, ancienCalcul(e, DATE), String(cout));
      assert.equal(groupe.blocs[0].plan, apres.plan, String(cout));
    }
  });

  test('jours de formation à 0 : 7 heures par jour, pour une personne comme pour chaque profil du groupe', () => {
    const repas = { ...SCENARIOS.akto, selectedOpcoSlug: null, needsMeals: true, mealCostPerDay: 20, trainingDays: 0 };
    const seul = calculer(etat(repas), DATE);
    assert.equal(seul.profil.coutFraisAnnexes, 400); // 140 h : 20 jours de repas à 20 €
    assert.deepEqual(seul.plan, ancienCalcul(etat(repas), DATE).plan);
    const deux = calculer(ajouterProfil(etat({ ...repas, nombrePersonnes: 2 })), DATE);
    assert.deepEqual(deux.groupe.blocs.map((b) => b.profilAides.coutFraisAnnexes), [400, 400]);
  });

  test("le calcul ne modifie pas l'état qu'on lui donne et rend deux fois la même chose", () => {
    const hasard = generateur(31);
    for (let i = 0; i < 40; i++) {
      const e = groupeAleatoire(hasard);
      const copie = structuredClone(e);
      const premier = calculer(e, DATE);
      assert.deepEqual(e, copie, JSON.stringify(e));
      assert.deepEqual(calculer(e, DATE), premier, JSON.stringify(e));
    }
  });
});

describe("un salarié, deux dirigeants, trois salariés : l'OPCO est calculé une fois pour les quatre salariés", () => {
  const melange = () => {
    let e = etat({ ...SCENARIOS.akto, trainingDays: 20, nombrePersonnes: 1 });
    e = ajouterProfil(e);
    e = changerProjetDuProfil(e, 'profil-2', 'formation_dirigeant');
    e = majProfil(e, 'profil-2', { statutDirigeant: 'artisan', microEntrepreneur: false, ageBeneficiaire: 45 });
    e = definirNombre(e, 'profil-2', 2);
    e = ajouterProfil(e);
    e = majProfil(e, 'profil-3', { contractType: 'cdd', ageBeneficiaire: 52 });
    return definirNombre(e, 'profil-3', 3);
  };

  test('le moteur est appelé pour les quatre salariés ; leur part va aux profils salariés, dans leur ordre, jamais aux dirigeants', () => {
    const e = melange();
    const r = calculer(e, DATE);
    assert.deepEqual([r.groupe.personnes, r.groupe.personnesPdc, r.groupe.blocs.length], [6, 4, 3]);
    const attendu = calculateFunding(getEmbeddedOpcoBySlug('akto')!, e, 4);
    assert.deepEqual(r.funding, attendu);
    assert.equal(attendu.totalFunded, 18400); // 10 000 € de pédagogie (plafond annuel) et 8 400 € de salaires, pour 4 salariés
    const [partDuPremier, partDesTrois] = repartirFinancement(attendu, [1, 3]);
    assert.deepEqual(r.groupe.blocs.map((b) => b.funding), [partDuPremier, null, partDesTrois]);
    assert.deepEqual(r.groupe.blocs.map((b) => b.funding?.personnes ?? null), [1, null, 3]);
    assert.deepEqual(r.groupe.blocs.map((b) => b.funding?.totalFunded ?? null), [4600, null, 13800]);
    // Poste par poste : la somme des parts est le groupe, au centime, et le profil de trois personnes porte trois fois celui d'une.
    const [un, trois] = [r.groupe.blocs[0].funding!, r.groupe.blocs[2].funding!];
    attendu.lines.forEach((l, j) => {
      assert.equal(centimes(un.lines[j].fundedAmount) + centimes(trois.lines[j].fundedAmount), centimes(l.fundedAmount), l.poste);
      assert.ok(Math.abs(centimes(trois.lines[j].fundedAmount) - 3 * centimes(un.lines[j].fundedAmount)) <= 3, l.poste);
    });
  });

  test("le plan de chaque profil porte sa part : la ligne de l'OPCO du groupe est le financé des postes de formation, pour quatre personnes", () => {
    const r = calculer(melange(), DATE);
    const [premier, dirigeants, trois] = r.groupe.blocs;
    const formation = r.funding!.lines.filter((l) => POSTES_DE_FORMATION.includes(l.poste)).reduce((s, l) => s + centimes(l.fundedAmount), 0);
    assert.equal(formation, 1_000_000); // 10 000 € de pédagogie
    assert.deepEqual([ligneOpco(r.plan)?.montant, ligneOpco(r.plan)?.personnes], [10000, 4]);
    assert.deepEqual([premier, trois].map((b) => ligneOpco(b.plan)?.montant), [2500, 7500]);
    assert.deepEqual([premier, trois].map((b) => ligneOpco(b.plan)?.personnes), [undefined, 3]);
    assert.equal(ligneOpco(dirigeants.plan), undefined);
    assert.deepEqual([premier, dirigeants, trois].map((b) => salairesOpco(b.plan)), [2100, undefined, 6300]);
  });

  test('chaque profil est évalué pour une de ses personnes, le profil du groupe est celui du profil principal, le coût suit les effectifs', () => {
    const r = calculer(melange(), DATE);
    assert.deepEqual(
      r.groupe.blocs.map((b) => [b.profil.id, b.profil.nombre, b.profilAides.projet, b.profilAides.age]),
      [
        ['principal', 1, 'formation_salarie', 35],
        ['profil-2', 2, 'formation_dirigeant', 45],
        ['profil-3', 3, 'formation_salarie', 52],
      ],
    );
    assert.equal(r.groupe.blocs[1].profilAides.statutDirigeant, 'artisan');
    assert.equal(r.groupe.blocs[2].profilAides.contrat, 'cdd');
    assert.equal(r.profil, r.groupe.blocs[0].profilAides);
    assert.deepEqual(r.groupe.blocs.map((b) => b.plan.coutFormation), [4200, 8400, 12600]);
    assert.equal(r.plan.coutFormation, 25200);
    // L'aide du fonds des dirigeants n'est « à vérifier » que pour le profil des dirigeants.
    const faf = r.groupe.blocs.map((b) => b.aides.find((a) => a.id === 'faf-fafcea')?.statut);
    assert.deepEqual(faf, ['non_eligible', 'a_verifier', 'non_eligible']);
  });
});

describe("un seul profil salarié : sa part est le résultat entier de l'OPCO", () => {
  test("quatre salariés d'un même profil : le bloc porte le résultat du groupe lui-même", () => {
    const r = calculer(etat({ ...SCENARIOS.akto, nombrePersonnes: 4 }), DATE);
    assert.equal(r.groupe.blocs[0].funding, r.funding);
  });

  test("le profil principal est un dirigeant, deux salariés suivent : le dirigeant n'a pas de part, les salariés ont le résultat entier", () => {
    let e = etat({ ...SCENARIOS.akto, nombrePersonnes: 1 });
    e = changerProjetDuProfil(e, 'principal', 'formation_dirigeant');
    e = majProfil(e, 'principal', { statutDirigeant: 'artisan', microEntrepreneur: false });
    e = ajouterProfil(e);
    e = changerProjetDuProfil(e, 'profil-2', 'formation_salarie');
    e = majProfil(e, 'profil-2', { contractType: 'cdi' });
    e = definirNombre(e, 'profil-2', 2);
    const r = calculer(e, DATE);
    assert.deepEqual([r.groupe.personnes, r.groupe.personnesPdc, r.funding?.personnes], [3, 2, 2]);
    assert.equal(r.groupe.blocs[0].funding, null);
    assert.equal(r.groupe.blocs[1].funding, r.funding);
    assert.equal(r.projet, 'formation_dirigeant'); // l'écran suit le projet du profil principal
  });
});

describe('coût de la formation réparti entre les profils : chaque profil porte le coût de ses personnes', () => {
  test('deux profils de 2 et 3 personnes à 800,20 € par personne : 1 600,40 € et 2 400,60 €', () => {
    let e = etat({ ...SCENARIOS.akto, selectedOpcoSlug: null, nombrePersonnes: 2, ...coutsDeFormation(800.2, 35) });
    e = definirNombre(ajouterProfil(e), 'profil-2', 3);
    const r = calculer(e, DATE);
    assert.deepEqual(r.groupe.blocs.map((b) => b.plan.coutFormation), [1600.4, 2400.6]);
    assert.equal(r.plan.coutFormation, 4001);
  });

  test("deux profils d'une personne pour un prix de 1 000,01 € : 500,01 € et 500 €, jamais 1 000 €", () => {
    const e = etatDepuisPrix(ajouterProfil(etat({ ...SCENARIOS.akto, selectedOpcoSlug: null, nombrePersonnes: 1 })), 1000.01, 140, true);
    const r = calculer(e, DATE);
    assert.deepEqual(r.groupe.blocs.map((b) => b.plan.coutFormation), [500.01, 500]);
    assert.equal(r.plan.coutFormation, 1000.01);
  });

  test('prix du groupe de 512,05 € puis de 512,07 € pour deux profils : le plan coûte exactement ce prix, au centime', () => {
    // 256,025 € par personne multipliés par deux ne font pas 51 205 centimes en virgule flottante (51 204,99999999999) : l'arrondi, ni par défaut ni par excès.
    for (const [prix, attendu] of [[512.05, [256.03, 256.02]], [512.07, [256.04, 256.03]]] as const) {
      const e = etatDepuisPrix(ajouterProfil(etat({ ...SCENARIOS.akto, selectedOpcoSlug: null, nombrePersonnes: 1 })), prix, 140, true);
      const r = calculer(e, DATE);
      assert.deepEqual(r.groupe.blocs.map((b) => b.plan.coutFormation), attendu, String(prix));
      assert.equal(r.plan.coutFormation, prix, String(prix));
    }
  });

  test('coût inconnu : aucun coût de formation pour le groupe, même avec des repas à payer', () => {
    let e = etat({ ...SCENARIOS.akto, selectedOpcoSlug: null, nombrePersonnes: 3, needsMeals: true, mealCostPerDay: 20, ...coutsDeFormation(null, 140) });
    e = definirNombre(ajouterProfil(e), 'profil-2', 2);
    const r = calculer(e, DATE);
    assert.deepEqual(r.groupe.blocs.map((b) => b.plan.coutFormation), [0, 0]);
    assert.equal(r.plan.coutFormation, 0);
    assert.equal(etatEnTete(r.plan), 'cout_inconnu');
  });

  test('frais annexes : ajoutés pour chaque personne au coût réparti', () => {
    // 140 h font 20 jours de repas à 5 € : 100 € par personne, en plus des 900 € de formation.
    let e = etat({ ...SCENARIOS.akto, selectedOpcoSlug: null, nombrePersonnes: 3, needsMeals: true, mealCostPerDay: 5, ...coutsDeFormation(900, 140) });
    e = definirNombre(ajouterProfil(e), 'profil-2', 1);
    const r = calculer(e, DATE);
    assert.deepEqual(r.groupe.blocs.map((b) => b.plan.coutFormation), [3000, 1000]);
    assert.equal(r.plan.coutFormation, 4000);
  });

  test("les aides se jugent sur le coût réel d'une personne : seul le plan du profil porte sa part", () => {
    const e = etatDepuisPrix(ajouterProfil(ajouterProfil(etat({ ...SCENARIOS.akto, selectedOpcoSlug: null, nombrePersonnes: 1 }))), 1000, 140, true);
    const r = calculer(e, DATE);
    assert.equal(e.pedagogyCostTotal, 1000 / 3);
    for (const b of r.groupe.blocs) {
      assert.equal(b.profilAides.coutPedagogique, 1000 / 3);
      assert.deepEqual(b.aides, evaluerAides(EMBEDDED_AIDES, b.profilAides, DATE));
    }
  });
});

describe("situations limites d'un groupe : aucun nombre invalide, aucun montant négatif", () => {
  const etatsLimites: Record<string, WizardState> = {
    'aucun salarié': majProfil(changerProjetDuProfil(ajouterProfil(etat({ ...SCENARIOS.artisan, selectedOpcoSlug: 'akto', nombrePersonnes: 2 })), 'profil-2', 'alternance'), 'profil-2', {
      typeAlternance: 'apprentissage',
      ageBeneficiaire: 19,
    }),
    'sans OPCO': etat({ ...SCENARIOS.akto, selectedOpcoSlug: null, nombrePersonnes: 3 }),
    'coût inconnu': definirNombre(ajouterProfil(etat({ ...SCENARIOS.akto, nombrePersonnes: 3, ...coutsDeFormation(null, 140) })), 'profil-2', 2),
    'plafond épuisé': definirNombre(ajouterProfil(etat({ ...SCENARIOS.akto, nombrePersonnes: 2, budgetDejaConsomme: 10_000_000 })), 'profil-2', 3),
  };

  test('le plan du groupe et celui de chaque profil ne portent que des montants finis, positifs ou nuls', () => {
    for (const [nom, e] of Object.entries(etatsLimites)) {
      const r = calculer(e, DATE);
      verifierMontants(r.plan, nom);
      for (const b of r.groupe.blocs) {
        verifierMontants(b.plan, nom);
        for (const l of b.funding?.lines ?? []) {
          assert.ok(Number.isFinite(l.fundedAmount) && l.fundedAmount >= 0, `${nom} ${l.poste}`);
          assert.ok(Number.isFinite(l.requestedAmount) && l.requestedAmount >= 0, `${nom} ${l.poste}`);
        }
      }
    }
  });

  test("plafond annuel épuisé avec deux profils salariés : aucune ligne de l'OPCO pour la formation, les salaires répartis entre les profils", () => {
    const r = calculer(etatsLimites['plafond épuisé'], DATE);
    assert.deepEqual([r.groupe.personnes, r.groupe.personnesPdc, r.funding?.personnes], [5, 5, 5]);
    assert.ok(r.groupe.blocs.every((b) => ligneOpco(b.plan) === undefined));
    assert.deepEqual(r.groupe.blocs.map((b) => b.funding?.totalFunded), [4200, 6300]); // 10 500 € de salaires pour 5 salariés : 2/5 et 3/5
  });
});

describe("plan d'un groupe : les financements suivent l'ordre d'empilement des aides, pas leur montant", () => {
  test('un dirigeant (fonds des dirigeants, ordre 60, 735 €) et un salarié (CPF, ordre 90, 800 €) : le fonds passe avant le CPF malgré son montant plus faible', () => {
    let e = etat({ ...SCENARIOS.artisan, selectedOpcoSlug: null, eligibleCpf: true, nombrePersonnes: 1 });
    e = changerProjetDuProfil(ajouterProfil(e), 'profil-2', 'formation_salarie');
    e = majProfil(e, 'profil-2', { contractType: 'cdi', ageBeneficiaire: 35, soldeCpf: 800 });
    const r = calculer(e, DATE);
    assert.deepEqual(r.plan.financements.map((l) => [l.id, l.montant]), [['faf-fafcea', 735], ['nat-cpf', 800]]);
    assert.deepEqual(r.groupe.blocs.map((b) => b.plan.financements.map((l) => l.id)), [['faf-fafcea'], ['nat-cpf']]);
  });
});

describe("plan d'un groupe : une aide chiffrée pour un profil et sans montant pour un autre n'est listée qu'une fois", () => {
  test("deux profils de salariés AKTO, solde CPF de 800 € pour l'un, inconnu pour l'autre : le CPF est une ligne chiffrée, jamais aussi une aide sans montant", () => {
    // Profil 1 : deux salariés au solde CPF de 800 € ; profil 2 : un salarié au solde inconnu. 4 200 € de formation par personne.
    let e = etat({ ...SCENARIOS.akto, soldeCpf: 800, nombrePersonnes: 2 });
    e = majProfil(ajouterProfil(e), 'profil-2', { contractType: 'cdi', ageBeneficiaire: 35, soldeCpf: null });
    const r = calculer(e, DATE);
    // À la main : 3 × 4 200 € = 12 600 € ; l'OPCO prend son plafond annuel, 10 000 € ; le CPF du profil 1 prend 2 × 800 € = 1 600 €.
    assert.deepEqual(r.plan.financements.map((l) => [l.id, l.montant, l.personnes]), [['opco-pdc', 10000, 3], ['nat-cpf', 1600, 2]]);
    // Le profil au solde inconnu garde le CPF sans montant dans son propre plan ; le plan du groupe ne le liste plus sans montant.
    assert.deepEqual(r.groupe.blocs[1].plan.nonChiffrees.map((a) => a.id), ['nat-cpf-abondement-employeur', 'nat-cpf']);
    assert.deepEqual(r.plan.nonChiffrees.map((a) => a.id), ['nat-cpf-abondement-employeur']);
    const chiffrees = new Set(r.plan.financements.map((l) => l.id));
    assert.deepEqual(r.plan.nonChiffrees.filter((a) => chiffrees.has(a.id)).map((a) => a.id), []);
    // La carte du CPF reste celle d'une aide chiffrée : 800 € par personne au plus, ses deux profils éligibles.
    const cpf = r.aidesEvaluees.find((a) => a.id === 'nat-cpf');
    assert.equal(cpf?.montantEstime, 800);
    assert.deepEqual(cpf?.profils?.map((p) => [p.profilId, p.nombre, p.statut, p.montantEstime]), [
      ['principal', 2, 'eligible', 800],
      ['profil-2', 1, 'eligible', null],
    ]);
  });
});

describe('600 groupes tirés au hasard (graine 41) : ordre des financements, aides communes aux profils, salariés parmi les personnes', () => {
  test("les financements suivent l'ordre d'empilement des aides ; cet ordre est celui de l'aide, jamais du profil", () => {
    const hasard = generateur(41);
    const ordresDe = (aides: readonly AideEvaluee[]) => aides.map((a) => `${a.id}:${a.ordreEmpilement}`).sort();
    let paires = 0;
    for (let i = 0; i < 600; i++) {
      const e = groupeAleatoire(hasard);
      const r = calculer(e, DATE);
      const contexte = JSON.stringify(e);
      assert.ok(r.groupe.personnesPdc <= r.groupe.personnes, contexte);
      for (const b of r.groupe.blocs) assert.deepEqual(ordresDe(b.aides), ordresDe(r.aidesEvaluees), contexte);
      const ordre = (id: string) =>
        r.aidesEvaluees.find((a) => a.id === id)?.ordreEmpilement ?? (id === 'opco-pdc' ? 10 : id.startsWith('opco-') ? 12 : 85);
      const lignes = r.plan.financements;
      for (let j = 1; j < lignes.length; j++) {
        paires++;
        const [avant, apres] = [lignes[j - 1], lignes[j]];
        assert.ok(ordre(avant.id) <= ordre(apres.id), `${avant.id} ${apres.id} ${contexte}`);
        if (r.groupe.blocs.length > 1 && ordre(avant.id) === ordre(apres.id)) assert.ok(avant.montant >= apres.montant, `${avant.id} ${apres.id} ${contexte}`);
      }
    }
    assert.ok(paires >= 40, String(paires));
  });
});

describe('détails du bandeau, mentions et tableau par profil : cas limites', () => {
  test('detailsDuBandeau : deux personnes, produit exact au centime, moyennes arrondies au centime, coût non fini', () => {
    assert.deepEqual(detailsDuBandeau({ coutFormation: 2000, resteACharge: 800 }, 2), {
      cout: `2${nb}×${nb}${formatEuro(1000)}`,
      reste: `${formatEuro(400)} par personne en moyenne`,
    });
    // Un produit exact reste un produit, même quand la multiplication flottante ne retombe pas juste (2 × 19,99 € = 39,98 €).
    for (const [n, parPersonne] of [[2, 19.99], [3, 410.07], [6, 166.67], [7, 0.29], [12, 1234.57]] as const) {
      const cout = Math.round(parPersonne * n * 100) / 100;
      assert.equal(detailsDuBandeau({ coutFormation: cout, resteACharge: 0 }, n).cout, `${n}${nb}×${nb}${formatEuro(parPersonne)}`, `${n} × ${parPersonne}`);
    }
    // Les moyennes sont arrondies au centime, la demie vers le haut : 1 000,05 € pour 6 personnes font 166,675 €, soit 166,68 €.
    assert.deepEqual(detailsDuBandeau({ coutFormation: 1000.05, resteACharge: 1000.05 }, 6), {
      cout: `${formatEuro(166.68)} par personne en moyenne`,
      reste: `${formatEuro(166.68)} par personne en moyenne`,
    });
    // Moins que la demie, vers le bas : 100,03 € pour 3 personnes font 33,3433 €, soit 33,34 €.
    assert.deepEqual(detailsDuBandeau({ coutFormation: 100.03, resteACharge: 100.03 }, 3), {
      cout: `${formatEuro(33.34)} par personne en moyenne`,
      reste: `${formatEuro(33.34)} par personne en moyenne`,
    });
    assert.deepEqual(detailsDuBandeau({ coutFormation: Number.NaN, resteACharge: 0 }, 3), { cout: null, reste: null });
  });

  test("detailsDuBandeau : une moyenne qui s'arrondit à zéro ne s'écrit pas, ni pour le reste à charge ni pour le coût", () => {
    // 0,01 € de reste à charge pour 3 personnes font 0,0033 € par personne, soit 0 € au centime : rien à écrire, jamais « 0 € par personne en moyenne ».
    assert.deepEqual(detailsDuBandeau({ coutFormation: 300, resteACharge: 0.01 }, 3), { cout: `3${nb}×${nb}${formatEuro(100)}`, reste: null });
    // De même pour un coût de 0,01 € réparti entre 3 personnes.
    assert.deepEqual(detailsDuBandeau({ coutFormation: 0.01, resteACharge: 0.01 }, 3), { cout: null, reste: null });
    // Dès que la moyenne vaut un centime, elle s'écrit : 0,03 € pour 3 personnes font 0,01 € chacune.
    assert.deepEqual(detailsDuBandeau({ coutFormation: 0.03, resteACharge: 0.03 }, 3), {
      cout: `3${nb}×${nb}${formatEuro(0.01)}`,
      reste: `${formatEuro(0.01)} par personne en moyenne`,
    });
  });

  test('pourPersonnes et mentionOpcoDuGroupe : deux personnes', () => {
    assert.equal(pourPersonnes(2), `pour 2${nb}personnes`);
    assert.equal(mentionOpcoDuGroupe(2, 2), `Calcul pour les 2${nb}personnes du groupe.`);
    assert.equal(mentionOpcoDuGroupe(1, 2), `Calcul pour le salarié du groupe (2${nb}personnes au total).`);
    assert.equal(mentionOpcoDuGroupe(1, 1), null);
  });

  test('lignesParProfil : six profils pour 1 000 €, identifiants et rangs, total exactement égal au plan du groupe', () => {
    let e = etat({ ...SCENARIOS.akto, selectedOpcoSlug: null, nombrePersonnes: 1 });
    for (let i = 1; i < 6; i++) e = ajouterProfil(e);
    const r = calculer(etatDepuisPrix(e, 1000, 140, true), DATE);
    const { lignes, total } = lignesParProfil(r.groupe.blocs);
    assert.deepEqual(lignes.map((l) => [l.id, l.rang, l.nombre]), [
      ['principal', 1, 1],
      ['profil-2', 2, 1],
      ['profil-3', 3, 1],
      ['profil-4', 4, 1],
      ['profil-5', 5, 1],
      ['profil-6', 6, 1],
    ]);
    assert.deepEqual(lignes.map((l) => l.cout), [166.67, 166.67, 166.67, 166.67, 166.66, 166.66]);
    assert.deepEqual(total, { nombre: 6, cout: 1000, finance: r.plan.totalFinance, reste: r.plan.resteACharge });
  });

  test('lignesParProfil : les totaux sont des sommes en centimes, même pour des montants que la virgule flottante écrit mal', () => {
    // 128,14 € fait 12 813,999999999998 centimes en virgule flottante, 128,02 € en fait 12 802,000000000002 : ni arrondi par défaut, ni par excès.
    const [p1, p2, p3] = profilsDuGroupe(ajouterProfil(ajouterProfil(etat({ projetType: 'formation_salarie' }))));
    const { total } = lignesParProfil([
      { profil: p1, plan: plan({ coutFormation: 128.14, totalFinance: 128.02, resteACharge: 0.12 }) },
      { profil: p2, plan: plan({ coutFormation: 128.17, totalFinance: 128.05, resteACharge: 0.12 }) },
      { profil: p3, plan: plan({ coutFormation: 128.2, totalFinance: 128.08, resteACharge: 0.12 }) },
    ]);
    assert.deepEqual(total, { nombre: 3, cout: 384.51, finance: 384.15, reste: 0.36 });
  });

  test('concerneParAide : deux personnes au pluriel, avec les libellés des profils du groupe', () => {
    const e = ajouterProfil(etat({ projetType: 'formation_salarie', contractType: 'cdi', ageBeneficiaire: 35, nombrePersonnes: 2 }));
    const libelles = libellesDesProfils(profilsDuGroupe(e));
    assert.deepEqual(
      concerneParAide({ profils: [{ profilId: 'principal', nombre: 2, statut: 'eligible', montantEstime: 500 }] }, libelles),
      [`Profil 1 · Salarié en CDI, 35${nb}ans, 2${nb}personnes${nb}: éligible`],
    );
  });

  test('concerneParAide : un identifiant sans libellé reste lisible', () => {
    // Entrée construite à la main : la table de libellés ne connaît pas ce profil (le groupe n'en produit pas, ses libellés viennent de ses profils).
    const [ligne] = concerneParAide({ profils: [{ profilId: 'sans-libelle', nombre: 1, statut: 'a_verifier', montantEstime: null }] }, new Map());
    assert.ok(ligne.includes('sans-libelle'), ligne);
    assert.ok(!ligne.includes('undefined'), ligne);
  });
});

describe("bloc « Concerne » d'une carte d'aide (concerneAAfficher)", () => {
  const libelles = new Map([
    ['principal', 'Profil 1 · Salarié en CDI'],
    ['profil-2', 'Profil 2 · Dirigeant artisan'],
  ]);
  const vue = (profilId: string, nombre: number, statut: 'eligible' | 'a_verifier') => ({ profilId, nombre, statut, montantEstime: null });

  test('rien sans champ profils (un seul profil), ni quand tous les profils sont concernés au même statut', () => {
    assert.deepEqual(concerneAAfficher({ statut: 'eligible' }, 1, libelles), []);
    assert.deepEqual(
      concerneAAfficher({ statut: 'eligible', profils: [vue('principal', 3, 'eligible'), vue('profil-2', 1, 'eligible')] }, 2, libelles),
      [],
    );
  });

  test("un profil au moins n'est pas concerné : le bloc nomme les profils concernés", () => {
    assert.deepEqual(concerneAAfficher({ statut: 'eligible', profils: [vue('profil-2', 1, 'eligible')] }, 2, libelles), [
      `Profil 2 · Dirigeant artisan, 1${nb}personne${nb}: éligible`,
    ]);
  });

  test('tous les profils sont concernés mais pas au même statut : le bloc dit le statut de chacun', () => {
    assert.deepEqual(
      concerneAAfficher({ statut: 'eligible', profils: [vue('principal', 3, 'eligible'), vue('profil-2', 1, 'a_verifier')] }, 2, libelles),
      [`Profil 1 · Salarié en CDI, 3${nb}personnes${nb}: éligible`, `Profil 2 · Dirigeant artisan, 1${nb}personne${nb}: à vérifier`],
    );
  });

  // Les trois tests suivants s'ajoutent à ceux de la fiche : sans eux, des mutants survivaient (toutes les cartes de la fiche
  // sont « éligible », et aucune n'a plus de profils concernés que le groupe n'en compte).
  test("le statut comparé est celui de la carte : une aide « à vérifier » pour tous les profils n'a rien à préciser", () => {
    assert.deepEqual(
      concerneAAfficher({ statut: 'a_verifier', profils: [vue('principal', 3, 'a_verifier'), vue('profil-2', 1, 'a_verifier')] }, 2, libelles),
      [],
    );
    // Une carte « éligible » dont aucun profil n'est éligible (le moteur ne produit pas ce cas) : le bloc dit le statut de chacun.
    assert.deepEqual(
      concerneAAfficher({ statut: 'eligible', profils: [vue('principal', 3, 'a_verifier'), vue('profil-2', 1, 'a_verifier')] }, 2, libelles),
      [`Profil 1 · Salarié en CDI, 3${nb}personnes${nb}: à vérifier`, `Profil 2 · Dirigeant artisan, 1${nb}personne${nb}: à vérifier`],
    );
  });

  test("plus de profils concernés que le groupe n'en compte (donnée incohérente) : le bloc parle plutôt que de se taire", () => {
    assert.deepEqual(
      concerneAAfficher({ statut: 'eligible', profils: [vue('principal', 3, 'eligible'), vue('profil-2', 1, 'eligible')] }, 1, libelles),
      [`Profil 1 · Salarié en CDI, 3${nb}personnes${nb}: éligible`, `Profil 2 · Dirigeant artisan, 1${nb}personne${nb}: éligible`],
    );
  });

  test('données du moteur : le fonds du dirigeant (FAFCEA) nomme son profil ; une personne seule, un seul profil ou des profils identiques : aucun bloc', () => {
    // Trois salariés et un dirigeant artisan (le groupe de l'étape « groupe mixte »).
    let mixte = etat({
      ...SCENARIOS.artisan,
      selectedOpcoSlug: 'akto',
      projetType: 'formation_salarie',
      contractType: 'cdi',
      statutDirigeant: null,
      microEntrepreneur: null,
      ageBeneficiaire: 35,
      nombrePersonnes: 3,
    });
    mixte = ajouterProfil(mixte);
    mixte = changerProjetDuProfil(mixte, 'profil-2', 'formation_dirigeant');
    mixte = majProfil(mixte, 'profil-2', { statutDirigeant: 'artisan', microEntrepreneur: false, ageBeneficiaire: 45 });
    const r = calculer(mixte, DATE);
    const libellesMixte = libellesDesProfils(r.groupe.blocs.map((b) => b.profil));
    const faf = r.aidesEvaluees.find((a) => a.id === 'faf-fafcea');
    assert.ok(faf);
    assert.deepEqual(concerneAAfficher(faf, libellesMixte.size, libellesMixte), [
      `Profil 2 · Dirigeant artisan, 45${nb}ans, 1${nb}personne${nb}: éligible`,
    ]);

    // Les aides d'un seul profil (une personne, ou plusieurs de même profil) n'ont pas de champ `profils` ; deux profils de même
    // situation concernent les mêmes cartes au même statut : dans les trois cas, aucune carte ne porte de bloc.
    const identiques = ajouterProfil(etat({ ...SCENARIOS.akto, nombrePersonnes: 2 }));
    const sansBloc: Record<string, WizardState> = {
      'une personne': etat({ ...SCENARIOS.akto, nombrePersonnes: 1 }),
      'quatre personnes, un profil': etat({ ...SCENARIOS.akto, nombrePersonnes: 4 }),
      'deux profils identiques': majProfil(identiques, 'profil-2', { contractType: 'cdi', ageBeneficiaire: 35 }),
    };
    for (const [nom, e] of Object.entries(sansBloc)) {
      const calcul = calculer(e, DATE);
      const libellesDuGroupe = libellesDesProfils(calcul.groupe.blocs.map((b) => b.profil));
      const visibles = calcul.aidesEvaluees.filter((a) => a.statut !== 'non_eligible');
      assert.ok(visibles.length > 0, nom);
      const avecBloc = visibles.filter((a) => concerneAAfficher(a, libellesDuGroupe.size, libellesDuGroupe).length > 0);
      assert.deepEqual(avecBloc.map((a) => a.id), [], nom);
    }
  });
});

describe("détail par profil selon l'état du groupe (colonnesParProfil et chiffre des lignes)", () => {
  // Une ligne de financement minimale : etatEnTete ne regarde que le coût, le nombre de lignes et le total financé.
  const ligne = (montant: number) => ({ id: 'opco-pdc', nom: 'Plan de développement des compétences', financeurNom: 'AKTO', montant, confidence: 'exact' as const });
  const [p1, p2] = profilsDuGroupe(ajouterProfil(etat({ projetType: 'formation_salarie' })));
  /** Le `chiffre` des deux lignes d'un groupe de deux profils dont les plans sont donnés (dans cet ordre). */
  const chiffres = (premier: PlanFinancement, second: PlanFinancement) =>
    lignesParProfil([{ profil: p1, plan: premier }, { profil: p2, plan: second }]).lignes.map((l) => l.chiffre);

  test("colonnesParProfil : aucune sans coût, le coût seul sans financement chiffré, toutes quand le plan l'est", () => {
    assert.equal(colonnesParProfil('cout_inconnu'), 'aucune');
    assert.equal(colonnesParProfil('aucun_financement_chiffre'), 'cout');
    assert.equal(colonnesParProfil('plan_chiffre'), 'toutes');
  });

  test("chiffre : le plan du profil est chiffré quand etatEnTete le dit, quelle que soit la place du profil dans le groupe", () => {
    const chiffre = plan({ coutFormation: 1000, financements: [ligne(600)], totalFinance: 600, resteACharge: 400 });
    const pasChiffres: Record<string, PlanFinancement> = {
      'coût inconnu': plan({ financements: [ligne(600)], totalFinance: 600 }),
      'aucune ligne de financement': plan({ coutFormation: 1000, resteACharge: 1000 }),
      'lignes sans montant': plan({ coutFormation: 1000, financements: [ligne(0)], resteACharge: 1000 }),
      'financé sans ligne (donnée incohérente)': plan({ coutFormation: 1000, totalFinance: 300, resteACharge: 700 }),
      'ligne sans financé (donnée incohérente)': plan({ coutFormation: 1000, financements: [ligne(600)], resteACharge: 1000 }),
    };
    assert.deepEqual(chiffres(chiffre, chiffre), [true, true]);
    for (const [nom, pasChiffre] of Object.entries(pasChiffres)) {
      assert.deepEqual(chiffres(chiffre, pasChiffre), [true, false], nom);
      assert.deepEqual(chiffres(pasChiffre, chiffre), [false, true], nom);
      assert.deepEqual(chiffres(pasChiffre, pasChiffre), [false, false], nom);
    }
  });

  test("trois salariés AKTO et un apprenti : le plan du groupe est chiffré, la ligne de l'apprenti ne l'est pas, le total est celui du bandeau", () => {
    let e = etat({ ...SCENARIOS.akto, nombrePersonnes: 3 });
    e = changerProjetDuProfil(ajouterProfil(e), 'profil-2', 'alternance');
    e = majProfil(e, 'profil-2', { typeAlternance: 'apprentissage', ageBeneficiaire: 19 });
    const r = calculer(e, DATE);
    assert.deepEqual([r.plan.coutFormation, r.plan.totalFinance, r.plan.resteACharge], [16800, 10000, 6800]);
    assert.equal(etatEnTete(r.plan), 'plan_chiffre');
    assert.equal(colonnesParProfil(etatEnTete(r.plan)), 'toutes');
    const { lignes, total } = lignesParProfil(r.groupe.blocs);
    assert.deepEqual(lignes.map((l) => [l.id, l.nombre, l.cout, l.finance, l.reste, l.chiffre]), [
      ['principal', 3, 12600, 10000, 2600, true],
      ['profil-2', 1, 4200, 0, 4200, false],
    ]);
    assert.deepEqual(total, { nombre: 4, cout: 16800, finance: 10000, reste: 6800 });
  });

  test("un dirigeant artisan et un dirigeant assimilé salarié, dans les deux ordres : seule la ligne de l'artisan est chiffrée", () => {
    const sansFonds = { statutDirigeant: 'assimile_salarie' as const, ageBeneficiaire: 50 };
    const avecFonds = { statutDirigeant: 'artisan' as const, ageBeneficiaire: 45, microEntrepreneur: false };
    // L'artisan d'abord, puis l'assimilé salarié.
    const artisanPuisAssimile = majProfil(ajouterProfil(etat({ ...SCENARIOS.artisan, nombrePersonnes: 1 })), 'profil-2', sansFonds);
    // L'assimilé salarié d'abord (profil principal), puis l'artisan.
    const assimilePuisArtisan = majProfil(ajouterProfil(etat({ ...SCENARIOS.artisan, ...sansFonds, nombrePersonnes: 1 })), 'profil-2', avecFonds);
    const attendu = { nombre: 2, cout: 1800, finance: 735, reste: 1065 };
    for (const [e, ordre] of [[artisanPuisAssimile, [true, false]], [assimilePuisArtisan, [false, true]]] as const) {
      const r = calculer(e, DATE);
      assert.equal(etatEnTete(r.plan), 'plan_chiffre');
      const { lignes, total } = lignesParProfil(r.groupe.blocs);
      assert.deepEqual(lignes.map((l) => l.chiffre), ordre);
      assert.deepEqual(lignes.map((l) => [l.cout, l.finance, l.reste]).sort(), [[900, 0, 900], [900, 735, 165]]);
      assert.deepEqual(total, attendu);
    }
  });

  test("deux dirigeants artisans sans financement chiffré (Qualiopi inconnu) : le groupe est « aucun financement chiffré », aucune ligne n'est chiffrée", () => {
    let e = etat({ ...SCENARIOS.artisan, organismeQualiopi: null, ...coutsDeFormation(3000, 21), nombrePersonnes: 1 });
    e = majProfil(ajouterProfil(e), 'profil-2', { statutDirigeant: 'artisan', ageBeneficiaire: 45, microEntrepreneur: false });
    const r = calculer(e, DATE);
    assert.deepEqual([r.plan.coutFormation, r.plan.totalFinance, r.plan.resteACharge], [6000, 0, 6000]);
    assert.equal(etatEnTete(r.plan), 'aucun_financement_chiffre');
    assert.equal(colonnesParProfil(etatEnTete(r.plan)), 'cout');
    const { lignes, total } = lignesParProfil(r.groupe.blocs);
    assert.deepEqual(lignes.map((l) => [l.cout, l.chiffre]), [[3000, false], [3000, false]]);
    assert.deepEqual(total, { nombre: 2, cout: 6000, finance: 0, reste: 6000 });
  });

  test("coût inconnu : le groupe est « coût inconnu » (aucune colonne) et aucune ligne n'est chiffrée", () => {
    const r = calculer(ajouterProfil(etat({ ...SCENARIOS.akto, pedagogyCostTotal: null, pedagogyCostPerHour: null, nombrePersonnes: 2 })), DATE);
    assert.equal(etatEnTete(r.plan), 'cout_inconnu');
    assert.equal(colonnesParProfil(etatEnTete(r.plan)), 'aucune');
    assert.deepEqual(lignesParProfil(r.groupe.blocs).lignes.map((l) => l.chiffre), [false, false]);
  });

  test("sur des groupes tirés au hasard : le groupe est chiffré si et seulement si une ligne l'est, et le total égale le plan du groupe", () => {
    const hasard = generateur(15);
    const etats: Record<string, number> = {};
    let mixtes = 0;
    for (let i = 0; i < 150; i++) {
      const r = calculer(groupeVaste(hasard), DATE);
      const etatDuGroupe = etatEnTete(r.plan);
      etats[etatDuGroupe] = (etats[etatDuGroupe] ?? 0) + 1;
      const { lignes, total } = lignesParProfil(r.groupe.blocs);
      assert.equal(lignes.some((l) => l.chiffre), etatDuGroupe === 'plan_chiffre', `groupe ${i}`);
      assert.deepEqual(total, { nombre: r.groupe.personnes, cout: r.plan.coutFormation, finance: r.plan.totalFinance, reste: r.plan.resteACharge }, `groupe ${i}`);
      if (etatDuGroupe === 'plan_chiffre' && lignes.some((l) => !l.chiffre)) mixtes++;
    }
    // L'échantillon exerce les deux états avec des lignes, dont des groupes chiffrés qui comptent une ligne non chiffrée.
    assert.ok((etats.plan_chiffre ?? 0) > 0 && (etats.aucun_financement_chiffre ?? 0) > 0, JSON.stringify(etats));
    assert.ok(mixtes > 0, `groupes chiffrés avec une ligne non chiffrée : ${mixtes}`);
  });
});
