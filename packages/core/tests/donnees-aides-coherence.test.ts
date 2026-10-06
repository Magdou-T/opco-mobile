// ============================================================
// Catalogue d'aides embarqué × plan de financement : les aides réelles (EMBEDDED_AIDES) sont évaluées puis empilées
// par le moteur, comme le fait l'application, pour que les défauts de données qui faussent les chiffres affichés ne
// passent plus inaperçus (aides propres à la VAE « éligibles » pour toute formation, alternatives incomplètes, solde
// CPF compté plusieurs fois). Contrôles :
//   1. alternatives : chaque groupe d'alternatives est complet (toute paire est déclarée), sauf deux paires justifiées ;
//   2. solde CPF : les lignes du plan prélevées sur le solde CPF ne dépassent jamais le solde ;
//   3. POE : une seule des trois entrées de la préparation opérationnelle à l'emploi est retenue ;
//   4. VAE : une aide propre à la VAE n'est ni éligible ni à vérifier pour une autre formation, et jamais comptée dans le
//      plan quand le type de formation n'est pas la VAE ;
//   5. invariants du plan sur une grille de profils (et sur une grille élargie à l'alternance et aux demandeurs d'emploi).
// ============================================================

import { beforeAll, describe, it, expect } from 'vitest';
import { evaluerAide, evaluerAides } from '../src/aides/evaluer';
import { construirePlan, type PlanFinancement } from '../src/aides/plan';
import { profilDepuisWizard } from '../src/aides/profil';
import type { Aide, AideEvaluee, ProfilAides } from '../src/aides/types';
import { calculateFunding } from '../src/calculator';
import { EMBEDDED_AIDES, getEmbeddedOpcoBySlug } from '../src/data';
import { createInitialWizardState, TRAINING_TYPE_LABELS, type ProjetType, type TrainingType, type WizardState } from '../src/types';
import { makeAide } from './fixtures-aides';

/** Date de référence de l'évaluation (fixe : le résultat ne dépend pas du jour où les tests s'exécutent). */
const DATE = '2026-10-06';

const aideParId = new Map<string, Aide>(EMBEDDED_AIDES.map((a) => [a.id, a]));

function aide(id: string): Aide {
  const trouvee = aideParId.get(id);
  if (!trouvee) throw new Error(`Aide absente du catalogue embarqué : ${id}`);
  return trouvee;
}

const centimes = (n: number): number => Math.round(n * 100);
const TYPES_FORMATION = Object.keys(TRAINING_TYPE_LABELS) as TrainingType[];
const AUTRES_TYPES_QUE_VAE = TYPES_FORMATION.filter((t) => t !== 'vae');

/** Au plus dix lignes de détail : un défaut général sur toute la grille noierait (ou ferait planter) le message d'échec. */
const apercu = (lignes: string[]): string[] =>
  lignes.length > 10 ? [...lignes.slice(0, 10), `… et ${lignes.length - 10} autres`] : lignes;

/** Identifiants de tout ce que le plan présente, toutes listes confondues (aides du catalogue et lignes OPCO). */
function idsDuPlan(plan: PlanFinancement): string[] {
  return [
    ...plan.financements.map((l) => l.id),
    ...plan.options.map((o) => o.id),
    ...plan.aidesEmployeur.map((l) => l.id),
    ...plan.remunerations.map((l) => l.id),
    ...plan.avantagesFiscauxSociaux.map((l) => l.id),
    ...plan.nonChiffrees.map((a) => a.id),
    ...plan.servicesGratuits.map((a) => a.id),
  ];
}

// --- Scénarios : parcours → profil → évaluation → plan, comme dans l'application ----------------------------------

/** Frais annexes demandés par le parcours : 2 nuits à 80 € et 3 jours de repas à 15 € = 205 €. */
const FRAIS_ANNEXES: Partial<WizardState> = {
  needsAccommodation: true,
  accommodationNights: 2,
  accommodationCostPerNight: 80,
  needsMeals: true,
  mealCostPerDay: 15,
  trainingDays: 3,
};
const MONTANT_FRAIS_ANNEXES = 205;

interface Scenario {
  projet: ProjetType;
  soldeCpf: number;
  /** Coût pédagogique total de la formation, en euros. */
  cout: number;
  /** Frais annexes demandés (205 €) en plus du coût pédagogique. */
  annexes: boolean;
  dureeHeures: number;
  certification: 'rncp' | 'aucune';
  typeFormation: TrainingType | null;
  opco: 'akto' | null;
  /** Particularités du parcours (région, contrat d'alternance, inscription à France Travail…) : elles écrasent le parcours de base. */
  parcours?: Partial<WizardState>;
}

/** Coût de la formation attendu dans le plan : coût pédagogique et frais annexes demandés. */
const coutAttendu = (s: Scenario): number => s.cout + (s.annexes ? MONTANT_FRAIS_ANNEXES : 0);

