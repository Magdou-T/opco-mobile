// ============================================================
// Cohérence de l'état du parcours quand le projet ou le mode de formation change, et plafond horaire indicatif de la
// formation. Fonctions pures : ni React ni effet de bord.
//
// profilDepuisWizard (@opco/core) lit toutes les réponses de l'état, quel que soit le projet : une réponse donnée pour
// un autre projet (type d'alternance, statut de dirigeant...) ne doit donc pas survivre au changement de projet.
// ============================================================

import { STATUT_PAR_PROJET, applyVarianteBranche, createInitialWizardState, resolveVarianteBranche } from '@opco/core';
import type { OpcoData, ProjetType, StatutBeneficiaire, TrainingMode, TrainingType, WizardState } from '@opco/core';

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
 * contrat ; un salarié ne garde jamais « alternance ».
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
  return maj;
}

/**
 * Mise à jour quand l'utilisateur choisit le mode de formation. Une formation entièrement à distance saute l'étape
 * « Frais » : les besoins de déplacement, d'hébergement et de repas déjà cochés sont alors décochés (le moteur les
 * compterait sans que l'utilisateur puisse les voir). Les montants saisis restent, pour un retour au présentiel.
 */
export function etatDepuisModeFormation(mode: TrainingMode): Partial<WizardState> {
  return mode === 'distance'
    ? { trainingMode: mode, needsTransport: false, needsAccommodation: false, needsMeals: false }
    : { trainingMode: mode };
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
