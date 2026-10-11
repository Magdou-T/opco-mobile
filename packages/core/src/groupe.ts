// ============================================================
// Plusieurs personnes formées en même temps : profils du groupe, effectif, état d'une personne d'un profil.
// Fonctions pures : aucune E/S, aucune lecture de l'horloge. La répartition du résultat de l'OPCO, le plan d'un profil et
// la fusion des résultats des profils sont dans le même fichier.
// ============================================================

import { MAX_PERSONNES } from './types';
import type { ChampsProfil, WizardState } from './types';

/** Identifiant du profil principal (les champs de l'étape « Participants » de l'état). */
export const ID_PROFIL_PRINCIPAL = 'principal';

/** Un profil du groupe : son identifiant, le nombre de personnes qui l'ont et ses réponses. */
export interface ProfilDuGroupe {
  id: string;
  nombre: number;
  champs: ChampsProfil;
  principal: boolean;
}

/** Effectif ramené à un entier de 1 à MAX_PERSONNES (valeur absente, périmée ou non finie : 1). */
function effectifValide(valeur: unknown): number {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? Math.min(MAX_PERSONNES, Math.max(1, Math.floor(valeur))) : 1;
}

/** Les réponses du profil principal : les champs de l'étape « Participants » de l'état, projet compris. */
export function champsDuProfilPrincipal(state: WizardState): ChampsProfil {
  return {
    projetType: state.projetType,
    contractType: state.contractType,
    anciennete_mois: state.anciennete_mois,
    isHandicap: state.isHandicap,
    ageBeneficiaire: state.ageBeneficiaire,
    niveauDiplome: state.niveauDiplome,
    typeAlternance: state.typeAlternance,
    inscritFranceTravail: state.inscritFranceTravail,
    statutDirigeant: state.statutDirigeant,
    microEntrepreneur: state.microEntrepreneur,
    soldeCpf: state.soldeCpf,
    regionBeneficiaireCode: state.regionBeneficiaireCode,
  };
}

/**
 * Profils du groupe : le profil principal d'abord, puis les profils supplémentaires dans l'ordre de saisie. Les effectifs
 * sont ramenés à un entier de 1 à MAX_PERSONNES. Un projet non choisi reste `null` ici : l'appelant le lit comme
 * « former un salarié », comme pour une personne seule.
 */
export function profilsDuGroupe(state: WizardState): ProfilDuGroupe[] {
  const principal: ProfilDuGroupe = {
    id: ID_PROFIL_PRINCIPAL,
    nombre: effectifValide(state.nombrePersonnes),
    champs: champsDuProfilPrincipal(state),
    principal: true,
  };
  const autres = (state.autresProfils ?? []).map(
    ({ id, nombre, ...champs }): ProfilDuGroupe => ({ id, nombre: effectifValide(nombre), champs, principal: false }),
  );
  return [principal, ...autres];
}

/** Nombre de personnes du groupe : la somme des effectifs de tous les profils. */
export function nombreDePersonnes(state: Pick<WizardState, 'nombrePersonnes' | 'autresProfils'>): number {
  return (state.autresProfils ?? []).reduce((somme, p) => somme + effectifValide(p.nombre), effectifValide(state.nombrePersonnes));
}

/**
 * L'état d'UNE personne de ce profil : l'entreprise, la formation et les frais de l'état, les réponses du bénéficiaire
 * remplacées par celles du profil (les deux drapeaux de l'application mobile, `isReconversion` et `isSortieChomage`, que le
 * site ne pose pas, gardent la valeur de l'état). Aucun groupe ni prix de groupe : c'est ce que lisent `profilDepuisWizard`
 * et le moteur.
 */
export function etatDuProfil(state: WizardState, profil: ProfilDuGroupe): WizardState {
  return { ...state, ...profil.champs, nombrePersonnes: 1, autresProfils: [], prixDuGroupe: null };
}
