// ============================================================
// Écran « Votre plan de financement » : calcul et logique de présentation, en fonctions pures (tests :
// tests/resultats.test.ts). Les montants viennent du moteur (@opco/core) ; ces fonctions les classent, les regroupent et
// calculent les parts de la barre empilée, sans jamais en inventer. Couleurs et emplois : apps/web/DESIGN.md, section 15.
// Les encadrés du bandeau (aucun financement chiffré, fonds épuisés) sont dans lib/encadres-resultats.ts.
// Ce module importe le catalogue d'aides : seuls les composants de l'écran, chargé à la demande, l'importent (jamais le
// lot initial du simulateur).
// ============================================================

import {
  EMBEDDED_AIDES,
  EMBEDDED_PORTAILS,
  FINANCEUR_LABELS,
  calculateFunding,
  construirePlanDuBloc,
  dateDeReference,
  etatDuProfil,
  evaluerAides,
  fusionnerAides,
  fusionnerPlans,
  getEmbeddedOpcoBySlug,
  profilDepuisWizard,
  profilsDuGroupe,
  repartirCentimes,
  repartirFinancement,
  resolveVarianteBranche,
} from '@opco/core';
import type {
  AideEvaluee,
  Confidence,
  DispositifEligible,
  Financeur,
  FundingLine,
  FundingResult,
  LignePlan,
  OptionPlan,
  PlanFinancement,
  ProfilAides,
  ProfilDuGroupe,
  SourceAide,
  VarianteBranche,
  WizardState,
} from '@opco/core';
import { ouvreBudgetOpco } from './entreprise';
import { formatEuro, horsCitations, nombreEtUnite } from './format';
import { INSECABLE } from './insecable';
import { libelleDuProfil } from './profils';
import { SIGLES, citeLeSigle } from './sigles';

// --- Calcul -------------------------------------------------------------------------------------------------------

/** Ce que l'écran sait d'un profil du groupe. */
export interface BlocResultat {
  profil: ProfilDuGroupe;
  /** Profil évalué par le moteur d'aides : celui d'UNE personne de ce profil. */
  profilAides: ProfilAides;
  /** Aides du catalogue évaluées pour UNE personne de ce profil. */
  aides: AideEvaluee[];
  /**
   * Part de ce profil dans le calcul de l'OPCO (valable pour ses personnes) ; null s'il ne relève pas de ce plan. Ses textes
   * restent ceux du groupe entier (« Coût pour 5 personnes : ... ») : l'écran ne l'affiche jamais, seul le plan de son bloc se lit.
   */
  funding: FundingResult | null;
  /** Plan du profil, pour toutes ses personnes. */
  plan: PlanFinancement;
}

/** Le groupe vu par l'écran de résultats. */
export interface ResultatGroupe {
  personnes: number;
  /** Personnes qui relèvent du plan de développement des compétences de l'OPCO (les salariés, avec un OPCO connu). */
  personnesPdc: number;
  blocs: BlocResultat[];
}

/**
 * Calcul de l'écran de résultats, dérivation pure de l'état du parcours. `aujourdhui` (AAAA-MM-JJ) est la date du jour,
 * lue par l'écran (jamais dans @opco/core) : référence de validité des aides, sauf début de formation futur.
 * - OPCO retenu : le choix de l'utilisateur, sinon celui détecté (même règle que les étapes Entreprise et Formation).
 * - Jours de formation non saisis : 7 heures par jour.
 * - Le plan de développement des compétences de l'OPCO ne finance que les projets salariés (former un salarié,
 *   reconversion : `ouvreBudgetOpco`) ; le dirigeant, l'alternance et le recrutement d'un demandeur d'emploi passent par
 *   les aides, même avec un OPCO connu. Projet non choisi : « former un salarié ».
 * - `variante` : le barème de branche que le moteur applique (`resolveVarianteBranche`, la même règle que lui), ou null.
 * - Groupe : le moteur de l'OPCO est appelé UNE fois, pour les personnes des profils salariés (le plafond annuel est celui
 *   de l'entreprise) ; son résultat se répartit entre ces profils en centimes entiers ; chaque profil construit son plan
 *   (`construirePlanDuBloc`) ; `plan` et `aidesEvaluees` sont les fusions de ceux des profils. `funding` est le calcul de
 *   l'OPCO du groupe entier. Pour une personne seule, tout est ce que l'écran calculait avant les groupes.
 * - Coût pédagogique : avec plusieurs profils, le coût du groupe (celui d'une personne multiplié par l'effectif, au centime)
 *   se répartit entre les profils en centimes entiers (plus grands restes, comme le résultat de l'OPCO), pour que la somme
 *   des plans des profils soit exactement le prix du groupe (1 000 € pour trois profils d'une personne : 333,34, 333,33 et
 *   333,33 €, jamais 999,99 €). Les aides se jugent sur le coût réel d'une personne ; seul le plan du profil porte la part.
 */
