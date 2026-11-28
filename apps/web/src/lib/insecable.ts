// ============================================================
// Espace insécable, écrite par son code. Module sans importation (comme lib/ancre.ts) : un module qui n'a besoin que
// d'elle (contact, saisie, recherche, mentions légales) n'embarque pas lib/format.ts (expressions régulières, Intl).
// ============================================================

/**
 * Espace insécable (U+00A0) : avant « : ; ? ! », entre un nombre et son unité, entre les groupes de milliers, dans les
 * chaînes des composants et des modules (dans le texte JSX, l'entité `&nbsp;` suffit).
 */
export const INSECABLE = String.fromCharCode(0xa0);
