// ============================================================
// Écran « Votre plan de financement » : encadrés du bandeau de synthèse, en fonctions pures (tests :
// tests/resultats.test.ts). Plan de développement des compétences fermé aux entreprises de 50 salariés et plus (sa
// raison, dans le bandeau), encadré quand aucun financement de la formation n'est chiffré (texte, liens vers les cartes
// du plan, vers les aides « à vérifier » et vers le détail de l'OPCO) et fonds épuisés signalés par l'OPCO. Chaque phrase
// ne cite que ce que la page montre, sans rien nier de ce qu'elle montre. Les cartes du plan viennent de lib/resultats.ts.
// ============================================================

import type { AideEvaluee, AlerteOpco, FundingResult, PlanFinancement } from '@opco/core';
import { de } from './format';
import { INSECABLE } from './insecable';
import { cartesDuPlan, nombreDeLignes } from './resultats';
import type { CartePlan, EtatEnTete } from './resultats';

// --- Plan de développement des compétences fermé (50 salariés et plus) ---------------------------------------------

/**
 * Plan de développement des compétences de l'OPCO fermé à l'entreprise (`pdcFerme` du moteur : 50 salariés et plus, et
 * le barème appliqué ne publie aucune enveloppe pour sa taille) : l'OPCO et la branche du barème appliqué.
 */
export interface PlanFerme {
  opco: string;
  /** Branche dont le barème est appliqué ; null : barème général de l'OPCO. */
  branche: string | null;
}

/** Plan fermé d'un calcul de l'OPCO, ou null (aucun calcul de l'OPCO, ou plan ouvert). */
export function planFermeDe(
  funding: Pick<FundingResult, 'pdcFerme' | 'opcoName' | 'brancheAppliquee'> | null | undefined,
): PlanFerme | null {
  return funding?.pdcFerme ? { opco: funding.opcoName, branche: funding.brancheAppliquee } : null;
}

/** Titre de la section « Détail de l'estimation OPCO » : le bandeau y renvoie, la raison y est détaillée. */
export const ID_DETAIL_OPCO = 'titre-detail-opco';

/**
 * Raison du plan fermé, dite dans le bandeau et pas seulement dans le détail de l'OPCO, plus bas : sans elle, « les
 * financeurs fixent le montant après étude du dossier » laissait croire que l'OPCO déciderait sur ce plan.
 */
export function raisonPlanFerme(p: PlanFerme): string {
  const bareme = p.branche ? `le barème de la branche «${INSECABLE}${p.branche}${INSECABLE}»` : `le barème général ${de(p.opco)}`;
  return (
    `Votre entreprise compte 50 salariés ou plus${INSECABLE}: les fonds mutualisés du plan de développement des ` +
    `compétences ${de(p.opco)} ne lui sont pas ouverts, et ${bareme} ne prévoit pas d'enveloppe pour sa taille.`
  );
}

/** Encadré du plan fermé : titre et texte (la raison) ; le bandeau y ajoute le lien vers le détail de l'OPCO. */
export interface EncadrePlanFerme {
  titre: string;
  texte: string;
}

/**
 * Encadré du plan fermé dans le bandeau quand des chiffres l'occupent (plan chiffré par d'autres financeurs, coût
 * inconnu). Sans financement chiffré, la raison ouvre l'encadré sans financement (`encadreSansFinancement`) : pas de
 * second encadré. Null quand le plan n'est pas fermé.
 */
export function encadrePlanFerme(etat: EtatEnTete, planFerme: PlanFerme | null): EncadrePlanFerme | null {
  if (!planFerme || etat === 'aucun_financement_chiffre') return null;
  return {
    titre: `Aucune prise en charge estimée sur le plan de développement des compétences ${de(planFerme.opco)}`,
    texte: raisonPlanFerme(planFerme),
  };
}

// --- Rappels vers les cartes du plan ------------------------------------------------------------------------------

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

// --- Encadré sans financement chiffré -----------------------------------------------------------------------------

