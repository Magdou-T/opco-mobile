// ============================================================
// État d'un groupe de personnes formées dans le parcours du site : nombre de personnes, profils supplémentaires, prix de
// la formation par personne ou pour le groupe, OPCO et budget du groupe. Fonctions pures (ni React ni effet de bord) ;
// `useWizard` applique `normaliserGroupe` après chaque mise à jour. Le calcul (@opco/core) ne lit que le coût d'UNE
// personne : `pedagogyCostTotal` ; le prix du groupe n'est qu'une saisie dont ce coût découle.
// ============================================================

import {
  ID_PROFIL_PRINCIPAL,
  MAX_PERSONNES,
  MAX_PROFILS,
  champsDuProfilPrincipal,
  createInitialWizardState,
  nombreDePersonnes,
  profilsDuGroupe,
} from '@opco/core';
import type { ChampsProfil, ProfilSupplementaire, ProjetType, WizardState } from '@opco/core';
import { opcoRequis, ouvreBudgetOpco } from './entreprise';
import { champsDepuisProjet, coutsDeFormation } from './parcours';

// --- Saisie du nombre de personnes --------------------------------------------------------------------------------

/**
 * Lit le nombre de personnes saisi : un entier de 1 à 99. Au-delà de 99, 99. Vide, zéro, négatif, décimal, texte ou
 * notation scientifique : null (la saisie est refusée, l'état garde sa valeur). Jamais NaN.
 */
export function lireEffectif(texte: string): number | null {
  const propre = texte.trim();
  if (!/^\d{1,4}$/.test(propre)) return null;
  const n = Number(propre);
  return n < 1 ? null : Math.min(n, MAX_PERSONNES);
}

// --- Cohérence de l'état ------------------------------------------------------------------------------------------

const borner = (n: number): number => (Number.isFinite(n) ? Math.min(MAX_PERSONNES, Math.max(1, Math.floor(n))) : 1);

/**
 * Ramène l'état d'un groupe à ses invariants : effectifs entiers de 1 à 99, au plus 5 profils supplémentaires, au plus 99
 * personnes (le surplus se retire du dernier profil, puis des précédents, puis du profil principal), prix du groupe vidé sous
 * deux personnes, coût d'une personne et coût horaire recalculés quand le prix du groupe est renseigné. Idempotente.
 */
export function normaliserGroupe(etat: WizardState): WizardState {
  const autres = etat.autresProfils.slice(0, MAX_PROFILS - 1).map((p) => ({ ...p, nombre: borner(p.nombre) }));
  let principal = borner(etat.nombrePersonnes);
  let exces = principal + autres.reduce((somme, p) => somme + p.nombre, 0) - MAX_PERSONNES;
  for (let i = autres.length - 1; i >= 0 && exces > 0; i--) {
    const retrait = Math.min(exces, autres[i].nombre - 1);
    autres[i] = { ...autres[i], nombre: autres[i].nombre - retrait };
    exces -= retrait;
  }
  if (exces > 0) principal -= exces;
  const personnes = principal + autres.reduce((somme, p) => somme + p.nombre, 0);
  let suite: WizardState = { ...etat, nombrePersonnes: principal, autresProfils: autres };
  if (personnes < 2) suite = { ...suite, prixDuGroupe: null };
  if (suite.prixDuGroupe != null) {
    suite = { ...suite, ...coutsDeFormation(suite.prixDuGroupe / personnes, suite.durationHours) };
  }
  return suite;
}

// --- Profils ------------------------------------------------------------------------------------------------------

/** Identifiant du prochain profil supplémentaire : le plus petit « profil-N » libre à partir de N = 2. */
export function prochainIdProfil(etat: WizardState): string {
  const pris = new Set(etat.autresProfils.map((p) => p.id));
  for (let n = 2; ; n++) if (!pris.has(`profil-${n}`)) return `profil-${n}`;
}

/** Un profil neuf : une personne, le projet du profil principal (« former un salarié » sans projet), aucune autre réponse. */
export function nouveauProfil(etat: WizardState): ProfilSupplementaire {
  const vides = champsDuProfilPrincipal(createInitialWizardState());
  return { ...vides, projetType: etat.projetType ?? 'formation_salarie', id: prochainIdProfil(etat), nombre: 1 };
}

/** Ajoute un profil neuf ; sans effet à 6 profils ou à 99 personnes. */
export function ajouterProfil(etat: WizardState): WizardState {
  if (etat.autresProfils.length >= MAX_PROFILS - 1 || nombreDePersonnes(etat) >= MAX_PERSONNES) return etat;
  return normaliserGroupe({ ...etat, autresProfils: [...etat.autresProfils, nouveauProfil(etat)] });
}

