// ============================================================
// Étapes du simulateur du site. Le parcours est propre au site : l'app mobile garde le sien (WIZARD_STEPS dans
// @opco/core) et le moteur n'en impose aucun. Fonctions pures : ni React ni effet de bord.
// ============================================================

import { profilsDuGroupe } from '@opco/core';
import type { ChampsProfil, WizardState } from '@opco/core';
import { opcoRequisPourLeGroupe } from './groupe';

export type EtapeSite = 'projet' | 'identification' | 'situation' | 'formation' | 'frais' | 'recap';

/** Ordre du parcours et libellés de la barre de progression (le numéro affiché est la position dans cette liste). */
export const ETAPES: { key: EtapeSite; label: string }[] = [
  { key: 'projet', label: 'Projet' },
  { key: 'identification', label: 'Entreprise' },
  { key: 'situation', label: 'Participants' },
  { key: 'formation', label: 'Formation' },
  { key: 'frais', label: 'Frais' },
  { key: 'recap', label: 'Récapitulatif' },
];

/** L'étape « Frais » est sautée pour une formation entièrement à distance (ni déplacement, ni hébergement, ni repas). */
export function etapeSautee(etape: EtapeSite, state: Pick<WizardState, 'trainingMode'>): boolean {
  return etape === 'frais' && state.trainingMode === 'distance';
}

/** Position de l'étape qui suit `index`, en sautant l'étape sans objet ; la dernière étape reste la dernière. */
export function indexSuivant(index: number, state: Pick<WizardState, 'trainingMode'>): number {
  let suivant = Math.min(index + 1, ETAPES.length - 1);
  while (suivant < ETAPES.length - 1 && etapeSautee(ETAPES[suivant].key, state)) suivant++;
  return suivant;
}

/** Position de l'étape qui précède `index`, en sautant l'étape sans objet ; la première étape reste la première. */
export function indexPrecedent(index: number, state: Pick<WizardState, 'trainingMode'>): number {
  let precedent = Math.max(index - 1, 0);
  while (precedent > 0 && etapeSautee(ETAPES[precedent].key, state)) precedent--;
  return precedent;
}

/**
 * Ce qui manque à UN profil pour quitter l'étape Participants, dans l'ordre des champs à l'écran : salarié, le type de
 * contrat (et l'ancienneté pour une reconversion) ; demandeur d'emploi, l'inscription à France Travail ; alternance, le
 * type de contrat d'alternance et l'âge ; dirigeant, son statut. Un projet non choisi manque au profil.
 */
export function manquantsDuProfil(champs: ChampsProfil): string[] {
  const manquants: string[] = [];
  switch (champs.projetType) {
    case 'formation_salarie':
    case 'reconversion_salarie':
      // « Alternance » n'est pas un contrat proposé au salarié : un reste d'un autre projet ne compte pas.
      if (champs.contractType == null || champs.contractType === 'alternance') manquants.push('le type de contrat');
      if (champs.projetType === 'reconversion_salarie' && champs.anciennete_mois == null) manquants.push("l'ancienneté");
      break;
    case 'recrutement_demandeur_emploi':
      if (champs.inscritFranceTravail == null) manquants.push("l'inscription à France Travail");
      break;
    case 'alternance':
      if (champs.typeAlternance == null) manquants.push("le type de contrat d'alternance");
      if (champs.ageBeneficiaire == null) manquants.push("l'âge de l'alternant");
      break;
    case 'formation_dirigeant':
      if (champs.statutDirigeant == null) manquants.push('le statut du dirigeant');
      break;
    default:
      manquants.push('votre projet (étape 1)');
  }
  return manquants;
}

/**
 * Ce qui manque pour passer à l'étape suivante, dans l'ordre des champs à l'écran (vide : l'étape est complète).
 * Une seule source pour l'activation du bouton « Suivant » et pour le texte qui dit ce qui manque.
 * - Projet : le projet.
 * - Entreprise : l'OPCO (choisi ou détecté ; facultatif tant que tous les profils sont des dirigeants), la région, la taille.
 * - Participants : ce que `manquantsDuProfil` demande à chaque profil ; avec plusieurs profils, chaque manque nomme son
 *   profil (« le type de contrat (profil 2) »), avec un seul les textes restent ceux d'une personne seule.
 * - Formation : le type, le mode, la durée et le coût total (durée et coût supérieurs à zéro).
 * - Frais et récapitulatif : rien d'obligatoire.
 */
export function champsManquants(etape: EtapeSite, state: WizardState): string[] {
  const manquants: string[] = [];
  switch (etape) {
    case 'projet':
      if (state.projetType == null) manquants.push('votre projet');
      break;
    case 'identification':
      if (opcoRequisPourLeGroupe(state) && !(state.selectedOpcoSlug || state.detectedOpcoSlug)) manquants.push("l'OPCO");
      if (state.regionCode == null) manquants.push('la région');
      if (state.companySize == null) manquants.push("la taille de l'entreprise");
      break;
    case 'situation': {
      const profils = profilsDuGroupe(state);
      profils.forEach((profil, i) => {
        const manques = manquantsDuProfil(profil.champs);
        manquants.push(...(profils.length > 1 ? manques.map((m) => `${m} (profil ${i + 1})`) : manques));
      });
      break;
    }
    case 'formation':
      if (!state.formationType) manquants.push('le type de formation');
      if (!state.trainingMode) manquants.push('le mode de formation');
      if (!state.durationHours) manquants.push('la durée');
      if (!state.pedagogyCostTotal) manquants.push('le coût total');
      break;
    case 'frais':
    case 'recap':
      break;
  }
  return manquants;
}

/** Énumération à la française : « a », « a et b », « a, b et c ». */
export function enumeration(elements: string[]): string {
  if (elements.length <= 1) return elements.join('');
  return `${elements.slice(0, -1).join(', ')} et ${elements[elements.length - 1]}`;
}
