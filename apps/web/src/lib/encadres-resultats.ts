// ============================================================
// Écran « Votre plan de financement » : encadrés du bandeau de synthèse, en fonctions pures (tests :
// tests/resultats.test.ts). Encadré quand aucun financement de la formation n'est chiffré (texte, liens vers les cartes du
// plan et vers les aides « à vérifier ») et fonds épuisés signalés par l'OPCO. Chaque phrase ne cite que ce que la page
// montre, sans rien nier de ce qu'elle montre. Les cartes du plan viennent de lib/resultats.ts.
// ============================================================

import type { AideEvaluee, AlerteOpco, PlanFinancement } from '@opco/core';
import { INSECABLE } from './format';
import { cartesDuPlan, nombreDeLignes } from './resultats';
import type { CartePlan } from './resultats';

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
 */
export function encadreSansFinancement(
  plan: PlanFinancement,
  aides: readonly AideEvaluee[],
  avecPortail: boolean,
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
    };
  }
  if (rappels.length > 0) {
    return {
      texte: joindre([
        selonDossier
          ? `Aucun financement de la formation n'est chiffrable à ce stade${INSECABLE}: les financeurs fixent le montant après étude du dossier. Voici les aides identifiées.`
          : `Aucun financement de la formation n'est chiffrable ${nonComptes ? 'à ce stade' : 'pour cette situation'}. Voici les aides identifiées, qui ne réduisent pas le prix de la formation.`,
        nonComptes,
      ]),
      rappels,
      aidesAVerifier: nonComptes ? lien() : null,
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