/** Retire un profil supplémentaire ; le profil principal et un identifiant inconnu ne changent rien. */
export function retirerProfil(etat: WizardState, id: string): WizardState {
  return normaliserGroupe({ ...etat, autresProfils: etat.autresProfils.filter((p) => p.id !== id) });
}

/** Met à jour les réponses d'un profil : l'identifiant `principal` désigne les champs de l'état. */
export function majProfil(etat: WizardState, id: string, maj: Partial<ChampsProfil>): WizardState {
  if (id === ID_PROFIL_PRINCIPAL) return normaliserGroupe({ ...etat, ...maj });
  return normaliserGroupe({ ...etat, autresProfils: etat.autresProfils.map((p) => (p.id === id ? { ...p, ...maj } : p)) });
}

/** Change le projet d'un profil : seules les réponses du nouveau statut et les questions communes restent (`champsDepuisProjet`). */
export function changerProjetDuProfil(etat: WizardState, id: string, projet: ProjetType): WizardState {
  const champs = profilsDuGroupe(etat).find((p) => p.id === id)?.champs;
  return champs ? majProfil(etat, id, champsDepuisProjet(champs, projet)) : etat;
}

/** Fixe le nombre de personnes d'un profil, borné à la place qui reste (1 au moins, jamais NaN) ; un identifiant inconnu ne change rien. */
export function definirNombre(etat: WizardState, id: string, nombre: number): WizardState {
  const profils = profilsDuGroupe(etat);
  if (!profils.some((p) => p.id === id)) return etat;
  const autres = profils.reduce((somme, p) => somme + (p.id === id ? 0 : p.nombre), 0);
  const borne = Math.max(1, Math.min(Number.isFinite(nombre) ? Math.floor(nombre) : 1, MAX_PERSONNES - autres));
  if (id === ID_PROFIL_PRINCIPAL) return normaliserGroupe({ ...etat, nombrePersonnes: borne });
  return normaliserGroupe({ ...etat, autresProfils: etat.autresProfils.map((p) => (p.id === id ? { ...p, nombre: borne } : p)) });
}

// --- Prix de la formation -----------------------------------------------------------------------------------------

/**
 * Saisie du prix et de la durée. Par personne, `saisie` est le coût d'une personne. Pour le groupe (à partir de deux
 * personnes), c'est le prix de tout le groupe : l'état garde ce prix et en tire le coût d'une personne. Un prix effacé ou
 * une durée absente donnent un coût (ou un coût horaire) vide, jamais NaN.
 */
export function etatDepuisPrix(etat: WizardState, saisie: number | null, heures: number | null, pourLeGroupe: boolean): WizardState {
  const personnes = nombreDePersonnes(etat);
  if (pourLeGroupe && personnes >= 2) {
    return { ...etat, ...coutsDeFormation(saisie == null ? null : saisie / personnes, heures), prixDuGroupe: saisie };
  }
  return { ...etat, ...coutsDeFormation(saisie, heures), prixDuGroupe: null };
}

/**
 * Bascule entre « par personne » et « pour le groupe » en gardant le coût réel : le nombre affiché est converti, pas
 * ressaisi. Vers le groupe, le prix est celui d'une personne multiplié par l'effectif, au centime ; sans prix saisi ou
 * avec une seule personne, rien n'est converti.
 */
export function basculerModePrix(etat: WizardState, versGroupe: boolean): WizardState {
  const personnes = nombreDePersonnes(etat);
  if (!versGroupe || personnes < 2) return { ...etat, prixDuGroupe: null };
  if (etat.pedagogyCostTotal == null) return etat;
  return normaliserGroupe({ ...etat, prixDuGroupe: Math.round(etat.pedagogyCostTotal * personnes * 100) / 100 });
}

// --- OPCO et budget du groupe -------------------------------------------------------------------------------------

/** Projet de chaque profil du groupe (le profil principal d'abord). */
export const projetsDuGroupe = (etat: WizardState): (ProjetType | null)[] => profilsDuGroupe(etat).map((p) => p.champs.projetType);

/** L'OPCO est requis dès qu'un profil n'est pas un dirigeant (`opcoRequis`). */
export const opcoRequisPourLeGroupe = (etat: WizardState): boolean => projetsDuGroupe(etat).some((p) => opcoRequis(p));

/** Le budget déjà consommé s'affiche et se garde tant qu'un profil relève d'un projet salarié (`ouvreBudgetOpco`). */
export const ouvreBudgetPourLeGroupe = (etat: WizardState): boolean => projetsDuGroupe(etat).some((p) => ouvreBudgetOpco(p));
