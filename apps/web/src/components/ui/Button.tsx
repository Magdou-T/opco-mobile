import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

/**
 * Bouton du site, en pilule. Rend un <button> (sans `href`), un lien Next (`href` interne : « /… » ou « #… ») ou un
 * <a> (adresse externe, ouverte dans un nouvel onglet et annoncée comme telle ; mailto: et tel:).
 *
 * - primary : orange foncé plein, texte blanc (5,16:1), balayage au survol ; l'action principale d'un écran.
 * - secondary : contour turquoise foncé (6,26:1 sur blanc) ; l'action d'accompagnement.
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

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const BASE =
  'group inline-flex items-center justify-center gap-2 rounded-full text-center font-semibold leading-tight transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0';

const VARIANTES: Record<ButtonVariant, string> = {
  primary: 'reflet bg-orange-deep text-white shadow-douce hover:bg-orange-deeper disabled:bg-orange-deep',
  secondary: 'border-2 border-turquoise-deep text-turquoise-deep hover:bg-turquoise-soft disabled:bg-transparent',
  ghost: 'text-orange-deep decoration-2 underline-offset-[0.3em] hover:underline',
  inverse: 'bg-white text-orange-deep shadow-douce hover:bg-orange-soft disabled:bg-white',
};

const TAILLES: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-4 text-sm',
  md: 'min-h-11 px-5 text-[0.9375rem]',
  lg: 'min-h-12 px-7 text-base',
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
