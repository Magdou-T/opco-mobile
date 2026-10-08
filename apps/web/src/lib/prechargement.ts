// ============================================================
// Préchargement d'un lot de code chargé à la demande (écran de résultats), en fonction pure : ni React ni navigateur
// (la connexion est lue par la fonction passée en paramètre). Tests : tests/prechargement.test.ts.
// ============================================================

/** Issue d'une demande de préchargement. */
export type Prechargement = 'lance' | 'deja_lance' | 'hors_ligne';

/**
 * Préchargeur d'un lot chargé à la demande : `charger` (la fonction de chargement que `next/dynamic` appelle aussi) n'est
 * appelée qu'une fois par page, et jamais quand `enLigne()` est faux. Le chargeur de Turbopack garde la promesse d'un lot
 * en échec : un préchargement lancé hors ligne condamnerait l'écran pour la session, même revenu en ligne. Hors ligne,
 * rien n'est retenu : une nouvelle demande (à l'événement `online`) lance le préchargement. Un échec est absorbé ; au clic,
 * `next/dynamic` refait l'appel et affiche l'écran d'échec s'il échoue encore.
 */
export function creerPrechargeur(charger: () => Promise<unknown>, enLigne: () => boolean): () => Prechargement {
  let lance = false;
  return () => {
    if (lance) return 'deja_lance';
    if (!enLigne()) return 'hors_ligne';
    lance = true;
    charger().catch(() => undefined);
    return 'lance';
  };
}