/** Parcours d'une TPE d'Île-de-France (IDCC 1516, CDI) : le scénario de référence de la spécification, décliné par `Scenario`. */
function etatDuScenario(s: Scenario): WizardState {
  return {
    ...createInitialWizardState(),
    projetType: s.projet,
    opcoKnown: s.opco != null,
    selectedOpcoSlug: s.opco,
    regionCode: '11',
    departementCode: '95',
    codeNaf: '85.59A',
    companySize: 'less_11',
    idccEtablissements: ['1516'],
    contractType: 'cdi',
    anciennete_mois: 24,
    ageBeneficiaire: 35,
    niveauDiplome: 'bac',
    statutDirigeant: s.projet === 'formation_dirigeant' ? 'artisan' : null,
    soldeCpf: s.soldeCpf,
    formationType: s.typeFormation,
    certificationLevel: s.certification,
    niveauFormationVise: s.certification === 'rncp' ? 5 : null,
    eligibleCpf: true,
    organismeQualiopi: true,
    durationHours: s.dureeHeures,
    pedagogyCostTotal: s.cout,
    pedagogyCostPerHour: s.cout / s.dureeHeures,
    trainingMode: 'presentiel',
    ...(s.annexes ? FRAIS_ANNEXES : {}),
    ...s.parcours,
  };
}

interface Resultat {
  scenario: Scenario;
  profil: ProfilAides;
  aides: AideEvaluee[];
  plan: PlanFinancement;
}

function jouer(scenario: Scenario, catalogue: Aide[] = EMBEDDED_AIDES): Resultat {
  const etat = etatDuScenario(scenario);
  const profil = profilDepuisWizard(etat, scenario.opco);
  const opco = scenario.opco == null ? undefined : getEmbeddedOpcoBySlug(scenario.opco);
  if (scenario.opco != null && !opco) throw new Error(`OPCO absent des données embarquées : ${scenario.opco}`);
  const aides = evaluerAides(catalogue, profil, DATE);
  return { scenario, profil, aides, plan: construirePlan(opco ? calculateFunding(opco, etat) : null, aides, profil) };
}

/**
 * Grille de profils : trois projets (salarié, reconversion, dirigeant) × solde CPF (300, 800, 5 000 €) × coût (1 000,
 * 4 200 avec ou sans frais annexes, 9 000 €) × durée (24 h : un bilan de compétences est possible ; 140 h) ×
 * certification (RNCP ou aucune) × type de formation (les sept types et un type inconnu) × OPCO (AKTO ou aucun).
 */
function grille(): Scenario[] {
  const scenarios: Scenario[] = [];
  const projets: Scenario['projet'][] = ['formation_salarie', 'reconversion_salarie', 'formation_dirigeant'];
  const couts: Pick<Scenario, 'cout' | 'annexes'>[] = [
    { cout: 1000, annexes: false },
    { cout: 4200, annexes: false },
    { cout: 4200, annexes: true },
    { cout: 9000, annexes: false },
  ];
  const certifications: Scenario['certification'][] = ['rncp', 'aucune'];
  const typesFormation: (TrainingType | null)[] = [...TYPES_FORMATION, null];
  const opcos: Scenario['opco'][] = ['akto', null];
  for (const projet of projets) {
    for (const soldeCpf of [300, 800, 5000]) {
      for (const { cout, annexes } of couts) {
        for (const dureeHeures of [24, 140]) {
          for (const certification of certifications) {
            for (const typeFormation of typesFormation) {
              for (const opco of opcos) {
                scenarios.push({ projet, soldeCpf, cout, annexes, dureeHeures, certification, typeFormation, opco });
              }
            }
          }
        }
      }
    }
  }
  return scenarios;
}

const TAILLE_DE_LA_GRILLE = 3 * 3 * 4 * 2 * 2 * 8 * 2;

/**
 * Grille élargie aux deux projets que la grille principale ne couvre pas, pour exercer les aides à l'employeur et les
 * aides à la personne chiffrées : alternance (apprentissage ou professionnalisation, 19 ans) et recrutement d'un
 * demandeur d'emploi inscrit à France Travail (RQTH ou non), dans quatre régions (Île-de-France, Hauts-de-France,
 * Nouvelle-Aquitaine, Auvergne-Rhône-Alpes).
 */
function grilleElargie(): Scenario[] {
  const scenarios: Scenario[] = [];
  const commun = { soldeCpf: 800, dureeHeures: 140, certification: 'rncp' as const, annexes: false };
  for (const regionCode of ['11', '32', '75', '84'] as const) {
    for (const cout of [1000, 9000]) {
      for (const typeFormation of [null, 'qualification'] as const) {
        for (const opco of ['akto', null] as const) {
          const base = { ...commun, cout, typeFormation, opco };
          for (const typeAlternance of ['apprentissage', 'professionnalisation'] as const) {
            scenarios.push({
              ...base,
              projet: 'alternance',
              parcours: { regionCode, departementCode: null, typeAlternance, ageBeneficiaire: 19 },
            });
          }
          for (const isHandicap of [false, true]) {
            scenarios.push({
              ...base,
              projet: 'recrutement_demandeur_emploi',
              parcours: { regionCode, departementCode: null, inscritFranceTravail: true, isHandicap, ageBeneficiaire: 30 },
            });
          }
        }
      }
    }
  }
  return scenarios;
}

const TAILLE_DE_LA_GRILLE_ELARGIE = 4 * 2 * 2 * 2 * (2 + 2);

let grilleMemo: Resultat[] | null = null;
let elargieMemo: Resultat[] | null = null;
let sansAlternativesMemo: Resultat[] | null = null;