/** Lien du bandeau vers la liste des aides (`ID_SECTION_AIDES`) quand l'encadré cite des aides « à vérifier ». */
export interface LienAidesAVerifier {
  /** Aides « à vérifier » de la liste, chiffrées ou non. */
  nombre: number;
  libelle: string;
}

/** Encadré du bandeau quand aucun financement de la formation n'est chiffré : texte et liens vers les cartes et les aides. */
export interface EncadreSansFinancement {
  texte: string;
  rappels: Rappel[];
  /** Aides « à vérifier » citées par le texte : lien vers la section des aides ; null quand le texte n'en cite aucune. */
  aidesAVerifier: LienAidesAVerifier | null;
  /** Le texte dit pourquoi le plan de l'OPCO est fermé : lien vers le détail de l'OPCO (`ID_DETAIL_OPCO`). */
  detailOpco: boolean;
}

/** Section « Aides et financements identifiés » (`AidesList`) : cible du lien vers les aides à vérifier. */
export const ID_SECTION_AIDES = 'aides-identifiees';

const joindre = (phrases: readonly (string | null)[]): string => phrases.filter((p): p is string => p != null).join(' ');

/**
 * Encadré du bandeau quand aucun financement de la formation n'est chiffré (`aucun_financement_chiffre`). Il ne cite que
 * ce que la page montre plus bas, cartes du plan et liste des aides (`aides` : les aides évaluées ; la liste montre les
 * éligibles et les « à vérifier »), sans rien nier de ce qu'elle montre :
 * - des options au choix chiffrées : elles ont un montant, à comparer ; « les autres financeurs fixent le montant après
 *   étude du dossier » seulement si une aide ou une option est au montant selon dossier ;
 * - sinon des aides identifiées (montant selon dossier, aides versées à l'employeur, revenus et aides à la personne) :
 *   « Voici les aides identifiées », avec les liens vers leurs cartes (`rappels`) ; l'étude du dossier n'est citée que
 *   pour des aides au montant selon dossier, sinon le texte dit qu'elles ne réduisent pas le prix de la formation ;
 * - sinon ni option chiffrée ni carte d'aides : « aucune autre aide à montant n'a été identifiée » seulement si la liste
 *   ne montre ni aide « à vérifier » ni montant, « Seuls des services gratuits sont proposés ci-dessous » seulement si
 *   toute carte et toute aide de la liste sont des services gratuits ; renvoi à l'OPCO ou au fonds d'assurance formation
 *   et aux portails de la région quand ils existent (`avecPortail`).
 * Des aides « à vérifier » listées avec un montant ne sont jamais tues : le texte dit que leur montant n'est pas compté
 * (une information manque ou le financeur doit confirmer), dit « à ce stade » plutôt que « pour cette situation », et le
 * bandeau renvoie à la liste (`aidesAVerifier`). Dans le dernier cas, des aides « à vérifier » sans montant sont citées
 * de même.
 * Plan de développement des compétences de l'OPCO fermé (`planFerme`) : cette variante précède les autres. Sa raison
 * ouvre le texte, les montants selon dossier sont ceux « des autres financeurs », les autres phrases restent, et le
 * bandeau renvoie au détail de l'OPCO (`detailOpco`).
 */
export function encadreSansFinancement(
  plan: PlanFinancement,
  aides: readonly AideEvaluee[],
  avecPortail: boolean,
  planFerme: PlanFerme | null = null,
): EncadreSansFinancement {
  const encadre = encadreSelonLesAides(plan, aides, avecPortail, planFerme != null);
  if (!planFerme) return encadre;
  return { ...encadre, texte: joindre([raisonPlanFerme(planFerme), encadre.texte]), detailOpco: true };
}

