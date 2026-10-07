// ============================================================
// Écran « Votre plan de financement » : calcul et logique de présentation, en fonctions pures (tests :
// tests/resultats.test.ts). Les montants viennent du moteur (@opco/core) ; ces fonctions les classent, les regroupent et
// calculent les parts de la barre empilée, sans jamais en inventer. Couleurs et emplois : apps/web/DESIGN.md, section 15.
// Ce module importe le catalogue d'aides : seuls les composants de l'écran, chargé à la demande, l'importent (jamais le
// lot initial du simulateur).
// ============================================================

import {
  EMBEDDED_AIDES,
  EMBEDDED_PORTAILS,
  FINANCEUR_LABELS,
  calculateFunding,
  construirePlan,
  dateDeReference,
  evaluerAides,
  getEmbeddedOpcoBySlug,
  profilDepuisWizard,
} from '@opco/core';
import type {
  AideEvaluee,
  AlerteOpco,
  Financeur,
  FundingLine,
  FundingResult,
  PlanFinancement,
  SourceAide,
  WizardState,
} from '@opco/core';
import { ouvreBudgetOpco } from './entreprise';
import { INSECABLE, formatEuro, horsCitations } from './format';

// --- Calcul -------------------------------------------------------------------------------------------------------

/**
 * Calcul de l'écran de résultats, dérivation pure de l'état du parcours. `aujourdhui` (AAAA-MM-JJ) est la date du jour,
 * lue par l'écran (jamais dans @opco/core) : référence de validité des aides, sauf début de formation futur.
 * - OPCO retenu : le choix de l'utilisateur, sinon celui détecté (même règle que useWizard.getEffectiveOpcoSlug).
 * - Jours de formation non saisis : 7 heures par jour.
 * - Le plan de développement des compétences de l'OPCO ne finance que les projets salariés (former un salarié,
 *   reconversion : `ouvreBudgetOpco`) ; le dirigeant, l'alternance et le recrutement d'un demandeur d'emploi passent par
 *   les aides, même avec un OPCO connu. Projet non choisi : « former un salarié ».
 */
export function calculer(state: WizardState, aujourdhui: string) {
  const slug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = slug ? getEmbeddedOpcoBySlug(slug) : undefined;
  const effectiveState =
    !state.trainingDays && state.durationHours ? { ...state, trainingDays: Math.ceil(state.durationHours / 7) } : state;
  const projet = effectiveState.projetType ?? 'formation_salarie';
  const avecPdc = opco != null && ouvreBudgetOpco(projet);
  const funding = avecPdc ? calculateFunding(opco, effectiveState) : null;
  const profil = profilDepuisWizard(effectiveState, slug);
  const aidesEvaluees = evaluerAides(EMBEDDED_AIDES, profil, dateDeReference(effectiveState.dateDebutFormation, aujourdhui));
  const plan = construirePlan(funding, aidesEvaluees, profil);
  const portail = EMBEDDED_PORTAILS.find((p) => p.region === profil.regionEntreprise) ?? null;
  return { opco, projet, funding, profil, aidesEvaluees, plan, portail };
}

/** Famille de couleur d'un financeur : segment de la barre empilée, pastille des lignes du plan et des groupes d'aides. */
export type FamilleCouleur = 'opco' | 'faf' | 'cpf' | 'region' | 'etat' | 'europe' | 'autre';

