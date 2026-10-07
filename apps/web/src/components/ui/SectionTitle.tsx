import type { ReactNode } from 'react';

/**
 * Titre de section : surtitre (Inter majuscules espacées, point orange), titre Montserrat 700 à interlettrage serré et
 * taille fluide, chapeau facultatif. Le niveau de titre suit la hiérarchie de la page (`as`), la taille suit le rôle
 * visuel (`taille`) : les deux sont indépendants. Voir apps/web/DESIGN.md (Échelle typographique, Primitives).
 */
export interface SectionTitleProps {
  surtitre?: ReactNode;
  titre: ReactNode;
  chapeau?: ReactNode;
  as?: 'h1' | 'h2' | 'h3';
  /** affiche : titre d'accueil ; section : titre de section (défaut) ; sous-section : bloc dans une section. */
  taille?: 'affiche' | 'section' | 'sous-section';
  align?: 'start' | 'center';
  /** Sur une surface nuit, turquoise ou orange : chapeau en blanc plein (une opacité le ferait passer sous 4,5:1). */
  surFondSombre?: boolean;
  id?: string;
  /**
   * Le titre peut recevoir le focus par programme (tabIndex -1, hors de l'ordre de tabulation) : cible du focus quand le
   * contenu change sous l'utilisateur, par exemple à chaque étape du simulateur.
   */
  titreFocusable?: boolean;
  className?: string;
}

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const TAILLES = {
  affiche: 'text-affiche',
  section: 'text-titre',
  'sous-section': 'text-xl leading-tight tracking-[-0.02em] sm:text-2xl',
} as const;

export function SectionTitle({
  surtitre,
  titre,
  chapeau,
  as: Titre = 'h2',
  taille = 'section',
  align = 'start',
  surFondSombre = false,
  id,
  titreFocusable = false,
  className,
}: SectionTitleProps) {
  const centre = align === 'center';
  return (
    <div className={cx('max-w-3xl', centre && 'mx-auto text-center', className)}>
      {surtitre && <p className="surtitre mb-4">{surtitre}</p>}
      <Titre
        id={id}
        tabIndex={titreFocusable ? -1 : undefined}
        className={cx('font-display font-bold', TAILLES[taille], titreFocusable && 'scroll-mt-32 rounded-md')}
      >
        {titre}
      </Titre>
      {chapeau && (
        <p
          className={cx(
            'mt-4 max-w-2xl text-chapeau',
            surFondSombre ? 'text-white' : 'text-texte-doux',
            centre && 'mx-auto',
          )}
        >
          {chapeau}
        </p>
      )}
    </div>
  );
}