/** Résultats de la grille principale (calculés une seule fois pour tout le fichier). */
function resultatsGrille(): Resultat[] {
  grilleMemo ??= grille().map((s) => jouer(s));
  return grilleMemo;
}

/** Résultats de la grille élargie à l'alternance et aux demandeurs d'emploi. */
function resultatsElargis(): Resultat[] {
  elargieMemo ??= grilleElargie().map((s) => jouer(s));
  return elargieMemo;
}

/**
 * Catalogue réel dont toutes les alternatives (et notes de cumul) sont retirées, sur les profils de reconversion RNCP de la
 * grille : pour le type « vae » et 24 h, les quatre aides prélevées sur le solde CPF sont éligibles ensemble. Seul le plan
 * (solde partagé, plafond au reste à charge) les empêche alors de s'additionner.
 */
function resultatsSansAlternatives(): Resultat[] {
  const sansAlternatives = EMBEDDED_AIDES.map((a) => ({ ...a, cumul: { cumulable: a.cumul.cumulable } }));
  sansAlternativesMemo ??= grille()
    .filter((s) => s.projet === 'reconversion_salarie' && s.certification === 'rncp')
    .map((s) => jouer(s, sansAlternatives));
  return sansAlternativesMemo;
}

// Le calcul des grilles (quelques milliers de plans) prend plusieurs secondes : il est fait une fois, avant les tests, avec
// un délai large (le délai par défaut d'un test est de 5 s).
beforeAll(() => {
  resultatsGrille();
  resultatsElargis();
  resultatsSansAlternatives();
}, 60_000);

const decrire = (s: Scenario): string =>
  `${s.projet}${s.parcours?.regionCode ? ` en région ${s.parcours.regionCode}` : ''}${s.parcours?.typeAlternance ? ` (${s.parcours.typeAlternance})` : ''}${s.parcours?.isHandicap ? ' RQTH' : ''}, solde CPF ${s.soldeCpf} €, coût ${s.cout} €${s.annexes ? ` + ${MONTANT_FRAIS_ANNEXES} € de frais annexes` : ''}, ${s.dureeHeures} h, certification ${s.certification}, type ${s.typeFormation ?? 'inconnu'}, OPCO ${s.opco ?? 'aucun'}`;

// --- 1. Alternatives complètes ------------------------------------------------------------------------------------

/**
 * Paires d'aides d'un même groupe d'alternatives (composante connexe du graphe `cumul.alternatives`, une déclaration
 * valant dans les deux sens) qu'aucune déclaration ne relie directement, écrites « a ↔ b » (identifiants triés).
 * Un groupe complet (une clique) n'en a aucune : le plan ne peut alors pas retenir deux aides qui s'excluent.
 */
function pairesNonDeclarees(aides: Aide[]): string[] {
  const voisins = new Map<string, Set<string>>();
  const relier = (x: string, y: string) => {
    const set = voisins.get(x) ?? new Set<string>();
    set.add(y);
    voisins.set(x, set);
  };
  for (const a of aides) {
    for (const autre of a.cumul.alternatives ?? []) {
      relier(a.id, autre);
      relier(autre, a.id);
    }
  }
  const vus = new Set<string>();
  const manquantes: string[] = [];
  for (const depart of voisins.keys()) {
    if (vus.has(depart)) continue;
    const groupe: string[] = [];
    const pile = [depart];
    vus.add(depart);
    while (pile.length > 0) {
      const courant = pile.pop() as string;
      groupe.push(courant);
      for (const suivant of voisins.get(courant) ?? []) {
        if (!vus.has(suivant)) {
          vus.add(suivant);
          pile.push(suivant);
        }
      }
    }
    groupe.sort();
    for (let i = 0; i < groupe.length; i++) {
      for (let j = i + 1; j < groupe.length; j++) {
        if (!voisins.get(groupe[i])?.has(groupe[j])) manquantes.push(`${groupe[i]} ↔ ${groupe[j]}`);
      }
    }
  }
  return manquantes.sort();
}

/**
 * Paires volontairement non déclarées, avec la source de la justification (la note de l'aide) : elles font partie d'un
 * groupe d'alternatives sans être alternatives l'une de l'autre.
 */
const PAIRES_VOLONTAIREMENT_NON_DECLAREES: Record<string, string> = {
  'nat-ptp ↔ nat-ptp-remuneration':
    "même dispositif (le PTP finance la formation, nat-ptp-remuneration le maintien de la rémunération) et cumulables : la note de nat-ptp dit « Se cumule avec nat-ptp-remuneration (même dispositif) », celle de nat-ptp-remuneration « cumulable avec nat-ptp »",
  'r84-formations-individuelles ↔ r84-pacte-region-emploi':
    "aucune des deux n'est déclarée incompatible avec l'autre (leurs notes ne se citent pas) ; r84-pacte-region-emploi-apres-embauche, non cumulable avec l'une comme avec l'autre, les relie dans le même groupe",
};