const FAMILLE_PAR_FINANCEUR: Record<Financeur, FamilleCouleur> = {
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

/** Nom d'une famille quand ses lignes n'ont pas un même nom court de financeur. */
export const LIBELLES_FAMILLE: Record<FamilleCouleur, string> = {
  opco: 'OPCO',
  faf: "Fonds d'assurance formation",
  cpf: 'Compte personnel de formation',
  region: 'Région',
  etat: 'État et France Travail',
  europe: 'Union européenne',
  autre: 'Autres financeurs',
};

/** OPCO et branche ; fonds d'assurance formation ; CPF ; Région et département ; État et France Travail ; Europe ; autres. */
export function familleCouleur(financeur: Financeur): FamilleCouleur {
  return FAMILLE_PAR_FINANCEUR[financeur] ?? 'autre';
}

/**
 * Financeur d'une ligne du plan : celui de l'aide du catalogue qui porte son identifiant ; à défaut, l'OPCO pour les lignes
 * issues du calcul de l'OPCO (identifiants « opco-… » : plan de développement des compétences, salaires, transport,
 * dispositifs), sinon « autre ».
 */
export function financeurDeLigne(id: string, aides: readonly Pick<AideEvaluee, 'id' | 'financeur'>[]): Financeur {
  const aide = aides.find((a) => a.id === id);
  if (aide) return aide.financeur;
  return id.startsWith('opco-') ? 'opco' : 'autre';
}

/** Nom porté par toutes les entrées s'il est le même partout et tient en `max` caractères ; sinon null. */
function nomCommun(noms: readonly string[], max: number): string | null {
  const premier = noms[0];
  return premier !== undefined && premier.length <= max && noms.every((n) => n === premier) ? premier : null;
}

// --- En-tête ------------------------------------------------------------------------------------------------------

/**
 * Ce que le bandeau de synthèse peut afficher :
 * - `cout_inconnu` : le coût de la formation n'est pas renseigné (le moteur le compte 0) : ni « Financé » ni « Reste à
 *   charge », jamais « 0 € » ;
 * - `aucun_financement_chiffre` : aucun financement de la formation n'est chiffré (les aides existent, mais leur montant
 *   dépend du dossier, ou elles ne réduisent pas le prix de la formation) : le coût seul, jamais « Financé 0 € » ;
 * - `plan_chiffre` : coût, financé et reste à charge.
 */
export type EtatEnTete = 'cout_inconnu' | 'aucun_financement_chiffre' | 'plan_chiffre';

export function etatEnTete(plan: Pick<PlanFinancement, 'coutFormation' | 'financements' | 'totalFinance'>): EtatEnTete {
  if (!(plan.coutFormation > 0)) return 'cout_inconnu';
  if (plan.financements.length === 0 || !(plan.totalFinance > 0)) return 'aucun_financement_chiffre';
  return 'plan_chiffre';
}

// --- Barre empilée ------------------------------------------------------------------------------------------------

/** Part de la barre : une famille de financeurs (lignes additionnées) ou le reste à charge. */
export interface PartBarre {
  cle: FamilleCouleur | 'reste';
  /** Nom court du financeur commun aux lignes de la famille, sinon nom de la famille ; « Reste à charge ». */
  libelle: string;
  /** Euros, au centime. */
  montant: number;
  /** Pourcentage entier du coût de la formation ; la somme des parts vaut exactement 100. */
  part: number;
}

/** Longueur au-delà de laquelle le nom d'un financeur cède la place au nom de sa famille dans la légende. */
const NOM_COURT_LEGENDE = 30;

/**
 * Parts de la barre empilée : une part par famille de financeurs, dans l'ordre de l'empilement (première ligne de chaque
 * famille), puis le reste à charge, qui complète le coût. Calcul en centimes : chaque ligne est bornée à ce qui reste du
 * coût (aucune part ne dépasse le coût ; le moteur le garantit déjà) et une ligne nulle ou négative est ignorée. Les
 * pourcentages sont entiers et leur somme vaut exactement 100 (méthode du plus fort reste : arrondi inférieur, puis un
 * point de plus aux plus grandes décimales, la première part l'emportant à égalité) ; une part de moins de 1 % peut
 * valoir 0 (la légende écrit alors « moins de 1 % »). Coût inconnu (0) : aucune part.
 */
export function partsBarre(
  plan: Pick<PlanFinancement, 'coutFormation' | 'financements'>,
  aides: readonly Pick<AideEvaluee, 'id' | 'financeur'>[],
): PartBarre[] {
  const coutCentimes = Number.isFinite(plan.coutFormation) ? Math.round(plan.coutFormation * 100) : 0;
  if (coutCentimes <= 0) return [];

  const familles: { cle: FamilleCouleur; centimes: number; noms: string[] }[] = [];
  let restant = coutCentimes;
  for (const ligne of plan.financements) {
    const centimes = Math.min(Math.max(0, Math.round(ligne.montant * 100)), restant);
    if (!(centimes > 0)) continue;
    restant -= centimes;
    const cle = familleCouleur(financeurDeLigne(ligne.id, aides));
    const famille = familles.find((f) => f.cle === cle);
    if (famille) {
      famille.centimes += centimes;
      famille.noms.push(ligne.financeurNom);
    } else {
      familles.push({ cle, centimes, noms: [ligne.financeurNom] });
    }
  }

  const segments: { cle: PartBarre['cle']; libelle: string; centimes: number }[] = familles.map((f) => ({
    cle: f.cle,
    libelle: nomCommun(f.noms, NOM_COURT_LEGENDE) ?? LIBELLES_FAMILLE[f.cle],
    centimes: f.centimes,
  }));
  if (restant > 0) segments.push({ cle: 'reste', libelle: 'Reste à charge', centimes: restant });

  // Plus fort reste sur les pourcentages exacts.
  const exacts = segments.map((s) => (s.centimes * 100) / coutCentimes);
  const parts = exacts.map(Math.floor);
  let manquant = 100 - parts.reduce((somme, p) => somme + p, 0);
  const parDecimale = exacts
    .map((exact, index) => ({ index, decimale: exact - Math.floor(exact) }))
    .sort((a, b) => b.decimale - a.decimale || a.index - b.index);
  for (const { index } of parDecimale) {
    if (manquant <= 0) break;
    parts[index] += 1;
    manquant -= 1;
  }

  return segments.map((s, i) => ({ cle: s.cle, libelle: s.libelle, montant: s.centimes / 100, part: parts[i] }));
}

/** Pourcentage d'une part, à la française ; « moins de 1 % » pour une part non nulle arrondie à 0. */
export function libellePart(p: PartBarre): string {
  return p.part === 0 && p.montant > 0 ? `moins de 1${INSECABLE}%` : `${p.part}${INSECABLE}%`;
}

/**
 * Part du coût couverte par les financements, sous le chiffre « Financé » : « 74 % du coût ». Jamais « 100 % » tant qu'un
 * reste à charge existe (« plus de 99 % »), jamais « 0 % » quand un financement existe (« moins de 1 % ») ; null sans
 * financement.
 */
export function partFinancee(parts: readonly PartBarre[]): string | null {
  const financees = parts.filter((p) => p.cle !== 'reste' && p.montant > 0);
  if (financees.length === 0) return null;
  const reste = parts.find((p) => p.cle === 'reste' && p.montant > 0);
  const part = 100 - (reste?.part ?? 0);
  const libelle =
    reste && part >= 100 ? `plus de 99${INSECABLE}%` : part <= 0 ? `moins de 1${INSECABLE}%` : `${part}${INSECABLE}%`;
  return `${libelle} du coût`;
}

/** Équivalent textuel de la barre (nom accessible) : chaque part avec son montant et son pourcentage. */
export function descriptionBarre(parts: readonly PartBarre[], cout: number): string {
  const morceaux = parts.map(
    (p) => `${p.cle === 'reste' ? 'reste à charge' : p.libelle}, ${formatEuro(p.montant)}, ${libellePart(p)}`,
  );
  return `Répartition du coût de la formation (${formatEuro(cout)})${INSECABLE}: ${morceaux.join(`${INSECABLE}; `)}.`;
}

// --- Aides par financeur ------------------------------------------------------------------------------------------

/** Groupe d'aides d'un même financeur (famille du catalogue : CPF, Région, France Travail…). */
export interface GroupeAides {
  financeur: Financeur;
  famille: FamilleCouleur;
  /** Nom du financeur commun aux aides du groupe s'il est court, sinon celui de la famille (« État », « Région »…). */
  titre: string;
  aides: AideEvaluee[];
}

/** Longueur au-delà de laquelle le nom d'un financeur cède la place à celui de sa famille en tête de groupe. */
const NOM_COURT_GROUPE = 40;

/**
 * Familles dont le libellé est générique (« Région », « Autres financeurs »…) : le groupe prend le nom propre commun à ses
 * aides (« Région Occitanie », « FAFCEA », « Action Logement »). Les autres (CPF, État, Europe, OPCO, France Travail…)
 * gardent toujours leur libellé, pour qu'un même financeur ait le même titre d'une simulation à l'autre.
 */
const TITRE_PAR_NOM_PROPRE: ReadonlySet<Financeur> = new Set(['region', 'departement', 'faf', 'branche', 'autre']);

/**
 * Aides visibles (éligibles et à vérifier), groupées par financeur (`financeur` du catalogue : le nom détaillé,
 * `financeurNom`, varie d'une aide à l'autre pour un même financeur), groupes et aides dans l'ordre de la liste évaluée.
 */
export function groupesAidesVisibles(aides: readonly AideEvaluee[]): GroupeAides[] {
  const groupes: GroupeAides[] = [];
  for (const a of aides) {
    if (a.statut === 'non_eligible') continue;
    const groupe = groupes.find((g) => g.financeur === a.financeur);
    if (groupe) groupe.aides.push(a);
    else groupes.push({ financeur: a.financeur, famille: familleCouleur(a.financeur), titre: '', aides: [a] });
  }
  for (const g of groupes) {
    const nomPropre = TITRE_PAR_NOM_PROPRE.has(g.financeur)
      ? nomCommun(g.aides.map((a) => a.financeurNom), NOM_COURT_GROUPE)
      : null;
    g.titre = nomPropre ?? FINANCEUR_LABELS[g.financeur];
  }
  return groupes;
}

/** Aides non éligibles montrées (repliées, sans montant) : jamais celles d'un autre projet, public, région ou type. */
export function aidesNonEligiblesAffichees(aides: readonly AideEvaluee[]): AideEvaluee[] {
  return aides.filter((a) => a.statut === 'non_eligible' && !a.horsPerimetre);
}

/** Montant d'une carte d'aide. */
export type MontantAffiche = { genre: 'jusqua'; montant: number } | { genre: 'selon_dossier' } | { genre: 'aucun' };

/**
 * Montant d'une aide éligible ou à vérifier : « jusqu'à » le montant estimé, « Montant selon dossier » sans estimation,
 * « Aucun montant estimé pour ce profil » à 0. Jamais pour une aide non éligible (son montant est ce qu'elle verserait si
 * le profil y avait droit) : null.
 */
export function montantAffiche(aide: Pick<AideEvaluee, 'statut' | 'montantEstime'>): MontantAffiche | null {
  if (aide.statut === 'non_eligible') return null;
  if (aide.montantEstime == null) return { genre: 'selon_dossier' };
  return aide.montantEstime > 0 ? { genre: 'jusqua', montant: aide.montantEstime } : { genre: 'aucun' };
}

// --- Sources ------------------------------------------------------------------------------------------------------

export interface SourcesDeLAide {
  /** Pages citées, une fois par adresse (le catalogue cite souvent une page pour plusieurs extraits), titre complet. */
  pages: { url: string; titre: string }[];
  /** Un lien par site (« service-public.gouv.fr »), vers la première page citée de ce site : libellés courts et distincts. */
  sites: { url: string; site: string; titre: string }[];
}

function site(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || 'Source';
  } catch {
    return 'Source';
  }
}

