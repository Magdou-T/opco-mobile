// ============================================================
// Rédaction des textes du moteur (fonctions pures) : nom d'un OPCO dans une phrase et espace insécable entre un nombre et
// son unité. Les onze noms des données : AFDAS, AKTO, ATLAS, Constructys, OCAPIAT, OPCO EP, OPCO Mobilités, OPCO Santé,
// OPCO 2i, L'Opcommerce, Uniformation.
// ============================================================

/** Espace insécable (U+00A0) : entre un nombre et son unité (« 140 h », « 50 % ») dans les textes du moteur. */
export const INSECABLE = String.fromCharCode(0xa0);

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
