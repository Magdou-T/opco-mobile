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

/* Charte financementopco : étiquette rectangulaire (angles de 2 px), DM Mono en capitales, cadre de 1,5 px ; aucune
   pastille de couleur. Les tons historiques gardent leur nom et prennent les couleurs de la charte. */
const DOUCE: Record<EtiquetteTone, string> = {
  neutre: 'border-filet-fort text-texte-doux',
  orange: 'border-prusse bg-prusse text-white',
  turquoise: 'border-prusse text-prusse',
  or: 'border-encre bg-surligneur text-encre',
  rouge: 'border-rouge text-rouge',
  'vert-clair': 'border-dashed border-ardoise text-ardoise',
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
        'inline-flex items-center rounded-[2px] border-[1.5px] font-mono font-medium tracking-[0.06em] uppercase',
        // Étiquette d'une liste qui passe à la ligne : son texte passe aussi à la ligne s'il est plus large que la liste.
        flottante ? 'max-w-full px-2.5 py-1 text-xs' : 'px-2 py-px text-[0.6875rem] leading-5 whitespace-nowrap',
        flottante && 'border-filet bg-white text-encre',
        !flottante && surFondSombre && 'border-white/40 text-white',
        !flottante && !surFondSombre && DOUCE[tone],
        className,
      )}
    >
      {children}
    </Balise>
  );
}