describe('alternatives : chaque groupe est complet', () => {
  it("toute paire d'aides d'un même groupe d'alternatives est déclarée, sauf les deux paires justifiées", () => {
    expect(pairesNonDeclarees(EMBEDDED_AIDES)).toEqual(Object.keys(PAIRES_VOLONTAIREMENT_NON_DECLAREES).sort());
  });

  it('le groupe de la POE (POEI nationale, POEC, POEI de la Région Pays de la Loire) est complet', () => {
    const poe = ['nat-poei', 'nat-poec', 'r52-poei-region'];
    for (const id of poe) {
      expect(aide(id).cumul.alternatives ?? []).toEqual(expect.arrayContaining(poe.filter((autre) => autre !== id)));
    }
  });

  it('les quatre aides prélevées sur le même solde CPF sont deux à deux alternatives', () => {
    const soldeCpf = EMBEDDED_AIDES.filter((a) => a.montant.mode === 'solde_cpf').map((a) => a.id).sort();
    expect(soldeCpf).toEqual(['nat-bilan-competences', 'nat-clea', 'nat-cpf', 'nat-vae']);
    const declarations = (id: string) => aide(id).cumul.alternatives ?? [];
    for (const a of soldeCpf) {
      for (const b of soldeCpf.filter((autre) => autre !== a)) {
        expect(declarations(a).includes(b) || declarations(b).includes(a)).toBe(true);
      }
    }
  });

  it('les deux exceptions sont justifiées par la note des aides', () => {
    expect(Object.keys(PAIRES_VOLONTAIREMENT_NON_DECLAREES).sort()).toEqual([
      'nat-ptp ↔ nat-ptp-remuneration',
      'r84-formations-individuelles ↔ r84-pacte-region-emploi',
    ]);
    // PTP : même dispositif, cumulables.
    expect(aide('nat-ptp').cumul.note).toContain('Se cumule avec nat-ptp-remuneration (même dispositif)');
    expect(aide('nat-ptp-remuneration').cumul.note).toContain('cumulable avec nat-ptp');
    expect(aide('nat-ptp').cumul.cumulable).toBe(true);
    expect(aide('nat-ptp-remuneration').cumul.cumulable).toBe(true);
    // Pacte Région : aucune des deux ne cite l'autre ; l'aide « après embauche » les relie toutes deux.
    expect(aide('r84-pacte-region-emploi').cumul.alternatives).toEqual(['r84-pacte-region-emploi-apres-embauche']);
    expect(aide('r84-pacte-region-emploi').cumul.note ?? '').not.toContain('r84-formations-individuelles');
    expect(aide('r84-formations-individuelles').cumul.alternatives ?? []).toEqual([]);
    expect(aide('r84-formations-individuelles').cumul.note ?? '').not.toContain('r84-pacte-region-emploi');
    expect(aide('r84-pacte-region-emploi-apres-embauche').cumul.alternatives).toEqual(
      expect.arrayContaining(['r84-pacte-region-emploi', 'r84-formations-individuelles']),
    );
  });

  describe('le contrôle détecte un groupe incomplet', () => {
    const avec = (id: string, alternatives: string[] = []) =>
      makeAide({ id, cumul: { cumulable: true, ...(alternatives.length > 0 && { alternatives }) } });

    it('un groupe de trois aides déclaré en chaîne a – b – c : a et c ne sont pas reliées', () => {
      expect(pairesNonDeclarees([avec('nat-a', ['nat-b']), avec('nat-b', ['nat-c']), avec('nat-c')])).toEqual(['nat-a ↔ nat-c']);
    });

    it('une étoile (le pivot ne déclare rien, les feuilles le déclarent) : les feuilles ne sont pas reliées entre elles', () => {
      const etoile = [avec('nat-hub'), avec('nat-b', ['nat-hub']), avec('nat-c', ['nat-hub']), avec('nat-d', ['nat-hub'])];
      expect(pairesNonDeclarees(etoile)).toEqual(['nat-b ↔ nat-c', 'nat-b ↔ nat-d', 'nat-c ↔ nat-d']);
    });

    it("un groupe complet (une déclaration dans un sens ou l'autre suffit) : rien à signaler", () => {
      expect(pairesNonDeclarees([avec('nat-a', ['nat-b', 'nat-c']), avec('nat-b', ['nat-c']), avec('nat-c')])).toEqual([]);
      expect(pairesNonDeclarees([avec('nat-a', ['nat-b']), avec('nat-b')])).toEqual([]);
    });

    it('chaque groupe est examiné séparément : deux groupes complets distincts ne sont pas confondus', () => {
      const deuxGroupes = [avec('nat-a', ['nat-b']), avec('nat-b'), avec('nat-c', ['nat-d']), avec('nat-d')];
      expect(pairesNonDeclarees(deuxGroupes)).toEqual([]);
    });

    it('une aide sans alternative ne forme aucun groupe', () => {
      expect(pairesNonDeclarees([avec('nat-a'), avec('nat-b')])).toEqual([]);
    });
  });
});

// --- 2. Solde CPF ----------------------------------------------------------------------------------------------------