/**
 * Sources d'une aide, dans l'ordre des données : les pages distinctes (détail de la carte, titre complet) et un lien par
 * site (pied de la carte). Une adresse illisible compte pour le site « Source ».
 */
export function sourcesDeLAide(sources: readonly Pick<SourceAide, 'url' | 'titre'>[]): SourcesDeLAide {
  const pages: SourcesDeLAide['pages'] = [];
  const sites: SourcesDeLAide['sites'] = [];
  for (const s of sources) {
    if (pages.some((p) => p.url === s.url)) continue;
    pages.push({ url: s.url, titre: s.titre });
    const nom = site(s.url);
    if (!sites.some((x) => x.site === nom)) sites.push({ url: s.url, site: nom, titre: s.titre });
  }
  return { pages, sites };
}

/** Identifiant d'aide du catalogue cité dans un texte (« nat-cpf », « r76-remuneration-stagiaires », « faf-fafcea »…). */
const IDENTIFIANT_D_AIDE = /\b(?:nat|r\d{2}|ue|faf|fis)-[a-z0-9]+(?:-[a-z0-9]+)*/g;

/**
 * Les textes du catalogue (notes de cumul surtout) renvoient parfois à une autre aide par son identifiant technique :
 * chaque identifiant connu devient le nom de l'aide, entre guillemets. Un identifiant inconnu et les extraits cités
 * restent tels quels.
 */
