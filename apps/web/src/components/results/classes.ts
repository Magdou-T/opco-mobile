/**
 * Texte d'un élément flexible (puce ou icône suivie d'un texte, lien d'une liste en ligne) : sa largeur minimale n'est
 * plus celle de son mot le plus long. Une adresse web ou électronique sans espace (« servicenouvelleschances@… »,
 * « (financeurs.moncompteformation.gouv.fr) ») passe à la ligne au lieu d'être rognée par sa carte à 320 px
 * (WCAG 1.4.10) ; `break-words` ne suffit pas, il ne réduit pas cette largeur minimale.
 */
export const TEXTE_SOUPLE = 'min-w-0 [overflow-wrap:anywhere]';