export function calculer(state: WizardState, aujourdhui: string) {
  const slug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = slug ? getEmbeddedOpcoBySlug(slug) : undefined;
  const effectiveState =
    !state.trainingDays && state.durationHours ? { ...state, trainingDays: Math.ceil(state.durationHours / 7) } : state;
  const projet = effectiveState.projetType ?? 'formation_salarie';
  const profils = profilsDuGroupe(effectiveState);
  const profilsPdc = profils.filter((p) => opco != null && ouvreBudgetOpco(p.champs.projetType));
  const personnesPdc = profilsPdc.reduce((somme, p) => somme + p.nombre, 0);
  const funding = opco && personnesPdc > 0 ? calculateFunding(opco, effectiveState, personnesPdc) : null;
  // Un seul profil relève du plan : sa part est le résultat entier (aucune répartition).
  const parts = funding
    ? profilsPdc.length === 1
      ? [funding]
      : repartirFinancement(
          funding,
          profilsPdc.map((p) => p.nombre),
        )
    : [];
  const variante = opco ? resolveVarianteBranche(opco, effectiveState) : null;
  const dateRef = dateDeReference(effectiveState.dateDebutFormation, aujourdhui);
  const personnes = profils.reduce((somme, p) => somme + p.nombre, 0);
  // Plusieurs profils : le coût pédagogique du groupe, réparti en centimes entiers ; un seul profil : rien à répartir.
  const coutsPedagogiques =
    profils.length > 1 && effectiveState.pedagogyCostTotal != null
      ? repartirCentimes(
          Math.round(effectiveState.pedagogyCostTotal * personnes * 100),
          profils.map((p) => p.nombre),
        )
      : null;
  const blocs: BlocResultat[] = profils.map((profil, i) => {
    const profilAides = profilDepuisWizard(etatDuProfil(effectiveState, profil), slug);
    const aides = evaluerAides(EMBEDDED_AIDES, profilAides, dateRef);
    const rang = profilsPdc.indexOf(profil);
    const part = rang >= 0 ? parts[rang] : null;
    const profilDuPlan = coutsPedagogiques
      ? { ...profilAides, coutPedagogique: coutsPedagogiques[i] / 100 / profil.nombre }
      : profilAides;
    return { profil, profilAides, aides, funding: part, plan: construirePlanDuBloc(part, aides, profilDuPlan, profil.nombre) };
  });
  const aidesEvaluees = fusionnerAides(blocs.map((b) => ({ profil: b.profil, aides: b.aides })));
  const plan = fusionnerPlans(
    blocs.map((b) => b.plan),
    aidesEvaluees,
  );
  const profil = blocs[0].profilAides;
  const portail = EMBEDDED_PORTAILS.find((p) => p.region === profil.regionEntreprise) ?? null;
  const groupe: ResultatGroupe = { personnes, personnesPdc, blocs };
  return { opco, projet, funding, variante, profil, aidesEvaluees, plan, portail, groupe };
}

// --- Relais du plan conventionnel de la branche --------------------------------------------------------------------

/**
 * Plan conventionnel de la branche en relais d'un plan de développement des compétences épuisé : l'OPCO et le plafond
 * annuel par entreprise (euros ; null s'il n'est pas publié).
 */
export interface RelaisPlanConventionnel {
  opco: string;
  plafondAnnuel: number | null;
}

/**
 * Relais du plan conventionnel (`relais_plan_conventionnel` de la variante appliquée : AKTO, organismes de formation) :
 * le barème calculé est celui du plan conventionnel de la branche, qui finance les demandes que l'enveloppe épuisée du
 * plan de développement des compétences ne peut plus engager, dans la limite de `budget_annuel_max` par entreprise et par
 * an. Null sans calcul de l'OPCO, sans relais, ou quand ce plan est fermé aux 50 salariés et plus (le bandeau dit alors
 * pourquoi).
 */
export function relaisDuPlanConventionnel(r: {
  funding: Pick<FundingResult, 'opcoName' | 'pdcFerme'> | null;
  variante: Pick<VarianteBranche, 'relais_plan_conventionnel' | 'budget_annuel_max'> | null;
}): RelaisPlanConventionnel | null {
  if (!r.funding || r.funding.pdcFerme || r.variante?.relais_plan_conventionnel !== true) return null;
  return { opco: r.funding.opcoName, plafondAnnuel: r.variante.budget_annuel_max?.value ?? null };
}