export function nommerAides(texte: string, nomParId: ReadonlyMap<string, string>): string {
  return horsCitations(texte, (morceau) =>
    morceau.replace(IDENTIFIANT_D_AIDE, (id) => {
      const nom = nomParId.get(id);
      return nom ? `«${INSECABLE}${nom}${INSECABLE}»` : id;
    }),
  );
}

// --- Cartes du plan -----------------------------------------------------------------------------------------------

/** Cartes du plan, hors bandeau de synthèse. */
export type CartePlan = 'financements' | 'options' | 'employeur' | 'personne' | 'avantages' | 'non-chiffrees' | 'services';

const ORDRE_CHIFFRE: CartePlan[] = ['financements', 'options', 'employeur', 'personne', 'avantages', 'non-chiffrees', 'services'];
/** Aucun financement chiffré : d'abord ce qui existe pour la situation (montant selon dossier, employeur, personne). */
const ORDRE_SANS_FINANCEMENT: CartePlan[] = ['non-chiffrees', 'employeur', 'personne', 'options', 'avantages', 'services', 'financements'];

function nombreDeLignes(plan: PlanFinancement, carte: CartePlan): number {
  switch (carte) {
    case 'financements':
      return plan.financements.length;
    case 'options':
      return plan.options.length;
    case 'employeur':
      return plan.aidesEmployeur.length;
    case 'personne':
      return plan.remunerations.length;
    case 'avantages':
      return plan.avantagesFiscauxSociaux.length;
    case 'non-chiffrees':
      return plan.nonChiffrees.length;
    case 'services':
      return plan.servicesGratuits.length;
  }
}

