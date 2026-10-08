import type { CSSProperties } from 'react';

/**
 * Délai d'apparition d'un élément `.apparition` (variable CSS `--delai`, globals.css), en millisecondes, au plus
 * `plafond` (les longues listes de l'écran de résultats n'attendent pas plus de 360 ms).
 */
export function delai(ms: number, plafond = Number.POSITIVE_INFINITY): CSSProperties {
  return { '--delai': `${Math.min(ms, plafond)}ms` } as CSSProperties;
}
