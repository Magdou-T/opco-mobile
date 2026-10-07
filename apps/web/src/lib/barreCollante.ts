// ============================================================
// Barre de navigation collante du simulateur (sous 1 024 px) : réserve du bas de la zone de défilement et contrôle
// qui passe sous la barre. Fonctions pures (tests : tests/barreCollante.test.ts) ; le crochet
// hooks/useReserveBarreCollante.ts les applique au document. Règle : apps/web/DESIGN.md, section 14.
// ============================================================

/** Air réservé en plus de la barre : l'anneau de focus (3 px, décalé de 2 px) d'un contrôle reste entier. */
export const AIR_AU_DESSUS_DE_LA_BARRE = 8;

/**
 * Variable CSS de la réserve, propre à cette barre : `html` en tire son `scroll-padding-bottom` et les contrôles de la
 * barre leur `scroll-margin-bottom` négatif (globals.css). Chaque élément collant en bas de l'écran a la sienne : retirer
 * l'une n'efface jamais la réserve d'un autre.
 */
export const VARIABLE_RESERVE = '--reserve-barre-simulateur';

/** Réserve du bas de la zone de défilement pour une barre de `hauteur` px (arrondie au pixel supérieur), air compris. */
export function reserveDeLaBarre(hauteur: number): number {
  return Math.ceil(hauteur) + AIR_AU_DESSUS_DE_LA_BARRE;
}

/**
 * Le contrôle qui a le focus est-il masqué par la barre collante, même en partie, ou trop près d'elle pour son anneau
 * (son bas dépasse le haut de la barre moins 8 px) ? Jamais pour un contrôle de la barre elle-même, ni quand la barre
 * ne colle pas (1 024 px et plus, récapitulatif).
 */
export function focusSousLaBarre(basCible: number, hautBarre: number, dansLaBarre: boolean, colle: boolean): boolean {
  return colle && !dansLaBarre && basCible > hautBarre - AIR_AU_DESSUS_DE_LA_BARRE;
}
