// ============================================================
// Cohérence de l'état du parcours quand le projet ou le mode de formation change, et plafond horaire indicatif de la
// formation. Fonctions pures : ni React ni effet de bord.
//
// profilDepuisWizard et calculateFunding (@opco/core) lisent toutes les réponses de l'état, quel que soit le projet : un
// champ que l'écran ne montre plus (question d'un autre statut, budget déjà consommé d'un projet salarié, jours de
// l'étape Frais sautée) ne doit donc pas survivre au changement qui l'a masqué. Audit et test :
// tests/parcours.test.ts (« aucun champ invisible ne pèse sur le résultat »).
// ============================================================

import { STATUT_PAR_PROJET, applyVarianteBranche, createInitialWizardState, resolveVarianteBranche } from '@opco/core';
import type { OpcoData, ProjetType, StatutBeneficiaire, TrainingMode, TrainingType, WizardState } from '@opco/core';
import { ouvreBudgetOpco } from './entreprise';

/** Questions de l'étape « Bénéficiaire » propres à un statut (le contrat d'un alternant découle de son type de contrat). */
export const QUESTIONS_PAR_STATUT: Record<StatutBeneficiaire, readonly (keyof WizardState)[]> = {
  salarie: ['contractType', 'anciennete_mois', 'soldeCpf'],
  demandeur_emploi: ['inscritFranceTravail', 'regionBeneficiaireCode'],
  alternant: ['typeAlternance', 'contractType', 'inscritFranceTravail', 'regionBeneficiaireCode'],
  dirigeant: ['statutDirigeant', 'microEntrepreneur', 'soldeCpf'],
};

/** Questions posées à tout bénéficiaire, gardées quel que soit le projet. */
export const QUESTIONS_COMMUNES: readonly (keyof WizardState)[] = ['ageBeneficiaire', 'niveauDiplome', 'isHandicap'];

const QUESTIONS_PROPRES = [...new Set(Object.values(QUESTIONS_PAR_STATUT).flat())];

/**
 * Mise à jour quand l'utilisateur choisit un projet. Les réponses aux questions propres à un autre statut reviennent à
 * leur valeur initiale ; les questions communes (âge, diplôme, RQTH) et celles du nouveau statut sont gardées. Le type de
 * contrat suit le statut : « alternance » n'existe que pour l'alternant, qui l'obtient en choisissant son type de
 * contrat ; un salarié ne garde jamais « alternance ». Le budget déjà consommé auprès de l'OPCO, que l'étape Entreprise
 * ne montre qu'aux projets qui ouvrent ce budget (`ouvreBudgetOpco`), revient à vide pour les autres.
 */
export function etatDepuisProjet(state: WizardState, projet: ProjetType): Partial<WizardState> {
  const statut = STATUT_PAR_PROJET[projet];
  const gardees = new Set(QUESTIONS_PAR_STATUT[statut]);
  const initial = createInitialWizardState();
  const maj: Partial<WizardState> = { projetType: projet };
  const remettre = <K extends keyof WizardState>(champ: K) => {
    maj[champ] = initial[champ];
  };
  for (const champ of QUESTIONS_PROPRES) if (!gardees.has(champ)) remettre(champ);
  if (statut === 'alternant') maj.contractType = state.typeAlternance ? 'alternance' : null;
  else if (statut === 'salarie' && state.contractType === 'alternance') maj.contractType = null;
  if (!ouvreBudgetOpco(projet)) remettre('budgetDejaConsomme');
  return maj;
}

/**
 * Mise à jour quand l'utilisateur choisit le mode de formation. Une formation entièrement à distance saute l'étape
 * « Frais » : les besoins de déplacement, d'hébergement et de repas déjà cochés sont alors décochés et le nombre de
 * jours saisi revient à vide (le moteur les compterait sans que l'utilisateur puisse les voir ; sans saisie, il retient
 * 7 heures par jour). Les montants saisis restent, pour un retour au présentiel : ils ne comptent qu'avec leur besoin.
 */
export function etatDepuisModeFormation(mode: TrainingMode): Partial<WizardState> {
  return mode === 'distance'
    ? { trainingMode: mode, needsTransport: false, needsAccommodation: false, needsMeals: false, trainingDays: null }
    : { trainingMode: mode };
}

/**
 * Questions où « Je ne sais pas » (« Ne sait pas » pour une liste) est une réponse. La valeur reste null pour le moteur,
 * qui la lit comme inconnue ; le site retient à part que l'utilisateur l'a choisie, pour la montrer choisie quand l'étape
 * revient et l'écrire au récapitulatif au lieu de « Non renseigné ».
 */
