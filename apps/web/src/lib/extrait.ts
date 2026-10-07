// ============================================================
// Extrait d'un texte des données pour une carte (secteurs d'un OPCO sur l'accueil). Fonction pure.
// ============================================================

/**
 * Début d'un texte en `max` caractères au plus, suivi de « … » s'il a été coupé : la coupe se fait après un élément de
 * la liste (à la dernière virgule, si elle passe la moitié), sinon à la fin d'un mot, et recule avant toute parenthèse
 * que la coupe laisserait ouverte (imbriquées comprises). Quand aucune coupe propre n'existe (premier mot plus long que
 * l'extrait, texte tranché dans sa première parenthèse), le texte est rendu entier. Rien n'est résumé : le texte entier
 * est sur la fiche de l'OPCO.
 */
export function extrait(texte: string, max: number): string {
  if (texte.length <= max) return texte;
  const debut = texte.slice(0, max + 1);
  const virgule = debut.lastIndexOf(', ');
  const espace = debut.lastIndexOf(' ');
  let coupe = virgule > max / 2 ? debut.slice(0, virgule) : espace > 0 ? debut.slice(0, espace) : '';
  // Parenthèse la plus extérieure restée ouverte : la coupe recule juste avant elle.
  let profondeur = 0;
  let ouverte = -1;
  for (let i = 0; i < coupe.length; i++) {
    if (coupe[i] === '(') {
      if (profondeur === 0) ouverte = i;
      profondeur++;
    } else if (coupe[i] === ')' && profondeur > 0) {
      profondeur--;
    }
  }
  if (profondeur > 0) coupe = coupe.slice(0, ouverte);
  coupe = coupe.replace(/[\s,;:·(]+$/u, '');
  return coupe ? `${coupe}…` : texte;
}
