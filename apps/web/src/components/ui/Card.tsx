import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';

/**
 * Carte du site (rayon 20 px).
 * - plain : fond blanc, filet teinté, ombre douce ; le cas courant.
 * - teintee : fond lin très clair, sans ombre ; un encart calme dans une page blanche.
 * - turquoise, orange, nuit : dégradés de marque calibrés pour le texte blanc (4,5:1 au point le plus clair), focus
 *   adapté ; réservés aux zones d'accent courtes (récapitulatif, appel à l'action), jamais derrière un long texte.
 *
 * Carte cliquable : `interactive` (soulèvement au survol) et, à l'intérieur, un lien portant la classe `lien-etendu`
 * dont le nom est le titre de la carte : toute la carte devient cliquable sans imbriquer de contenu dans le lien.
 * L'anneau de focus entoure une carte claire ; dans une carte en dégradé, il se dessine à l'intérieur (globals.css).
 * Une carte claire remet la couleur de focus à l'orange foncé, même posée sur une surface sombre.
 * Voir apps/web/DESIGN.md (Primitives).
 */
export type CardTone = 'plain' | 'teintee' | 'turquoise' | 'orange' | 'nuit';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'article' | 'section' | 'aside' | 'li';
  tone?: CardTone;
  padding?: CardPadding;
  interactive?: boolean;
  children: ReactNode;
}

const TONS: Record<CardTone, string> = {
  plain: 'border border-filet bg-white shadow-douce [--focus:var(--orange-deep)]',
  teintee: 'border border-filet/60 bg-lin-soft [--focus:var(--orange-deep)]',
  turquoise: 'surface-turquoise shadow-flottante',
  orange: 'surface-orange shadow-flottante',
  nuit: 'surface-nuit shadow-flottante',
};

const MARGES: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

export function Card({
  as: Balise = 'div',
  tone = 'plain',
  padding = 'md',
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <Balise
      className={cx(
        'relative rounded-carte',
        TONS[tone],
        MARGES[padding],
        interactive &&
          'transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-flottante',
        interactive && tone === 'plain' && 'hover:border-orange/45',
        className,
      )}
      {...props}
    >
      {children}
    </Balise>
  );
}