describe('solde CPF : les lignes du plan prélevées sur le solde ne le dépassent jamais', () => {
  const IDS_SOLDE_CPF = new Set(EMBEDDED_AIDES.filter((a) => a.montant.mode === 'solde_cpf').map((a) => a.id));
  const sommeSurSoldeCpf = (plan: PlanFinancement): number =>
    plan.financements.filter((l) => IDS_SOLDE_CPF.has(l.id)).reduce((somme, l) => somme + l.montant, 0);
  const depassements = (resultats: Resultat[]): string[] =>
    resultats
      .filter((r) => centimes(sommeSurSoldeCpf(r.plan)) > centimes(r.scenario.soldeCpf))
      .map((r) => `${decrire(r.scenario)} : ${sommeSurSoldeCpf(r.plan)} € pour un solde de ${r.scenario.soldeCpf} €`);
  const eligiblesSurSolde = (r: Resultat): number => r.aides.filter((a) => a.statut === 'eligible' && IDS_SOLDE_CPF.has(a.id)).length;

  it('sur la grille de profils, avec le catalogue réel', () => {
    expect(resultatsGrille()).toHaveLength(TAILLE_DE_LA_GRILLE);
    expect(apercu(depassements(resultatsGrille()))).toEqual([]);
  });

  it("le contrôle est exercé : jusqu'à quatre aides prélevées sur le solde sont éligibles à la fois, et le solde est parfois utilisé en entier", () => {
    expect(Math.max(...resultatsGrille().map(eligiblesSurSolde))).toBe(4);
    const soldesUtilisesEnEntier = resultatsGrille().filter((r) => centimes(sommeSurSoldeCpf(r.plan)) === centimes(r.scenario.soldeCpf));
    expect(soldesUtilisesEnEntier.length).toBeGreaterThan(0);
    expect(resultatsGrille().some((r) => sommeSurSoldeCpf(r.plan) > 0 && sommeSurSoldeCpf(r.plan) < r.scenario.soldeCpf)).toBe(true);
  });

  it("même si aucune alternative n'était déclarée, le plan partage un seul solde entre les aides qui le prélèvent", () => {
    expect(apercu(depassements(resultatsSansAlternatives()))).toEqual([]);
    expect(Math.max(...resultatsSansAlternatives().map(eligiblesSurSolde))).toBe(4);
    expect(resultatsSansAlternatives().some((r) => centimes(sommeSurSoldeCpf(r.plan)) === centimes(r.scenario.soldeCpf))).toBe(true);
  });

  it("scénario réel d'une VAE à 8 000 € : nat-cpf est retenue, nat-vae et nat-clea sont des options « au choix » avec elle", () => {
    const r = jouer({ projet: 'formation_salarie', soldeCpf: 800, cout: 8000, annexes: false, dureeHeures: 140, certification: 'rncp', typeFormation: 'vae', opco: 'akto' });
    expect(r.plan.financements.map((l) => l.id)).toContain('nat-cpf');
    const options = r.plan.options.filter((o) => IDS_SOLDE_CPF.has(o.id)).map((o) => [o.id, o.raison]);
    expect(options).toEqual(
      expect.arrayContaining([
        ['nat-clea', 'Au choix avec « Compte personnel de formation (CPF) »'],
        ['nat-vae', 'Au choix avec « Compte personnel de formation (CPF) »'],
      ]),
    );
    expect(options).toHaveLength(2);
    expect(sommeSurSoldeCpf(r.plan)).toBe(800);
  });
});

// --- 3. POE ----------------------------------------------------------------------------------------------------------

describe('POE : une seule des trois entrées est retenue', () => {
  const POE = ['nat-poei', 'nat-poec', 'r52-poei-region'];

  /** Demandeur d'emploi inscrit à France Travail, recruté par une entreprise des Pays de la Loire (région 52). */
  function etatPoe(): WizardState {
    return {
      ...createInitialWizardState(),
      projetType: 'recrutement_demandeur_emploi',
      regionCode: '52',
      departementCode: '44',
      companySize: 'less_11',
      contractType: 'cdi',
      ageBeneficiaire: 30,
      niveauDiplome: 'bac',
      inscritFranceTravail: true,
      durationHours: 300,
      pedagogyCostTotal: 3000,
      pedagogyCostPerHour: 10,
    };
  }

  it("les trois aides sont éligibles pour ce demandeur d'emploi : exactement deux sont des options, la troisième est retenue", () => {
    const profil = profilDepuisWizard(etatPoe(), null);
    const aides = evaluerAides(EMBEDDED_AIDES, profil, DATE);
    expect(aides.filter((a) => POE.includes(a.id)).map((a) => [a.id, a.statut]).sort()).toEqual([
      ['nat-poec', 'eligible'],
      ['nat-poei', 'eligible'],
      ['r52-poei-region', 'eligible'],
    ]);

    const plan = construirePlan(null, aides, profil);
    const options = plan.options.map((o) => o.id);
    expect(POE.filter((id) => !options.includes(id))).toHaveLength(1);
    expect(POE.filter((id) => options.includes(id))).toHaveLength(2);
    // La retenue n'a pas de montant chiffré : elle figure parmi les aides non chiffrées, une seule fois.
    expect(plan.nonChiffrees.map((a) => a.id).filter((id) => POE.includes(id))).toEqual(POE.filter((id) => !options.includes(id)));
    expect(idsDuPlan(plan).filter((id) => POE.includes(id))).toHaveLength(3);
  });
});

// --- 4. VAE ----------------------------------------------------------------------------------------------------------

