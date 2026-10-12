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
  effectifValide,
  nombreDePersonnes,
  profilsDuGroupe,
} from '@opco/core';
import type { ChampsProfil, ProfilSupplementaire, ProjetType, WizardState } from '@opco/core';
import { opcoRequis, ouvreBudgetOpco } from './entreprise';
import { formatEuro, nombreEtUnite } from './format';
import { champsDepuisProjet, coutsDeFormation, reponsesInconnuesApres } from './parcours';
import type { QuestionAvecInconnu, QuestionDeProfil } from './parcours';

// --- Saisie du nombre de personnes --------------------------------------------------------------------------------

/**
 * Lit le nombre de personnes saisi : un entier de 1 à 99. Une saisie hors bornes est ramenée à la borne, quel que soit le
 * nombre de chiffres : « 150 » et une suite de 400 chiffres donnent 99 (`Number` lit une très longue suite de chiffres comme
 * Infinity, que `Math.min` plafonne). Vide, zéro, négatif, décimal, texte, notation scientifique ou chiffre autre que 0 à 9
 * (`\d` ne lit que ceux-là : pas d'arabo-indiens ni de pleine chasse) : null, la saisie est refusée et l'état garde sa
 * valeur. Jamais NaN.
 */
export function lireEffectif(texte: string): number | null {
  const propre = texte.trim();
  if (!/^\d+$/.test(propre)) return null;
  const n = Number(propre);
  return n < 1 ? null : Math.min(n, MAX_PERSONNES);
}

// --- Cohérence de l'état ------------------------------------------------------------------------------------------

/**
 * Ramène l'état d'un groupe à ses invariants : effectifs entiers de 1 à 99 (`effectifValide` du cœur, la fonction que le
 * moteur lit aussi : le prix du groupe est divisé par le nombre de personnes que le moteur multiplie), au plus 5 profils
 * supplémentaires, au plus 99 personnes (le surplus se retire du dernier profil, puis des précédents, puis du profil
 * principal), prix du groupe vidé sous deux personnes, coût d'une personne et coût horaire recalculés quand le prix du
 * groupe est renseigné, budget déjà consommé vidé quand aucun profil du groupe ne relève d'un projet salarié
 * (`ouvreBudgetPourLeGroupe`). Idempotente.
 */
export function normaliserGroupe(etat: WizardState): WizardState {
  const autres = etat.autresProfils.slice(0, MAX_PROFILS - 1).map((p) => ({ ...p, nombre: effectifValide(p.nombre) }));
  let principal = effectifValide(etat.nombrePersonnes);
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
  if (suite.budgetDejaConsomme != null && !ouvreBudgetPourLeGroupe(suite)) suite = { ...suite, budgetDejaConsomme: null };
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

// --- Réponses « Je ne sais pas » de chaque profil -----------------------------------------------------------------

/**
 * Réponses « Je ne sais pas » de chaque profil supplémentaire, par identifiant. Celles du profil principal restent avec
 * celles de la formation, dans `useWizard` : la valeur reste null pour le moteur, le site retient seulement que
 * l'utilisateur a répondu.
 */
export type InconnuesParProfil = Readonly<Record<string, ReadonlySet<QuestionAvecInconnu>>>;

const AUCUNE_REPONSE: ReadonlySet<QuestionAvecInconnu> = new Set();

/**
 * Réponses « Je ne sais pas » d'un profil après une mise à jour `maj` de ses réponses : toute écriture d'une de ces
 * questions efface la sienne, `inconnue` ajoute la question à laquelle l'utilisateur vient de répondre « Je ne sais pas ».
 * Rend l'objet reçu, inchangé, quand rien ne change.
 */
export function inconnuesApresMaj(
  avant: InconnuesParProfil,
  id: string,
  maj: Partial<ChampsProfil>,
  inconnue?: QuestionDeProfil,
): InconnuesParProfil {
  const courant = avant[id] ?? AUCUNE_REPONSE;
  const suite = reponsesInconnuesApres(courant, maj, inconnue);
  return suite === courant ? avant : { ...avant, [id]: suite };
}

/** Le profil retiré perd ses réponses « Je ne sais pas » : son identifiant peut resservir sans rien garder. */
export function inconnuesSansProfil(avant: InconnuesParProfil, id: string): InconnuesParProfil {
  if (!(id in avant)) return avant;
  const suite = { ...avant };
  delete suite[id];
  return suite;
}

// --- Prix de la formation à l'écran ----------------------------------------------------------------------------------

/**
 * Prix de toute la formation pour le groupe, au centime : celui qui a été saisi pour le groupe, sinon le coût d'une personne
 * multiplié par l'effectif. Null tant qu'aucun coût n'est saisi.
 */
export function coutDuGroupe(
  etat: Pick<WizardState, 'prixDuGroupe' | 'pedagogyCostTotal' | 'nombrePersonnes' | 'autresProfils'>,
): number | null {
  if (etat.prixDuGroupe != null) return etat.prixDuGroupe;
  if (etat.pedagogyCostTotal == null) return null;
  return Math.round(etat.pedagogyCostTotal * nombreDePersonnes(etat) * 100) / 100;
}

/**
 * Montant arrondi au centime pour le champ du prix. L'état garde le coût réel, non arrondi (le prix du groupe divisé par
 * l'effectif, 800,1999999999999 € pour 2 400,60 € et 3 personnes) : le champ n'en affiche que les centimes (« 800,2 »)
 * et n'écrit jamais dans l'état le nombre affiché.
 */
export const auCentime = (montant: number | null): number | null => (montant == null ? null : Math.round(montant * 100) / 100);

/**
 * Aide sous le champ du prix à partir de deux personnes : le prix de l'autre mode. Prix saisi pour le groupe : « Soit
 * 933,33 € par personne. » ; saisi par personne : « Soit 5 600 € pour les 6 personnes. ». Null sous deux personnes, sans
 * coût ou avec un coût invalide.
 */
export function aideDuPrix(personnes: number, coutParPersonne: number | null, pourLeGroupe: boolean): string | null {
  if (personnes < 2 || coutParPersonne == null || !(coutParPersonne > 0)) return null;
  return pourLeGroupe
    ? `Soit ${formatEuro(coutParPersonne)} par personne.`
    : `Soit ${formatEuro(Math.round(coutParPersonne * personnes * 100) / 100)} pour les ${nombreEtUnite(personnes, 'personnes')}.`;
}
