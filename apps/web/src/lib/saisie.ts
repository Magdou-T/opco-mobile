// ============================================================
// Lecture des saisies numériques du simulateur (fonctions pures). Les champs sont des champs texte : on lit soi-même
// la saisie à la française (espaces de milliers, virgule décimale) au lieu de laisser le navigateur effacer ce qu'il
// ne comprend pas.
// ============================================================

export interface LectureNombre {
  /** Nombre lu, ou null quand la saisie est vide ou refusée. */
  valeur: number | null;
  /** Explication à afficher quand la saisie est refusée (null si elle est vide ou valide). */
  erreur: string | null;
}

export interface ReglesNombre {
  /** Décimales admises (virgule ou point) ; sinon entier. */
  decimal?: boolean;
  /** Plus petite valeur admise (0 par défaut). */
  min?: number;
  /** Plus grande valeur admise (aucune par défaut). */
  max?: number;
}

/** Espaces de milliers : en JavaScript, `\s` couvre aussi l'espace insécable (U+00A0) et l'espace fine (U+202F). */
const ESPACES = /\s/g;
const nombreFr = (n: number): string => String(n).replace('.', ',');

/**
 * Lit une saisie : vide → valeur nulle sans erreur ; espaces (insécables compris) ignorés ; virgule ou point décimal si
 * `decimal` ; une saisie illisible, négative ou hors des bornes est refusée (valeur nulle) avec son explication, jamais
 * corrigée en silence.
 */
export function lireNombre(saisie: string, { decimal = false, min = 0, max }: ReglesNombre = {}): LectureNombre {
  const brut = saisie.replace(ESPACES, '');
  if (brut === '') return { valeur: null, erreur: null };
  const normal = decimal ? brut.replace(',', '.') : brut;
  const forme = decimal ? /^\d+(?:\.\d+)?$/ : /^\d+$/;
  if (!forme.test(normal)) {
    return {
      valeur: null,
      erreur: decimal
        ? 'Saisissez un nombre, par exemple 1500 ou 1500,50.'
        : 'Saisissez un nombre entier, sans lettre ni signe.',
    };
  }
  const n = Number(normal);
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
