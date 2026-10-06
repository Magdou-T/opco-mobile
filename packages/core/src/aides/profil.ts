// ============================================================
// Passage de l'état du parcours (WizardState) au profil évalué
// par le moteur d'aides, et utilitaires de dates.
// ============================================================

import { estCodeRegion } from '../geo';
import { STATUT_PAR_PROJET, type CompanySize, type WizardState } from '../types';
import type { ProfilAides } from './types';

const BORNES_TAILLE: Record<CompanySize, { min: number; max: number | null }> = {
  less_11: { min: 0, max: 10 },
  '11_49': { min: 11, max: 49 },
  '50_299': { min: 50, max: 299 },
  '300_plus': { min: 300, max: null },
};

/**
 * Bornes de l'effectif : exact s'il est saisi, sinon celles de la tranche choisie (copie, jamais l'objet partagé).
 * Une tranche inconnue (valeur périmée venue du stockage) est traitée comme absente.
 */
export function bornesEffectif(
  effectif: number | null,
  taille: CompanySize | null,
): { min: number | null; max: number | null } {
  if (effectif != null && effectif >= 0) return { min: effectif, max: effectif };
  // Propriétés propres seulement : un nom hérité d'Object (« constructor ») n'est pas une tranche.
  if (taille && Object.prototype.hasOwnProperty.call(BORNES_TAILLE, taille)) return { ...BORNES_TAILLE[taille] };
  return { min: null, max: null };
}

/**
 * Projet par défaut : « former un salarié » ; `structures` connues seulement après une recherche d'entreprise (SIREN renseigné), sinon `null`.
 * `idccs` : IDCC des établissements + IDCC détecté, sans doublon.
 * Un champ inconnu du parcours reste `null` (jamais remplacé par 0, `''` ou `false`), sauf `rqth` et `coutFraisAnnexes`, non nuls par construction.
 */
export function profilDepuisWizard(state: WizardState, opcoSlug: string | null): ProfilAides {
  const projet = state.projetType ?? 'formation_salarie';
  const { min, max } = bornesEffectif(state.effectif, state.companySize);
  const idccs = [...state.idccEtablissements];
  if (state.detectedIdcc && !idccs.includes(state.detectedIdcc)) idccs.push(state.detectedIdcc);

  const jours = state.trainingDays ?? (state.durationHours ? Math.ceil(state.durationHours / 7) : 0);
  const hebergement = state.needsAccommodation
    ? (state.accommodationCostPerNight ?? 0) * (state.accommodationNights ?? 0)
    : 0;
  const repas = state.needsMeals ? (state.mealCostPerDay ?? 0) * jours : 0;

  return {
    projet,
    statutBeneficiaire: STATUT_PAR_PROJET[projet],
    regionEntreprise: estCodeRegion(state.regionCode) ? state.regionCode : null,
    departementEntreprise: state.departementCode,
    regionBeneficiaire: estCodeRegion(state.regionBeneficiaireCode) ? state.regionBeneficiaireCode : null,
    effectifMin: min,
    effectifMax: max,
    codeNaf: state.codeNaf,
    idccs,
    opco: opcoSlug,
    structures: state.sirenNumber ? [...state.structures] : null,
    age: state.ageBeneficiaire,
    rqth: state.isHandicap,
    niveauDiplome: state.niveauDiplome,
    contrat: projet === 'alternance' ? 'alternance' : state.contractType,
    typeAlternance: state.typeAlternance,
    ancienneteMois: state.anciennete_mois,
    inscritFranceTravail: state.inscritFranceTravail,
    statutDirigeant: state.statutDirigeant,
    microEntrepreneur: state.microEntrepreneur,
    certification: state.certificationLevel,
    niveauFormationVise: state.niveauFormationVise,
    eligibleCpf: state.eligibleCpf,
    dureeHeures: state.durationHours,
    coutPedagogique: state.pedagogyCostTotal,
    coutFraisAnnexes: Math.round((hebergement + repas) * 100) / 100,
    qualiopi: state.organismeQualiopi,
    soldeCpf: state.soldeCpf,
  };
}

/** « MM/AAAA » → « AAAA-MM » (null si invalide). */
export function moisDepuisSaisie(texte: string): string | null {
  const m = /^(\d{1,2})\/(\d{4})$/.exec(texte.trim());
  if (!m) return null;
  const mois = Number(m[1]);
  if (mois < 1 || mois > 12) return null;
  return `${m[2]}-${String(mois).padStart(2, '0')}`;
}

/** « AAAA-MM » → « MM/AAAA » ; toute autre valeur (absente ou mal formée) donne une saisie vide. */
export function saisieDepuisMois(mois: string | null): string {
  const m = mois ? /^(\d{4})-(\d{2})$/.exec(mois) : null;
  return m ? `${m[2]}/${m[1]}` : '';
}

/**
 * Date utilisée pour vérifier la validité des aides : début de formation s'il est futur, sinon aujourd'hui.
 * `aujourdhui` est une date `AAAA-MM-JJ` (pas un horodatage complet) ; un début qui n'est pas de la forme `AAAA-MM` (mois de 01 à 12) est ignoré.
 */
export function dateDeReference(debutFormation: string | null, aujourdhui: string): string {
  if (!debutFormation || !/^\d{4}-(0[1-9]|1[0-2])$/.test(debutFormation)) return aujourdhui;
  const debut = `${debutFormation}-01`;
  return debut > aujourdhui ? debut : aujourdhui;
}
