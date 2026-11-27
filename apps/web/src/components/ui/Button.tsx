import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon } from './Icon';
import type { IconName } from './Icon';

/**
 * Bouton du site, en pilule. Rend un <button> (sans `href`), un lien Next (`href` interne : « /… » ou « #… ») ou un
 * <a> (adresse externe, ouverte dans un nouvel onglet et annoncée comme telle ; mailto: et tel:).
 *
 * - primary : orange foncé plein, texte blanc (5,16:1), balayage au survol ; l'action principale d'un écran.
 * - secondary : contour 2 px du turquoise de marque (3,07:1 sur blanc), libellé turquoise foncé (6,26:1) ; le contour
 *   fonce au survol. L'action d'accompagnement. Sur une bande lin-soft, le contour tombe à 2,84:1 : le libellé suffit
 *   à identifier le bouton (WCAG 1.4.11 n'exige pas son contour), mais préférer le fond blanc.
 * - ghost : lien d'action sans fond, orange foncé ; pour une suite de lecture (« Toutes les fiches »).
 * - inverse : pilule blanche, texte orange foncé ; sur une surface orange, turquoise ou nuit.
 *
 * Tailles : sm (36 px, réservée aux zones denses sur grand écran), md (44 px, défaut), lg (48 px).
 * Voir apps/web/DESIGN.md (Primitives).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'inverse';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonBase {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Flèche après le libellé : l'action fait avancer (simulateur, fiche suivante). */
  fleche?: boolean;
  /** Icône décorative avant le libellé. */
  icone?: IconName;
  /** Pleine largeur : toujours (true) ou seulement sous 640 px ('mobile'). */
  pleineLargeur?: boolean | 'mobile';
  className?: string;
  children: ReactNode;
}

export type ButtonAsLink = ButtonBase &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children' | 'href'> & { href: string };
export type ButtonAsButton = ButtonBase &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { href?: undefined };
export type ButtonProps = ButtonAsLink | ButtonAsButton;

/* Charte financementopco : boutons rectangulaires (angles de 3 px), Instrument Sans 600, cibles de 44 px au moins. */
const BASE =
  'group inline-flex items-center justify-center gap-2.5 rounded-[3px] text-center font-semibold leading-tight transition-[background-color,border-color,color] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTES: Record<ButtonVariant, string> = {
  // Bleu de Prusse plein (blanc dessus 11,27:1), survol bleu fonce.
  primary: 'bg-prusse text-white hover:bg-prusse-fonce disabled:bg-prusse',
  // Bouton encre plein (« Décrire mon projet » du kit).
  secondary: 'bg-encre text-white hover:bg-nuit disabled:bg-encre',
  // Lien souligne, sans fond.
  ghost: 'text-prusse underline decoration-1 underline-offset-[0.3em] hover:text-encre hover:decoration-2',
  // Sur fond bleu de Prusse : bouton surligneur, texte encre (11,93:1).
  inverse: 'bg-surligneur text-encre hover:bg-white disabled:bg-surligneur',
};

const TAILLES: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-4 text-sm',
  md: 'min-h-11 px-5 text-[0.9375rem]',
  lg: 'min-h-[3.25rem] px-6 text-[1.0625rem]',
};

const TAILLES_GHOST: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-1 text-sm',
  md: 'min-h-11 px-1 text-[0.9375rem]',
  lg: 'min-h-12 px-1 text-base',
};

function classesDuBouton({ variant = 'primary', size = 'md', pleineLargeur, className }: ButtonBase) {
  return cx(
    BASE,
    VARIANTES[variant],
    variant === 'ghost' ? TAILLES_GHOST[size] : TAILLES[size],
    pleineLargeur === true && 'w-full',
    pleineLargeur === 'mobile' && 'w-full sm:w-auto',
    className,
  );
}

function Contenu({ icone, fleche, children }: Pick<ButtonBase, 'icone' | 'fleche' | 'children'>) {
  return (
    <>
      {icone && <Icon name={icone} className="size-[1.15em] shrink-0" />}
      <span>{children}</span>
      {fleche && (
        <Icon
          name="fleche"
          className="size-[1.15em] shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
        />
      )}
    </>
  );
}

export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { variant, size, fleche, icone, pleineLargeur, className, children, href, ...lien } = props;
    const classes = classesDuBouton({ variant, size, pleineLargeur, className, children });
    const contenu = (
      <Contenu icone={icone} fleche={fleche}>
        {children}
      </Contenu>
    );
    if (/^https?:\/\//.test(href)) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={classes} {...lien}>
          {contenu}
          <span className="sr-only"> (nouvel onglet)</span>
        </a>
      );
    }
    if (href.startsWith('mailto:') || href.startsWith('tel:')) {
      return (
        <a href={href} className={classes} {...lien}>
          {contenu}
        </a>
      );
    }
    return (
      <Link href={href} className={classes} {...lien}>
        {contenu}
      </Link>
    );
  }

  const { variant, size, fleche, icone, pleineLargeur, className, children, type = 'button', ...bouton } = props;
  delete bouton.href;
  return (
    <button type={type} className={classesDuBouton({ variant, size, pleineLargeur, className, children })} {...bouton}>
      <Contenu icone={icone} fleche={fleche}>
        {children}
      </Contenu>
    </button>
  );
}