export const QUESTIONS_AVEC_INCONNU = [
  'inscritFranceTravail',
  'microEntrepreneur',
  'eligibleCpf',
  'organismeQualiopi',
  'certificationLevel',
  'niveauFormationVise',
] as const satisfies readonly (keyof WizardState)[];
export type QuestionAvecInconnu = (typeof QUESTIONS_AVEC_INCONNU)[number];

/** Réponse à une question qui admet « Je ne sais pas » : `null` est cette réponse (voir `useWizard`). */
export type Repondre = <K extends QuestionAvecInconnu>(question: K, valeur: WizardState[K]) => void;

/**
 * Réponses « Je ne sais pas » retenues après une mise à jour de l'état `maj` : toute écriture d'une de ces questions
 * efface la sienne (nouvelle réponse, remise à vide par un changement de projet) ; `inconnue` l'ajoute (la valeur écrite
 * est alors null). Rend l'ensemble reçu, inchangé, quand rien ne change.
 */
export function reponsesInconnuesApres(
  avant: ReadonlySet<QuestionAvecInconnu>,
  maj: Partial<WizardState>,
  inconnue?: QuestionAvecInconnu,
): ReadonlySet<QuestionAvecInconnu> {
  const effacees = QUESTIONS_AVEC_INCONNU.filter((q) => q in maj && q !== inconnue && avant.has(q));
  if (effacees.length === 0 && (inconnue == null || avant.has(inconnue))) return avant;
  const apres = new Set(avant);
  for (const q of effacees) apres.delete(q);
  if (inconnue != null) apres.add(inconnue);
  return apres;
}

/**
 * Saisie de la durée ou du coût total : le coût horaire suit (null tant que l'un des deux manque). Il n'est jamais
 * arrondi : le moteur le multiplie par la durée, et 30,36 €/h (4 250 € sur 140 h arrondis au centime) donnaient
 * 4 250,40 € financés pour 4 250 € demandés. L'affichage l'arrondit (`formatEuro`).
 */
export function coutsDeFormation(
  total: number | null,
  heures: number | null,
): Pick<WizardState, 'pedagogyCostTotal' | 'durationHours' | 'pedagogyCostPerHour'> {
  const parHeure = total && heures && heures > 0 ? total / heures : null;
  return { pedagogyCostTotal: total, durationHours: heures, pedagogyCostPerHour: parHeure };
}

/**
 * Le coût horaire dépasse le plafond indicatif publié (un plafond de 0 signale une enveloppe épuisée, dite à part).
 * Comparaison au centime, comme l'affichage : 30,0036 €/h s'affiche 30 €/h et ne « dépasse » pas un plafond de 30 €/h.
 */
export function depassePlafondHoraire(coutHoraire: number | null, plafond: number | null): boolean {
  return (
    plafond != null && plafond > 0 && coutHoraire != null && Math.round(coutHoraire * 100) > Math.round(plafond * 100)
  );
}

/** Types de formation qui relèvent du plafond horaire des formations certifiantes (`cout_horaire_metier`). */
const TYPES_CERTIFIANTS: readonly TrainingType[] = ['cqp', 'certification', 'habilitation'];

/**
 * Plafond horaire indicatif (€/h) du barème appliqué : celui de la branche (choix manuel, sinon convention détectée),
 * à défaut le barème général de l'OPCO. `cout_horaire_metier` pour une formation certifiante (CQP, certification,
 * habilitation), sinon `cout_horaire_inter`, avec repli sur l'autre quand le premier n'a pas de valeur. Null quand
 * aucun plafond n'est publié ; 0 signale une enveloppe épuisée. Indicatif : le moteur applique les règles exactes
 * (barèmes dégressifs, plafonds par taille) à l'écran de résultats.
 */
export function plafondHoraireIndicatif(
  opco: OpcoData | null | undefined,
  state: Pick<WizardState, 'selectedBrancheId' | 'detectedIdcc' | 'formationType'>,
): number | null {
  if (!opco) return null;
  const variante = resolveVarianteBranche(opco, state);
  const bareme = variante ? applyVarianteBranche(opco, variante) : opco;
  const certifiant = state.formationType != null && TYPES_CERTIFIANTS.includes(state.formationType);
  const [premier, repli] = certifiant
    ? [bareme.cout_horaire_metier, bareme.cout_horaire_inter]
    : [bareme.cout_horaire_inter, bareme.cout_horaire_metier];
  return premier?.value ?? repli?.value ?? null;
}