/**
 * Aides dont tout l'objet est la VAE (accompagnement, formation liée au parcours, abondement du CPF, forfait), lues une
 * par une à la tâche 17c. Elles portent le critère `types_formation: ['vae']`.
 */
const AIDES_VAE = [
  'nat-vae',
  'nat-vae-transitions-pro',
  'r02-aide-vae',
  'r24-abondement-cpf-vae',
  'r27-pass-vae-accompagnement',
  'r27-pass-vae-hybride',
  'r28-vae-demandeurs-emploi',
  'r93-pass-vae',
  'r94-assegnu-vae',
];

/** Aides qui couvrent la VAE parmi d'autres objets : elles ne sont pas propres à la VAE et restent ouvertes à tout type de formation. */
const COUVRENT_LA_VAE_PARMI_D_AUTRES_OBJETS: Record<string, string> = {
  'nat-cpf': 'compte qui finance toute formation éligible (certification, bloc de compétences, VAE, bilan de compétences, permis)',
  'nat-c2p-reconversion': 'points du compte professionnel de prévention pour une formation certifiante, un bilan de compétences ou une VAE',
  'nat-agefiph-adaptation-situations-formation': "adaptations versées à l'organisme de formation, au CFA ou au prestataire de bilan de compétences ou de VAE",
  'faf-fafcea': "formation des chefs d'entreprise artisanale (la VAE est un usage parmi la formation et le bilan de compétences)",
};

const RAISON_VAE = "Réservé aux formations de type : VAE (Validation des Acquis de l'Expérience)";
const RAISON_A_CONFIRMER = 'Montant ou conditions en cours de confirmation auprès du financeur';

/**
 * Parcours qui remplit tous les autres critères de l'aide (région, public, inscription à France Travail, contrat,
 * certification RNCP, éligibilité au CPF, Qualiopi) : seul le type de formation fait la différence.
 */
function etatPourAide(a: Aide, typeFormation: TrainingType | null): WizardState {
  const region = a.criteres.regions?.[0] ?? '11';
  return {
    ...createInitialWizardState(),
    projetType: a.projets[0],
    regionCode: region,
    regionBeneficiaireCode: region,
    inscritFranceTravail: true,
    contractType: 'cdi',
    certificationLevel: 'rncp',
    eligibleCpf: true,
    organismeQualiopi: true,
    formationType: typeFormation,
  };
}

const evaluerPourSonProfil = (a: Aide, typeFormation: TrainingType | null): AideEvaluee =>
  evaluerAide(a, profilDepuisWizard(etatPourAide(a, typeFormation), 'akto'), DATE);

