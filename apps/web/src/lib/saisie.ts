// ============================================================
// Lecture des saisies numériques du simulateur (fonctions pures). Les champs sont des champs texte : on lit soi-même
// la saisie à la française au lieu de laisser le navigateur effacer ce qu'il ne comprend pas. Une saisie illisible ou
// ambiguë est refusée avec son explication, jamais devinée ni corrigée en silence.
//
// Règle de lecture :
// - milliers : chiffres collés (1500) ou groupés par trois avec des espaces (1 500, 1 234 567), espaces insécables et
//   fines comprises ;
// - décimales (champ décimal seulement) : une virgule ou un point suivi d'un ou de deux chiffres (1,5 ; 1,50 ; 1.5) ;
// - un séparateur seul suivi de trois chiffres ou plus est ambigu (1.500 peut valoir 1 500 ou 1,5) : refusé ;
// - virgule et point ensemble : le dernier est le séparateur décimal (deux chiffres au plus), l'autre groupe les
//   milliers par trois (1.500,50 ou 1,500.50) ;
// - montant en euros : « € » ou « euros » en fin de saisie est accepté et ignoré ; ailleurs, il est refusé ;
// - un nombre trop grand pour être représenté (Infinity) est refusé.
// ============================================================

import { INSECABLE } from './insecable';

export interface LectureNombre {
  /** Nombre lu, ou null quand la saisie est vide ou refusée. */
  valeur: number | null;
  /** Explication à afficher quand la saisie est refusée (null si elle est vide ou valide). */
  erreur: string | null;
}

export interface ReglesNombre {
  /** Décimales admises (virgule ou point, deux chiffres au plus) ; sinon entier. */
  decimal?: boolean;
  /** Montant en euros : « € » ou « euros » en fin de saisie est accepté (ailleurs, il est refusé). */
  euros?: boolean;
  /** Plus petite valeur admise (0 par défaut). */
  min?: number;
  /** Plus grande valeur admise (aucune par défaut). */
  max?: number;
}

/** « 1 500 » des messages, groupé par une espace insécable (comme avant « : », « ; » et « € »). */
const MILLE = `1${INSECABLE}500`;

/** « € » ou « euros » en fin de saisie, avec ou sans espace avant (en JavaScript, `\s` couvre U+00A0 et U+202F). */
const SUFFIXE_EUROS = /\s*(?:€|euros?)$/i;

type Motif = 'illisible' | 'separateurs' | 'espaces' | 'euros' | 'trop-grand';

function explication(motif: Motif, decimal: boolean, euros: boolean): string {
  switch (motif) {
    case 'illisible':
      return decimal
        ? 'Saisissez un nombre, par exemple 1500 ou 1500,50.'
        : 'Saisissez un nombre entier, sans lettre ni signe.';
    case 'separateurs':
      if (!decimal) {
        return `Saisissez un nombre entier, sans virgule ni point${INSECABLE}: pour ${MILLE}, écrivez 1500 ou ${MILLE}.`;
      }
      return euros
        ? `Pour ${MILLE}${INSECABLE}€, écrivez 1500 ou ${MILLE}${INSECABLE}; la virgule sert aux centimes.`
        : `Pour ${MILLE}, écrivez 1500 ou ${MILLE}${INSECABLE}; la virgule sert aux décimales.`;
    case 'espaces':
      return `Les espaces séparent les milliers, par groupes de trois chiffres${INSECABLE}: écrivez 1500 ou ${MILLE}.`;
    case 'euros':
      return `Saisissez un nombre sans symbole euro${INSECABLE}: ce champ n'est pas un montant.`;
    case 'trop-grand':
      return `Nombre trop grand${INSECABLE}: vérifiez la saisie.`;
  }
}

/**
 * Chiffres d'une partie entière : collés, ou groupés par `separateur` avec un premier groupe de 1 à 3 chiffres puis des
 * groupes d'exactement 3. Null si le regroupement est faux.
 */
function chiffresGroupes(texte: string, separateur: RegExp): string | null {
  const groupes = texte.split(separateur);
  if (groupes.length === 1) return /^\d+$/.test(texte) ? texte : null;
  const [premier, ...suivants] = groupes;
  return /^\d{1,3}$/.test(premier) && suivants.every((g) => /^\d{3}$/.test(g)) ? groupes.join('') : null;
}

const nombreFr = (n: number): string => String(n).replace('.', ',');

/** Lecture des chiffres, sans les bornes : le nombre écrit sans séparateur, ou le motif du refus. */
function chiffres(texte: string, decimal: boolean): { entier: string; decimales: string } | { refus: Motif } {
  if (!/^\d(?:[\d\s.,]*\d)?$/.test(texte)) return { refus: 'illisible' };
  const dernier = Math.max(texte.lastIndexOf('.'), texte.lastIndexOf(','));
  if (dernier < 0) {
    const entier = chiffresGroupes(texte, /\s+/);
    return entier == null ? { refus: 'espaces' } : { entier, decimales: '' };
  }
  if (!decimal) return { refus: 'separateurs' };
  const separateur = texte[dernier];
  const autre = separateur === ',' ? '.' : ',';
  const avant = texte.slice(0, dernier);
  const apres = texte.slice(dernier + 1);
  if (/\s/.test(apres)) return { refus: 'espaces' };
  // Trois chiffres ou plus après le dernier séparateur, ou séparateur décimal répété : 1.500, 1,500,000, 1,2,3.
  if (apres.length > 2 || avant.includes(separateur)) return { refus: 'separateurs' };
  if (avant.includes(autre)) {
    // L'autre séparateur groupe les milliers par trois, sans espace mêlée : 1.500,50 ou 1,500.50.
    const entier = /\s/.test(avant) ? null : chiffresGroupes(avant, autre === '.' ? /\./ : /,/);
    return entier == null ? { refus: 'separateurs' } : { entier, decimales: apres };
  }
  const entier = chiffresGroupes(avant, /\s+/);
  return entier == null ? { refus: 'espaces' } : { entier, decimales: apres };
}

/**
 * Lit une saisie selon la règle ci-dessus : vide, valeur nulle sans erreur ; lisible et dans les bornes, sa valeur ;
 * sinon valeur nulle et l'explication du refus.
 */
export function lireNombre(
  saisie: string,
  { decimal = false, euros = false, min = 0, max }: ReglesNombre = {},
): LectureNombre {
  const refus = (motif: Motif): LectureNombre => ({ valeur: null, erreur: explication(motif, decimal, euros) });
  let texte = saisie.trim();
  if (texte === '') return { valeur: null, erreur: null };
  const sansEuros = texte.replace(SUFFIXE_EUROS, '');
  if (sansEuros !== texte) {
    if (!euros) return refus('euros');
    texte = sansEuros;
  }
  const lu = chiffres(texte, decimal);
  if ('refus' in lu) return refus(lu.refus);
  const n = Number(lu.decimales ? `${lu.entier}.${lu.decimales}` : lu.entier);
  if (!Number.isFinite(n)) return refus('trop-grand');
  if (n < min || (max != null && n > max)) {
    return {
      valeur: null,
      erreur:
        max != null
          ? `Saisissez un nombre entre ${nombreFr(min)} et ${nombreFr(max)}.`
          : `Saisissez un nombre égal ou supérieur à ${nombreFr(min)}.`,
    };
  }
  return { valeur: n, erreur: null };
}

/** Texte d'un champ numérique pour une valeur de l'état (virgule décimale ; vide pour null). */
export function saisieDuNombre(valeur: number | null): string {
  return valeur == null ? '' : nombreFr(valeur);
}