/** Encadré sans financement chiffré, d'après les cartes et les aides ; `autres` : l'OPCO ne fixe rien, les montants selon dossier sont ceux des autres financeurs. */
function encadreSelonLesAides(
  plan: PlanFinancement,
  aides: readonly AideEvaluee[],
  avecPortail: boolean,
  autres: boolean,
): EncadreSansFinancement {
  const rappels = rappelsAucunFinancement(plan);
  const optionsChiffrees = plan.options.some((o) => o.montantEstime != null && o.montantEstime > 0);
  const selonDossier = plan.nonChiffrees.length > 0 || plan.options.some((o) => o.montantEstime == null);
  // Liste « Aides et financements identifiés » (groupesAidesVisibles) : éligibles et « à vérifier ».
  const listees = aides.filter((a) => a.statut !== 'non_eligible');
  const aVerifier = listees.filter((a) => a.statut === 'a_verifier');
  const chiffrees = aVerifier.filter((a) => a.montantEstime != null && a.montantEstime > 0).length;
  const lien = (): LienAidesAVerifier => ({
    nombre: aVerifier.length,
    libelle: `${aVerifier.length} ${aVerifier.length > 1 ? 'aides' : 'aide'} à vérifier`,
  });
  const nonComptes =
    chiffrees === 0
      ? null
      : chiffrees === 1
        ? `Le montant d'une aide «${INSECABLE}à vérifier${INSECABLE}» listée plus bas n'est pas compté dans le plan${INSECABLE}: une information manque ou le financeur doit confirmer.`
        : `Les montants des aides «${INSECABLE}à vérifier${INSECABLE}» listées plus bas ne sont pas comptés dans le plan${INSECABLE}: une information manque ou le financeur doit confirmer.`;

  if (optionsChiffrees) {
    const suite = selonDossier ? ', et les autres financeurs fixent le montant après étude du dossier' : '';
    return {
      texte: joindre([
        `Aucun financement cumulable n'est chiffré pour cette formation${INSECABLE}: les options au choix ont un montant, à comparer${suite}.`,
        nonComptes,
      ]),
      rappels,
      aidesAVerifier: nonComptes ? lien() : null,
      detailOpco: false,
    };
  }
  if (rappels.length > 0) {
    const financeurs = autres ? 'les autres financeurs' : 'les financeurs';
    return {
      texte: joindre([
        selonDossier
          ? `Aucun financement de la formation n'est chiffrable à ce stade${INSECABLE}: ${financeurs} fixent le montant après étude du dossier. Voici les aides identifiées.`
          : `Aucun financement de la formation n'est chiffrable ${nonComptes ? 'à ce stade' : 'pour cette situation'}. Voici les aides identifiées, qui ne réduisent pas le prix de la formation.`,
        nonComptes,
      ]),
      rappels,
      aidesAVerifier: nonComptes ? lien() : null,
      detailOpco: false,
    };
  }
  const aideAMontant = listees.some((a) => a.montantEstime != null && a.montantEstime > 0);
  const cartes = cartesDuPlan(plan);
  const servicesSeuls =
    cartes.length > 0 && cartes.every((c) => c === 'services') && listees.every((a) => a.categorie === 'service_gratuit');
  const sansMontant =
    aVerifier.length === 0
      ? null
      : aVerifier.length === 1
        ? `Une aide «${INSECABLE}à vérifier${INSECABLE}» est listée plus bas${INSECABLE}: une information manque ou le financeur doit confirmer.`
        : `Des aides «${INSECABLE}à vérifier${INSECABLE}» sont listées plus bas${INSECABLE}: une information manque ou le financeur doit confirmer.`;
  return {
    texte: joindre([
      aVerifier.length === 0 && !aideAMontant
        ? "Aucun financement de la formation n'est chiffrable et aucune autre aide à montant n'a été identifiée pour cette situation."
        : "Aucun financement de la formation n'est chiffrable à ce stade.",
      nonComptes ?? sansMontant,
      servicesSeuls ? 'Seuls des services gratuits sont proposés ci-dessous.' : null,
      `Interrogez l'OPCO ou le fonds d'assurance formation compétent${avecPortail ? ', et consultez les portails officiels de la région en bas de page' : ''}.`,
    ]),
    rappels,
    aidesAVerifier: aVerifier.length > 0 ? lien() : null,
    detailOpco: false,
  };
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
