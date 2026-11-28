import type { CSSProperties, ReactNode } from 'react';
import { cx } from '@/lib/cx';

/**
 * Étiquette rectangulaire (charte financementopco) : DM Mono en capitales, cadre de 1,5 px, angles de 2 px, sans
 * pastille. Le texte porte le sens.
 *
 * - variante « douce » (défaut) : couleurs du ton (tableau DOUCE ci-dessous, tous les couples au-dessus de 4,5:1).
 * - variante « flottante » : la feuille dans un cadre de filet ; dans une liste étroite, son texte passe à la ligne.
 * - `surFondSombre` : cadre blanc à 40 %, texte blanc, pour les aplats bleu de Prusse et encre.
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
