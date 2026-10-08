// ============================================================
// Typographie française des textes écrits dans le JSX des pages (guides) : `typo` appliquée à chaque texte d'un arbre
// d'éléments, sans toucher aux éléments eux-mêmes (tests : tests/typographie.test.ts).
// ============================================================

import { Children, cloneElement, isValidElement } from 'react';
import type { ReactNode } from 'react';
import { typo } from './format';
import { INSECABLE } from './insecable';

/** Texte qui commence par une ponctuation haute : l'espace qui le précède doit être insécable. */
const PONCTUATION_EN_TETE = /^[:;?!]/;

/**
 * Applique `typo` (espaces insécables avant « : ; ? ! », entre un nombre et son unité, entre les milliers ; jamais dans un
 * extrait cité « … ») à chaque texte d'un arbre JSX, en profondeur : seules des espaces ordinaires deviennent insécables,
 * aucun autre caractère n'est touché et les éléments gardent leur type, leurs propriétés et leur clé. Une espace seule
 * (`{' '}`) suivie d'un texte qui commence par une ponctuation haute (« <strong>…</strong>{' '}: … ») devient insécable,
 * comme une espace finale de texte dans le même cas.
 */
export function typoDesEnfants(noeud: ReactNode): ReactNode {
  if (typeof noeud === 'string') return typo(noeud);
  if (Array.isArray(noeud)) {
    const liste = Children.toArray(noeud);
    return liste.map((enfant, i) => {
      if (typeof enfant !== 'string') return typoDesEnfants(enfant);
      const suivant = liste[i + 1];
      const texte = typo(enfant);
      return typeof suivant === 'string' && PONCTUATION_EN_TETE.test(suivant) ? texte.replace(/ $/, INSECABLE) : texte;
    });
  }
  if (isValidElement<{ children?: ReactNode }>(noeud)) {
    const enfants = noeud.props.children;
    if (enfants === undefined || enfants === null || typeof enfants === 'boolean') return noeud;
    return cloneElement(noeud, undefined, typoDesEnfants(enfants));
  }
  return noeud;
}