/** Cartes à afficher, dans l'ordre de l'état du bandeau ; une carte vide n'est jamais rendue. */
export function cartesDuPlan(plan: PlanFinancement): CartePlan[] {
  const ordre = etatEnTete(plan) === 'aucun_financement_chiffre' ? ORDRE_SANS_FINANCEMENT : ORDRE_CHIFFRE;
  return ordre.filter((carte) => nombreDeLignes(plan, carte) > 0);
}

/** Rappel du bandeau vers une carte mise en avant. */
export interface Rappel {
  carte: CartePlan;
  nombre: number;
  libelle: string;
}

const ACCORDS: { carte: CartePlan; un: string; plusieurs: string }[] = [
  { carte: 'non-chiffrees', un: 'aide au montant selon dossier', plusieurs: 'aides au montant selon dossier' },
  { carte: 'employeur', un: "aide versée à l'employeur", plusieurs: "aides versées à l'employeur" },
  { carte: 'personne', un: 'revenu ou aide à la personne', plusieurs: 'revenus et aides à la personne' },
];

/**
 * Quand aucun financement de la formation n'est chiffré, le bandeau renvoie vers les cartes qui portent les aides
 * identifiées : montant selon dossier, aides versées à l'employeur, revenus et aides à la personne (cartes non vides).
 */
export function rappelsAucunFinancement(plan: PlanFinancement): Rappel[] {
  return ACCORDS.map(({ carte, un, plusieurs }) => {
    const nombre = nombreDeLignes(plan, carte);
    return { carte, nombre, libelle: `${nombre} ${nombre > 1 ? plusieurs : un}` };
  }).filter((r) => r.nombre > 0);
}

/** Encadré du bandeau quand aucun financement de la formation n'est chiffré : texte et liens vers les cartes. */
export interface EncadreSansFinancement {
  texte: string;
  rappels: Rappel[];
}

/**
 * Encadré du bandeau quand aucun financement de la formation n'est chiffré (`aucun_financement_chiffre`). Il ne cite que
 * ce qui suit à l'écran :
 * - des options au choix chiffrées : elles ont un montant, à comparer ; « les autres financeurs fixent le montant après
 *   étude du dossier » seulement si une aide ou une option est au montant selon dossier ;
 * - sinon des aides identifiées (montant selon dossier, aides versées à l'employeur, revenus et aides à la personne) :
 *   « Voici les aides identifiées », avec les liens vers leurs cartes (`rappels`) ; l'étude du dossier n'est citée que
 *   pour des aides au montant selon dossier, sinon le texte dit qu'elles ne réduisent pas le prix de la formation ;
 * - sinon aucune autre aide à montant : le dire, renvoyer à l'OPCO ou au fonds d'assurance formation et aux portails
 *   de la région quand ils existent (`avecPortail`), et préciser quand seuls des services gratuits suivent.
 */
export function encadreSansFinancement(plan: PlanFinancement, avecPortail: boolean): EncadreSansFinancement {
  const rappels = rappelsAucunFinancement(plan);
  const optionsChiffrees = plan.options.some((o) => o.montantEstime != null && o.montantEstime > 0);
  const selonDossier = plan.nonChiffrees.length > 0 || plan.options.some((o) => o.montantEstime == null);
  if (optionsChiffrees) {
    const suite = selonDossier ? ', et les autres financeurs fixent le montant après étude du dossier' : '';
    return {
      texte: `Aucun financement cumulable n'est chiffré pour cette formation${INSECABLE}: les options au choix ont un montant, à comparer${suite}.`,
      rappels,
    };
  }
  if (rappels.length > 0) {
    return {
      texte: selonDossier
        ? `Aucun financement de la formation n'est chiffrable à ce stade${INSECABLE}: les financeurs fixent le montant après étude du dossier. Voici les aides identifiées.`
        : "Aucun financement de la formation n'est chiffrable pour cette situation. Voici les aides identifiées, qui ne réduisent pas le prix de la formation.",
      rappels,
    };
  }
  const cartes = cartesDuPlan(plan);
  const servicesSeuls = cartes.length > 0 && cartes.every((c) => c === 'services');
  const phrases = [
    "Aucun financement de la formation n'est chiffrable et aucune autre aide à montant n'a été identifiée pour cette situation.",
    servicesSeuls ? 'Seuls des services gratuits sont proposés ci-dessous.' : null,
    `Interrogez l'OPCO ou le fonds d'assurance formation compétent${avecPortail ? ', et consultez les portails officiels de la région en bas de page' : ''}.`,
  ];
  return { texte: phrases.filter((p): p is string => p != null).join(' '), rappels };
}