/** Nom du financement porté par la ligne de l'OPCO quand le plan conventionnel de la branche prend le relais. */
const PLAN_CONVENTIONNEL = 'Plan conventionnel de branche';

/**
 * Libellés d'une ligne du plan : le nom du poste et le financeur. La ligne du plan de développement des compétences
 * (`opco-pdc`) d'une branche en relais devient « Plan conventionnel de branche », du même OPCO : c'est sur ce plan que
 * la demande est financée. Toute autre ligne garde les siens.
 */
export function libellesDeLigne(
  ligne: Pick<LignePlan, 'id' | 'nom' | 'financeurNom'>,
  relais: RelaisPlanConventionnel | null,
): { nom: string; financeurNom: string } {
  return relais && ligne.id === 'opco-pdc'
    ? { nom: PLAN_CONVENTIONNEL, financeurNom: ligne.financeurNom }
    : { nom: ligne.nom, financeurNom: ligne.financeurNom };
}

/** Dispositif nommé en tête du détail de l'OPCO : celui du moteur, ou le plan conventionnel qui prend le relais. */
export function dispositifAffiche(
  funding: Pick<FundingResult, 'dispositifPrincipal'>,
  relais: RelaisPlanConventionnel | null,
): string {
  return relais ? `${PLAN_CONVENTIONNEL}, en relais du plan de développement des compétences épuisé` : funding.dispositifPrincipal;
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
const LIBELLES_FAMILLE: Record<FamilleCouleur, string> = {
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

/** Sigles définis dans le titre d'une carte d'aide (les aides du Fonds social européen plus portent « FSE+ »). */
const SIGLES_DES_TITRES = ['FSE+'] as const;

/**
 * Sigles à définir dans le titre des cartes d'aide, une seule fois par écran : chacun dans la première carte, dans
 * l'ordre d'affichage des groupes, dont le titre le cite (mot entier, casse exacte). Clé : identifiant de l'aide.
 */
export function siglesDesTitres(groupes: readonly GroupeAides[]): Map<string, Record<string, string>> {
  const resultat = new Map<string, Record<string, string>>();
  const cartes = groupes.flatMap((g) => g.aides);
  for (const sigle of SIGLES_DES_TITRES) {
    const premiere = cartes.find((a) => citeLeSigle(a.nom, sigle));
    if (premiere) resultat.set(premiere.id, { ...resultat.get(premiere.id), [sigle]: SIGLES[sigle] });
  }
  return resultat;
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

interface SourcesDeLAide {
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

/** Nombre de lignes d'une carte du plan (une carte vide n'est pas rendue ; les rappels du bandeau les comptent). */
export function nombreDeLignes(plan: PlanFinancement, carte: CartePlan): number {
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

// Encadrés du bandeau (aucun financement chiffré, fonds épuisés) : lib/encadres-resultats.ts.

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

/**
 * Chapeau de la section « Détail de l'estimation OPCO » : il annonce le calcul poste par poste, donc seulement quand le
 * tableau des postes s'affiche (ni plan fermé aux entreprises de 50 salariés et plus, ni aucune ligne affichable) ; il dit
 * où figurent les salaires et le transport quand l'OPCO les finance (aides versées à l'employeur dans le plan).
 */
export function chapeauDetailOpco(result: Pick<FundingResult, 'pdcFerme' | 'lines'>): string | null {
  if (result.pdcFerme || lignesDuDetail(result).length === 0) return null;
  const postesHorsFormation = result.lines.some(
    (l) => (l.poste === 'salaires' || l.poste === 'transport') && l.fundedAmount > 0,
  );
  return postesHorsFormation
    ? "Le calcul de l'OPCO poste par poste. Le plan ci-dessus ne retient que les postes de la formation : salaires et transport y figurent parmi les aides versées à l'employeur."
    : "Le calcul de l'OPCO poste par poste, avec la règle et la source de chaque montant.";
}

// --- Options au choix ---------------------------------------------------------------------------------------------

/**
 * Fiabilité du montant d'une option au choix, comme sur les lignes du plan : celle de l'aide du catalogue qui porte son
 * identifiant, sinon celle du dispositif de l'OPCO (option « opco-<dispositif> » : Espace Formation d'AKTO, campusAtlas
 * d'ATLAS…). Null quand l'option n'a pas de montant à qualifier (montant selon dossier, nul) ou que sa source manque.
 */
export function confianceDOption(
  option: Pick<OptionPlan, 'id' | 'montantEstime'>,
  aides: readonly Pick<AideEvaluee, 'id' | 'confidence'>[],
  dispositifs: readonly Pick<DispositifEligible, 'id' | 'confidence'>[],
): Confidence | null {
  if (option.montantEstime == null || !(option.montantEstime > 0)) return null;
  const aide = aides.find((a) => a.id === option.id);
  if (aide) return aide.confidence;
  return dispositifs.find((d) => `opco-${d.id}` === option.id)?.confidence ?? null;
}

// --- Listes de conventions collectives ----------------------------------------------------------------------------

type MorceauIdcc = { genre: 'texte'; valeur: string } | { genre: 'idcc'; codes: string[] };

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

// --- Note sur l'OPCO ----------------------------------------------------------------------------------------------

/**
 * Titre de la note posée sous le bandeau quand le plan ne compte pas le plan de développement des compétences de l'OPCO
 * (`NoteOpco`), ou null sans note :
 * - projet du dirigeant : ce plan finance la formation des salariés, il n'est pas calculé pour ce projet ; sans OPCO
 *   (la saisie manuelle ne propose au dirigeant que la région et la taille), le titre le dit sans laisser croire à un
 *   oubli ;
 * - projet salarié (former, reconvertir ; projet non choisi compris) sans OPCO : « Aucun OPCO renseigné », avec le
 *   retour à l'étape Entreprise ;
 * - autres projets (alternance, recrutement) : ils passent par les aides, aucune note.
 */
export function titreNoteOpco(projet: WizardState['projetType'], sansOpco: boolean): string | null {
  if (projet === 'formation_dirigeant') {
    return sansOpco ? 'Pas de calcul du plan de développement des compétences pour ce projet' : 'OPCO non compté pour un dirigeant';
  }
  return sansOpco && ouvreBudgetOpco(projet) ? 'Aucun OPCO renseigné' : null;
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

// --- Groupe de plusieurs personnes --------------------------------------------------------------------------------

export interface NoteOpco {
  genre: 'dirigeant' | 'sans-opco';
  titre: string;
}

/**
 * Notes posées sous le bandeau quand le plan ne compte pas le plan de développement des compétences de l'OPCO, pour les
 * projets du groupe (`projets` : celui de chaque profil). Un seul projet distinct : la note d'une personne seule
 * (`titreNoteOpco`). Plusieurs : chaque note qui s'applique, une fois (« Aucun OPCO renseigné » quand un projet salarié est
 * sans OPCO, « OPCO non compté pour le dirigeant du groupe » quand il y a un dirigeant).
 */
export function notesOpco(projets: readonly WizardState['projetType'][], sansOpco: boolean): NoteOpco[] {
  const distincts = [...new Set(projets)];
  if (distincts.length <= 1) {
    const projet = distincts[0] ?? null;
    const titre = titreNoteOpco(projet, sansOpco);
    return titre == null ? [] : [{ genre: projet === 'formation_dirigeant' ? 'dirigeant' : 'sans-opco', titre }];
  }
  const notes: NoteOpco[] = [];
  if (sansOpco && distincts.some((p) => ouvreBudgetOpco(p))) notes.push({ genre: 'sans-opco', titre: 'Aucun OPCO renseigné' });
  if (distincts.includes('formation_dirigeant')) {
    notes.push({ genre: 'dirigeant', titre: 'OPCO non compté pour le dirigeant du groupe' });
  }
  return notes;
}

/**
 * Détails sous les chiffres du bandeau pour un groupe : « 4 × 2 800 € » sous le coût quand il se divise au centime (sinon
 * « 333,33 € par personne en moyenne » : 3 × 333,33 € ne ferait pas 1 000 €), « 1 706,25 € par personne en moyenne » sous le
 * reste à charge. Rien pour une personne seule ni pour un coût inconnu ; rien non plus pour une moyenne qui s'arrondit à zéro
 * (0,01 € de reste à charge pour 3 personnes ne s'écrit pas « 0 € par personne en moyenne »), donc pas de moyenne sans reste
 * à charge.
 */
export function detailsDuBandeau(
  plan: Pick<PlanFinancement, 'coutFormation' | 'resteACharge'>,
  personnes: number,
): { cout: string | null; reste: string | null } {
  if (personnes < 2 || !(plan.coutFormation > 0)) return { cout: null, reste: null };
  const parPersonne = Math.round((plan.coutFormation / personnes) * 100) / 100;
  const resteMoyen = Math.round((plan.resteACharge / personnes) * 100) / 100;
  const exact = Math.round(parPersonne * personnes * 100) === Math.round(plan.coutFormation * 100);
  const cout = exact
    ? `${personnes}${INSECABLE}×${INSECABLE}${formatEuro(parPersonne)}`
    : `${formatEuro(parPersonne)} par personne en moyenne`;
  return {
    cout: parPersonne > 0 ? cout : null,
    reste: resteMoyen > 0 ? `${formatEuro(resteMoyen)} par personne en moyenne` : null,
  };
}

/** « pour 3 personnes » (espace insécable entre le nombre et l'unité) : sous le nom du financeur d'une ligne du plan d'un groupe. */
export function pourPersonnes(n: number): string {
  return `pour ${nombreEtUnite(n, n > 1 ? 'personnes' : 'personne')}`;
}

/**
 * Mention du détail de l'estimation de l'OPCO pour un groupe : pour qui le calcul est fait. Null pour une personne seule ou
 * quand aucune personne ne relève de ce plan.
 */
export function mentionOpcoDuGroupe(personnesPdc: number, personnes: number): string | null {
  if (personnes < 2 || personnesPdc < 1) return null;
  if (personnesPdc === personnes) return `Calcul pour les ${nombreEtUnite(personnes, 'personnes')} du groupe.`;
  const qui = personnesPdc === 1 ? 'le salarié' : `les ${nombreEtUnite(personnesPdc, 'salariés')}`;
  return `Calcul pour ${qui} du groupe (${nombreEtUnite(personnes, 'personnes')} au total).`;
}

/** Une ligne du tableau « Détail par profil » : le rang du profil, son libellé, son effectif et ses trois montants. */
export interface LigneParProfil {
  id: string;
  rang: number;
  libelle: string;
  nombre: number;
  cout: number;
  finance: number;
  reste: number;
}

/** Lignes du tableau « Détail par profil » (chiffres du plan de chaque profil, jamais recalculés) et leur total en centimes. */
export function lignesParProfil(blocs: readonly Pick<BlocResultat, 'profil' | 'plan'>[]): {
  lignes: LigneParProfil[];
  total: Pick<LigneParProfil, 'nombre' | 'cout' | 'finance' | 'reste'>;
} {
  const lignes = blocs.map((b, i) => ({
    id: b.profil.id,
    rang: i + 1,
    libelle: libelleDuProfil(b.profil.champs),
    nombre: b.profil.nombre,
    cout: b.plan.coutFormation,
    finance: b.plan.totalFinance,
    reste: b.plan.resteACharge,
  }));
  const somme = (champ: 'cout' | 'finance' | 'reste') => lignes.reduce((s, l) => s + Math.round(l[champ] * 100), 0) / 100;
  return {
    lignes,
    total: { nombre: lignes.reduce((s, l) => s + l.nombre, 0), cout: somme('cout'), finance: somme('finance'), reste: somme('reste') },
  };
}

/** « Profil 1 · Salarié en CDI, 35 ans » pour chaque profil, par identifiant. */
export function libellesDesProfils(profils: readonly ProfilDuGroupe[]): Map<string, string> {
  return new Map(profils.map((p, i) => [p.id, `Profil ${i + 1} · ${libelleDuProfil(p.champs)}`]));
}

/**
 * Lignes du bloc « Concerne » d'une carte d'aide d'un groupe, une par profil éligible ou à vérifier :
 * « Profil 1 · Salarié en CDI, 35 ans, 3 personnes : éligible ». Vide pour une aide sans `profils`.
 */
export function concerneParAide(aide: Pick<AideEvaluee, 'profils'>, libelles: ReadonlyMap<string, string>): string[] {
  return (aide.profils ?? []).map(
    (p) =>
      `${libelles.get(p.profilId) ?? p.profilId}, ${nombreEtUnite(p.nombre, p.nombre > 1 ? 'personnes' : 'personne')}${INSECABLE}: ${
        p.statut === 'eligible' ? 'éligible' : 'à vérifier'
      }`,
  );
}

/**
 * Lignes du bloc « Concerne » d'une carte d'aide d'un groupe de `nombreDeProfils` profils : vides quand l'aide vaut, au
 * statut qu'affiche la carte, pour tous les profils (rien à préciser) ; sinon une ligne par profil concerné
 * (`concerneParAide`).
 */
export function concerneAAfficher(
  aide: Pick<AideEvaluee, 'profils' | 'statut'>,
  nombreDeProfils: number,
  libelles: ReadonlyMap<string, string>,
): string[] {
  const profils = aide.profils ?? [];
  const partout = profils.length === nombreDeProfils && profils.every((p) => p.statut === aide.statut);
  return profils.length === 0 || partout ? [] : concerneParAide(aide, libelles);
}
