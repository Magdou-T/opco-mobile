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
import { encadreSansFinancement, planFermeDe } from '../src/lib/encadres-resultats';

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

  test("sans plafond annuel atteint, le financement de l'OPCO vaut 4 fois celui d'une personne ; sinon il ne le dépasse pas", () => {
    const pdc = (r: ReturnType<typeof calculer>) => r.plan.financements.find((l) => l.id === 'opco-pdc')!.montant;
    if (quatre().funding?.budgetCapApplied) assert.ok(pdc(quatre()) <= 4 * pdc(une()) + 0.01);
    else assert.equal(pdc(quatre()), 4 * pdc(une()));
  });

  test("une aide du catalogue : son montant par personne est celui d'une personne, le plan le multiplie", () => {
    const r = quatre();
    const cpf = r.aidesEvaluees.find((a) => a.id === 'nat-cpf');
    const seul = une().aidesEvaluees.find((a) => a.id === 'nat-cpf');
    assert.equal(cpf?.montantEstime, seul?.montantEstime);
    assert.equal(cpf?.profils, undefined); // un seul profil : aucun champ « profils »
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

describe('1 000 groupes tirés au hasard (graine 17) : cohérence du plan, des parts et des textes', () => {
  test("les profils s'additionnent en centimes, aucun plan ne dépasse son coût, rien n'est invalide", () => {
    const hasard = generateur(17);
    let avecPlusieursProfils = 0;
    let avecPlusieursSalaries = 0;
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
    const hasard = generateur(29);
    let controles = 0;
    for (let i = 0; i < 600; i++) {
      const { plan: p, aidesEvaluees, funding, portail } = calculer(groupeAleatoire(hasard), DATE);
      if (etatEnTete(p) !== 'aucun_financement_chiffre') continue;
      controles++;
      const { texte, rappels, aidesAVerifier } = encadreSansFinancement(p, aidesEvaluees, portail != null, planFermeDe(funding));
      const listees = groupesAidesVisibles(aidesEvaluees).flatMap((g) => g.aides);
      const aVerifier = listees.filter((a) => a.statut === 'a_verifier');
      if (texte.includes('aucune autre aide à montant')) assert.ok(!listees.some((a) => (a.montantEstime ?? 0) > 0), texte);
      if (texte.includes('Voici les aides identifiées')) assert.ok(rappels.length > 0, texte);
      if (texte.includes('à vérifier')) assert.ok(aVerifier.length > 0, texte);
      if (aidesAVerifier) assert.equal(aidesAVerifier.nombre, aVerifier.length, texte);
      if (texte.includes('après étude du dossier')) assert.ok(p.nonChiffrees.length > 0 || p.options.some((o) => o.montantEstime == null), texte);
    }
    assert.ok(controles >= 100, String(controles));
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

// --- Garanties ajoutées par la preuve par mutation ----------------------------------------------------------------------
// Chaque test ci-dessous tue au moins un mutant de lib/resultats.ts que les tests précédents laissaient vivre.

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

  test('concerneParAide : un profil inconnu garde son identifiant, deux personnes au pluriel', () => {
    const libelles = new Map([['principal', 'Profil 1 · Salarié']]);
    assert.deepEqual(
      concerneParAide(
        {
          profils: [
            { profilId: 'principal', nombre: 2, statut: 'eligible', montantEstime: 500 },
            { profilId: 'profil-9', nombre: 1, statut: 'a_verifier', montantEstime: null },
          ],
        },
        libelles,
      ),
      [`Profil 1 · Salarié, 2${nb}personnes${nb}: éligible`, `profil-9, 1${nb}personne${nb}: à vérifier`],
    );
  });
});