describe("VAE : les aides propres à la VAE ne s'appliquent qu'aux formations de type VAE", () => {
  it("les aides propres à la VAE sont exactement celles qui portent types_formation : ['vae']", () => {
    const avecCritere = EMBEDDED_AIDES.filter((a) => a.criteres.types_formation !== undefined);
    expect(avecCritere.map((a) => a.id).sort()).toEqual([...AIDES_VAE].sort());
    expect(avecCritere.filter((a) => JSON.stringify(a.criteres.types_formation) !== '["vae"]').map((a) => a.id)).toEqual([]);
  });

  it('toute aide dont le nom évoque la VAE est propre à la VAE', () => {
    const evoquantLaVae = EMBEDDED_AIDES.filter((a) => /\bVAE\b|validation des acquis/i.test(a.nom));
    expect(evoquantLaVae.map((a) => a.id).sort()).toEqual([...AIDES_VAE].sort());
  });

  it("une aide qui couvre la VAE parmi d'autres objets reste ouverte à tous les types de formation", () => {
    for (const id of Object.keys(COUVRENT_LA_VAE_PARMI_D_AUTRES_OBJETS)) {
      expect(aide(id).criteres.types_formation).toBeUndefined();
      expect(AIDES_VAE).not.toContain(id);
    }
  });

  describe.each(AIDES_VAE)('%s', (id) => {
    const a = aide(id);
    const confirmation = a.statut === 'a_confirmer' ? [RAISON_A_CONFIRMER] : [];

    it.each(AUTRES_TYPES_QUE_VAE)('type %s : ni éligible ni à vérifier, hors périmètre, pour le seul motif du type', (type) => {
      expect(evaluerPourSonProfil(a, type)).toMatchObject({ statut: 'non_eligible', horsPerimetre: true, raisons: [RAISON_VAE] });
    });

    it("type vae : dans le périmètre, éligible (à vérifier si le financeur doit encore confirmer l'aide)", () => {
      expect(evaluerPourSonProfil(a, 'vae')).toMatchObject({
        statut: a.statut === 'actif' ? 'eligible' : 'a_verifier',
        horsPerimetre: false,
        raisons: confirmation,
      });
    });

    it('type inconnu : à vérifier, jamais éligible, jamais hors périmètre', () => {
      expect(evaluerPourSonProfil(a, null)).toMatchObject({
        statut: 'a_verifier',
        horsPerimetre: false,
        raisons: ['Précisez le type de formation', ...confirmation],
      });
    });
  });

  it("PASS'VAE Accompagnement (Bourgogne-Franche-Comté) : éligible pour une VAE, hors périmètre pour une certification", () => {
    const passVae = aide('r27-pass-vae-accompagnement');
    expect(passVae.statut).toBe('actif');
    expect(evaluerPourSonProfil(passVae, 'vae')).toMatchObject({ statut: 'eligible', horsPerimetre: false });
    expect(evaluerPourSonProfil(passVae, 'certification')).toMatchObject({ statut: 'non_eligible', horsPerimetre: true });
  });

  describe("scénario réel : salarié d'une TPE d'Île-de-France (AKTO, IDCC 1516, CDI), formation RNCP de 140 h à 4 200 €, solde CPF de 800 €", () => {
    const reel = (typeFormation: TrainingType | null): Resultat =>
      jouer({ projet: 'formation_salarie', soldeCpf: 800, cout: 4200, annexes: false, dureeHeures: 140, certification: 'rncp', typeFormation, opco: 'akto' });
    const vae = (r: Resultat) => r.aides.filter((a) => AIDES_VAE.includes(a.id));

    it.each(AUTRES_TYPES_QUE_VAE)(
      "type %s : aucune aide VAE n'est éligible ni à vérifier, toutes sont hors périmètre, aucune n'est dans le plan",
      (type) => {
        const r = reel(type);
        expect(vae(r)).toHaveLength(AIDES_VAE.length);
        expect(vae(r).filter((a) => a.statut === 'eligible' || a.statut === 'a_verifier').map((a) => a.id)).toEqual([]);
        expect(vae(r).filter((a) => !a.horsPerimetre).map((a) => a.id)).toEqual([]);
        expect(idsDuPlan(r.plan).filter((id) => AIDES_VAE.includes(id))).toEqual([]);
      },
    );

    it('type vae : nat-vae et nat-vae-transitions-pro sont éligibles, visibles et présentes dans le plan', () => {
      const r = reel('vae');
      const parId = Object.fromEntries(vae(r).map((a) => [a.id, [a.statut, a.horsPerimetre]]));
      expect(parId['nat-vae']).toEqual(['eligible', false]);
      expect(parId['nat-vae-transitions-pro']).toEqual(['eligible', false]);
      expect(r.plan.financements.map((l) => l.id)).toContain('nat-vae-transitions-pro');
      expect([...r.plan.financements.map((l) => l.id), ...r.plan.options.map((o) => o.id)]).toContain('nat-vae');
    });

    it('type inconnu : les deux aides nationales sont à vérifier (visibles), jamais comptées dans le plan', () => {
      const r = reel(null);
      const parId = Object.fromEntries(vae(r).map((a) => [a.id, [a.statut, a.horsPerimetre]]));
      expect(parId['nat-vae']).toEqual(['a_verifier', false]);
      expect(parId['nat-vae-transitions-pro']).toEqual(['a_verifier', false]);
      expect(idsDuPlan(r.plan).filter((id) => AIDES_VAE.includes(id))).toEqual([]);
    });

    it("pour une certification, le forfait de 2 000 € de la Transitions Pro n'est plus empilé contre le coût de la formation", () => {
      expect(reel('certification').plan.financements.map((l) => l.id)).not.toContain('nat-vae-transitions-pro');
    });
  });
});

// --- 5. Invariants du plan sur la grille ---------------------------------------------------------------------------

/**
 * Invariants que tout plan doit respecter : chacun renvoie les écarts d'un résultat (liste vide = respecté). Ils sont
 * vérifiés sur la grille principale, sur la grille élargie à l'alternance et aux demandeurs d'emploi, et sur le catalogue
 * sans alternative déclarée (le plan ne doit alors rien additionner de trop).
 */
