import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';

/**
 * Carte du site (charte financementopco : angles de 3 px, aucune ombre).
 * - plain : la feuille dans un cadre de filet ; le cas courant.
 * - teintee : papier foncé dans un cadre de filet ; un encart calme.
 * - orange, turquoise (noms historiques) : aplat bleu de Prusse ; nuit : aplat encre. Texte clair, focus surligneur ;
 *   réservés aux zones d'accent courtes, jamais derrière un long texte.
 *
 * Carte cliquable : `interactive` et, à l'intérieur, un lien portant la classe `lien-etendu` dont le nom est le titre de
 * la carte : toute la carte devient cliquable sans imbriquer de contenu dans le lien. L'anneau de focus entoure une
 * carte claire ; dans un aplat, il se dessine à l'intérieur du bord (globals.css). Une carte claire remet la couleur de
 * focus au bleu de Prusse, même posée sur une surface sombre.
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
  // Charte financementopco : un cadre de filet sur la feuille, sans ombre ni arrondi (3 px) ; les variantes sombres sont
  // des aplats pleins (bleu de Prusse ou encre).
  plain: 'border border-filet bg-white [--focus:var(--prusse)]',
  teintee: 'border border-filet bg-papier-fonce [--focus:var(--prusse)]',
  turquoise: 'surface-turquoise',
  orange: 'surface-orange',
  nuit: 'surface-nuit',
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
        interactive && 'transition-[border-color,background-color] duration-150 ease-out hover:border-encre',
        className,
      )}
      {...props}
    >
      {children}
    </Balise>
  );
}
