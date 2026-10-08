// ============================================================
// Rédaction des textes du moteur (fonctions pures) : nom d'un OPCO dans une phrase, espace insécable entre un nombre et
// son unité, singulier ou pluriel d'un nom compté. Les onze noms des données : AFDAS, AKTO, ATLAS, Constructys, OCAPIAT,
// OPCO EP, OPCO Mobilités, OPCO Santé, OPCO 2i, L'Opcommerce, Uniformation.
// ============================================================

/** Espace insécable (U+00A0) : entre un nombre et son unité (« 140 h », « 50 % ») dans les textes du moteur. */
export const INSECABLE = String.fromCharCode(0xa0);

/** Nombre suivi de son unité, séparés par l'espace insécable : « 140 h », « 30 €/h », « 4200.00 € », « 20 € par repas ». */
export function avecUnite(nombre: number | string, unite: string): string {
  return `${nombre}${INSECABLE}${unite}`;
}

/** Nombre suivi d'un nom compté, au singulier jusqu'à 1 et au pluriel au-delà, avec l'espace insécable : « 1 jour », « 2 nuits ». */
export function compte(nombre: number, singulier: string, pluriel: string): string {
  return avecUnite(nombre, nombre > 1 ? pluriel : singulier);
}

/** Apostrophe typographique (U+2019), construite par son code. */
const APOSTROPHE_TYPOGRAPHIQUE = String.fromCharCode(0x2019);

/** Article élidé en tête d'un nom (« L'Opcommerce »), apostrophe droite ou typographique. */
const ARTICLE_ELIDE = new RegExp(`^L['${APOSTROPHE_TYPOGRAPHIQUE}]`);

/** Nom placé au milieu d'une phrase : l'article élidé passe en minuscule (« Contactez l'Opcommerce »), le reste ne change pas. */
export function dansLaPhrase(nom: string): string {
  return ARTICLE_ELIDE.test(nom) ? `l${nom.slice(1)}` : nom;
}

/**
 * « de » devant un nom, élidé devant une voyelle : « d'AKTO », « d'OPCO 2i », « d'Uniformation », « de Constructys »,
 * « de l'Opcommerce » (l'article élidé passe en minuscule).
 */
export function de(nom: string): string {
  const n = dansLaPhrase(nom);
  return /^[aeiouyàâäéèêëîïôöùûü]/i.test(n) ? `d'${n}` : `de ${n}`;
}

/**
 * Nom placé après un nom commun (« le plafond AKTO », « Mode de calcul OPCO EP ») : un nom précédé de l'article élidé s'y
 * rattache par « de » (« le plafond de l'Opcommerce »).
 */
export function apposition(nom: string): string {
  return ARTICLE_ELIDE.test(nom) ? de(nom) : nom;
}