const INVARIANTS: [string, (r: Resultat) => string[]][] = [
  [
    "le financé et le reste à charge redonnent le coût (coût pédagogique et frais annexes) au centime, le reste n'est jamais négatif",
    ({ scenario, plan }) =>
      centimes(plan.totalFinance + plan.resteACharge) !== centimes(coutAttendu(scenario)) ||
      centimes(plan.coutFormation) !== centimes(coutAttendu(scenario)) ||
      plan.resteACharge < 0
        ? [`${decrire(scenario)} : financé ${plan.totalFinance} + reste ${plan.resteACharge} pour un coût de ${coutAttendu(scenario)}`]
        : [],
  ],
  [
    'le total financé est la somme des lignes empilées',
    ({ scenario, plan }) =>
      centimes(plan.financements.reduce((somme, l) => somme + l.montant, 0)) !== centimes(plan.totalFinance) ? [decrire(scenario)] : [],
  ],
  [
    'chaque ligne empilée est strictement positive et ne dépasse jamais le coût de la formation',
    ({ scenario, plan }) =>
      plan.financements
        .filter((l) => !(centimes(l.montant) > 0 && centimes(l.montant) <= centimes(plan.coutFormation)))
        .map((l) => `${decrire(scenario)} : ${l.id} = ${l.montant}`),
  ],
  [
    'le plan ne contient aucune aide à vérifier ni non éligible',
    ({ scenario, aides, plan }) => {
      const pasEligibles = new Set(aides.filter((a) => a.statut !== 'eligible').map((a) => a.id));
      return idsDuPlan(plan)
        .filter((id) => pasEligibles.has(id))
        .map((id) => `${decrire(scenario)} : ${id}`);
    },
  ],
  [
    "chaque identifiant d'aide apparaît au plus une fois dans le plan",
    ({ scenario, plan }) => {
      const ids = idsDuPlan(plan);
      return ids.filter((id, i) => ids.indexOf(id) !== i).map((id) => `${decrire(scenario)} : ${id}`);
    },
  ],
  [
    'seules des aides de catégorie cout_formation sont empilées contre le coût de la formation, les autres catégories sont présentées à part',
    ({ scenario, aides, plan }) => {
      const categorie = new Map(aides.map((a) => [a.id, a.categorie]));
      const ligneOpco = (id: string) => id.startsWith('opco-');
      const hors = (liste: string[], accepte: (id: string) => boolean, nom: string) =>
        liste.filter((id) => !accepte(id)).map((id) => `${decrire(scenario)} : ${id} (catégorie ${categorie.get(id)}) dans ${nom}`);
      return [
        ...hors(plan.financements.map((l) => l.id), (id) => ligneOpco(id) || categorie.get(id) === 'cout_formation', 'financements'),
        ...hors(plan.aidesEmployeur.map((l) => l.id), (id) => ligneOpco(id) || categorie.get(id) === 'aide_employeur', 'aidesEmployeur'),
        ...hors(plan.remunerations.map((l) => l.id), (id) => categorie.get(id) === 'remuneration_beneficiaire', 'remunerations'),
        ...hors(plan.avantagesFiscauxSociaux.map((l) => l.id), (id) => categorie.get(id) === 'avantage_fiscal_social', 'avantagesFiscauxSociaux'),
        ...hors(plan.servicesGratuits.map((a) => a.id), (id) => categorie.get(id) === 'service_gratuit', 'servicesGratuits'),
        ...hors(plan.nonChiffrees.map((a) => a.id), (id) => categorie.get(id) !== 'service_gratuit', 'nonChiffrees'),
      ];
    },
  ],
];

describe.each([
  ['la grille de profils', resultatsGrille],
  ["la grille élargie à l'alternance et aux demandeurs d'emploi", resultatsElargis],
  ['le catalogue sans alternative déclarée', resultatsSansAlternatives],
])('plan : invariants sur %s', (_nom, resultats) => {
  it.each(INVARIANTS)('%s', (_titre, ecarts) => {
    expect(resultats().length).toBeGreaterThan(0);
    expect(apercu(resultats().flatMap(ecarts))).toEqual([]);
  });
});

describe('plan : la grille exerce les invariants', () => {
  it('la grille élargie compte autant de profils que prévu, dans cinq projets au total', () => {
    expect(resultatsElargis()).toHaveLength(TAILLE_DE_LA_GRILLE_ELARGIE);
    const projets = new Set([...resultatsGrille(), ...resultatsElargis()].map((r) => r.scenario.projet));
    expect([...projets].sort()).toEqual(
      ['alternance', 'formation_dirigeant', 'formation_salarie', 'reconversion_salarie', 'recrutement_demandeur_emploi'].sort(),
    );
  });

  it('des aides sont empilées, mises en option, non chiffrées ou gratuites, avec ou sans reste à charge, avec ou sans frais annexes', () => {
    const plans = resultatsGrille().map((r) => r.plan);
    expect(plans.some((p) => p.financements.length > 0)).toBe(true);
    expect(plans.some((p) => p.options.length > 0)).toBe(true);
    expect(plans.some((p) => p.nonChiffrees.length > 0)).toBe(true);
    expect(plans.some((p) => p.servicesGratuits.length > 0)).toBe(true);
    expect(plans.some((p) => p.resteACharge > 0)).toBe(true);
    expect(plans.some((p) => p.resteACharge === 0)).toBe(true);
    expect(resultatsGrille().some((r) => r.scenario.annexes && r.plan.coutFormation === r.scenario.cout + MONTANT_FRAIS_ANNEXES)).toBe(true);
  });

  it("des aides à l'employeur et des aides à la personne chiffrées du catalogue sont présentées à part, jamais empilées", () => {
    const plans = resultatsElargis().map((r) => r.plan);
    expect(plans.some((p) => p.aidesEmployeur.some((l) => !l.id.startsWith('opco-')))).toBe(true);
    expect(plans.some((p) => p.remunerations.length > 0)).toBe(true);
  });

  it("aucune aide propre à la VAE n'est dans le plan quand le type de formation n'est pas la VAE", () => {
    const fautives = [...resultatsGrille(), ...resultatsElargis()]
      .filter(({ scenario }) => scenario.typeFormation !== 'vae')
      .flatMap(({ scenario, plan }) =>
        idsDuPlan(plan)
          .filter((id) => AIDES_VAE.includes(id))
          .map((id) => `${decrire(scenario)} : ${id}`),
      );
    expect(apercu(fautives)).toEqual([]);
  });

  it('au contraire, pour le type VAE, les aides propres à la VAE du profil sont bien dans le plan', () => {
    const dansLePlan = resultatsGrille()
      .filter(({ scenario }) => scenario.typeFormation === 'vae')
      .flatMap(({ plan }) => idsDuPlan(plan).filter((id) => AIDES_VAE.includes(id)));
    expect(new Set(dansLePlan)).toEqual(new Set(['nat-vae', 'nat-vae-transitions-pro']));
  });
});
