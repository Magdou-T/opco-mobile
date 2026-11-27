// Normalisation d'un texte pour une recherche simple (module sans dépendance : importable par un composant client).

/** Minuscules sans accents ni ponctuation : « Métallurgie » et « metallurgie » se valent. */
export function normaliserRecherche(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