// --- Alertes de l'OPCO --------------------------------------------------------------------------------------------

/**
 * Branches dont l'OPCO signale l'enveloppe épuisée, quand le plan compte son plan de développement des compétences
 * (ligne `opco-pdc`) : le bandeau le dit à côté du montant, la prise en charge pouvant être refusée. Sans doublon, dans
 * l'ordre des alertes ; aucune quand le plan ne compte pas ce financement.
 */
export function fondsEpuisesSurLePlan(
  plan: Pick<PlanFinancement, 'financements'>,
  alertes: readonly Pick<AlerteOpco, 'type' | 'branche'>[],
): string[] {
  if (!plan.financements.some((l) => l.id === 'opco-pdc')) return [];
  return [...new Set(alertes.filter((a) => a.type === 'fonds_epuises').map((a) => a.branche))];
}

// --- Détail de l'estimation OPCO ----------------------------------------------------------------------------------

/**
 * Ligne dont le moteur ne chiffre rien : l'OPCO ne publie pas de barème pour ce poste (confiance « selon branche » et
 * 0 € financé). Elle s'affiche avec sa règle seule, jamais avec « 0 € » : un montant nul n'est montré que s'il est publié
 * comme tel.
 */
export function sansMontantEstime(line: Pick<FundingLine, 'confidence' | 'fundedAmount'>): boolean {
  return line.confidence === 'depends_on_branche' && line.fundedAmount === 0;
}

/** Lignes du détail par poste : un montant demandé ou financé, ou une règle sans montant estimé. */
export function lignesDuDetail(result: Pick<FundingResult, 'lines'>): FundingLine[] {
  return result.lines.filter((l) => l.requestedAmount > 0 || l.fundedAmount > 0 || sansMontantEstime(l));
}

// --- Listes de conventions collectives ----------------------------------------------------------------------------

export type MorceauIdcc = { genre: 'texte'; valeur: string } | { genre: 'idcc'; codes: string[] };

/** Nombre de codes au-delà duquel une liste « IDCC … » se replie (« 12 conventions collectives », dépliable). */
const CODES_AVANT_REPLI = 6;
const LISTE_IDCC = /IDCC (\d{3,4}(?:, \d{3,4})*)/g;

/**
 * Découpe un texte des données autour de ses listes de codes de convention collective (« IDCC 1702, 2614, … ») : une liste
 * de plus de 6 codes devient un morceau `idcc` (le préfixe « IDCC » compris), le reste du texte est gardé tel quel ; les
 * morceaux recomposent le texte à l'identique. Texte vide : aucun morceau.
 */
export function replierIdcc(texte: string): MorceauIdcc[] {
  const morceaux: MorceauIdcc[] = [];
  let debut = 0;
  for (const m of texte.matchAll(LISTE_IDCC)) {
    const codes = m[1].split(', ');
    if (codes.length <= CODES_AVANT_REPLI) continue;
    if (m.index > debut) morceaux.push({ genre: 'texte', valeur: texte.slice(debut, m.index) });
    morceaux.push({ genre: 'idcc', codes });
    debut = m.index + m[0].length;
  }
  if (debut < texte.length) morceaux.push({ genre: 'texte', valeur: texte.slice(debut) });
  return morceaux;
}

// --- Région -------------------------------------------------------------------------------------------------------

const PREPOSITIONS: Record<string, string> = {
  'La Réunion': 'à La Réunion',
  Mayotte: 'à Mayotte',
  'Grand Est': 'dans le Grand Est',
  'Hauts-de-France': 'dans les Hauts-de-France',
  'Pays de la Loire': 'dans les Pays de la Loire',
};

/** Nom de région précédé de sa préposition : « en Bretagne », « à La Réunion », « dans les Hauts-de-France ». */
export function enRegion(nom: string): string {
  return PREPOSITIONS[nom] ?? `en ${nom}`;
}
