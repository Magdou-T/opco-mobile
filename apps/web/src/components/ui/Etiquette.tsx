import type { CSSProperties, ReactNode } from 'react';
import { cx } from '@/lib/cx';

/**
 * Étiquette en pilule avec point de couleur (le motif des étapes de l'animation de marque). Le texte porte le sens,
 * le point ne fait que l'appuyer : il reste décoratif.
 *
 * - variante « douce » (défaut) : fond teinté, texte foncé de la même famille (tous les couples ≥ 4,5:1).
 * - variante « flottante » : pilule blanche à ombre orangée, posée sur un aplat de couleur (décor des zones d'accent).
 * - `surFondSombre` : pilule assombrie (encre à 25 %) à texte blanc, pour les surfaces nuit, turquoise ou orange :
 *   6,70:1 au moins sur le point le plus clair de chaque dégradé (un voile blanc à 10 % tombait à 4,02:1).
 *
 * `as` : `span` (défaut) ou `li` dans une liste ; `style` sert aux délais d'apparition (`--delai`).
 * Voir apps/web/DESIGN.md (Primitives).
 */
export type EtiquetteTone = 'neutre' | 'orange' | 'turquoise' | 'or' | 'rouge' | 'vert-clair';

export interface EtiquetteProps {
  tone?: EtiquetteTone;
  variante?: 'douce' | 'flottante';
  surFondSombre?: boolean;
  as?: 'span' | 'li';
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

const DOUCE: Record<EtiquetteTone, string> = {
  neutre: 'border-filet bg-lin-soft text-texte-doux',
  orange: 'border-orange/25 bg-orange-soft text-orange-deep',
  turquoise: 'border-turquoise/30 bg-turquoise-soft text-turquoise-deep',
  or: 'border-or/50 bg-or-soft text-texte',
  rouge: 'border-rouge/25 bg-rouge-soft text-rouge',
  'vert-clair': 'border-vert-clair/70 bg-vert-clair-soft text-texte',
};

const POINT: Record<EtiquetteTone, string> = {
  neutre: 'bg-texte-discret',
  orange: 'bg-orange',
  turquoise: 'bg-turquoise',
  or: 'bg-or',
  rouge: 'bg-rouge',
  'vert-clair': 'bg-vert-clair',
};

const POINT_SOMBRE: Record<EtiquetteTone, string> = {
  neutre: 'bg-white/70',
  orange: 'bg-orange-clair',
  turquoise: 'bg-vert-clair',
  or: 'bg-or',
  rouge: 'bg-rouge ring-1 ring-white/50',
  'vert-clair': 'bg-vert-clair',
};

export function Etiquette({
  tone = 'neutre',
  variante = 'douce',
  surFondSombre = false,
  as: Balise = 'span',
  className,
  style,
  children,
}: EtiquetteProps) {
  const flottante = variante === 'flottante';
  return (
    <Balise
      style={style}
      className={cx(
        'inline-flex items-center rounded-full border font-semibold whitespace-nowrap',
        flottante ? 'gap-2 py-1.5 pr-3.5 pl-2.5 text-sm' : 'gap-1.5 py-0.5 pr-2.5 pl-2 text-xs leading-5',
        flottante && 'border-transparent bg-white text-encre shadow-etiquette',
        !flottante && surFondSombre && 'border-white/25 bg-encre/25 text-white',
        !flottante && !surFondSombre && DOUCE[tone],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'shrink-0 rounded-full',
          flottante ? 'size-2.5' : 'size-[7px]',
          surFondSombre && !flottante ? POINT_SOMBRE[tone] : POINT[tone],
        )}
      />
      {children}
    </Balise>
  );
}
