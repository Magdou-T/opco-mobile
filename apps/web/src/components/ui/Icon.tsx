import type { ReactNode, SVGProps } from 'react';

/**
 * Jeu d'icônes SVG du site : grille de 24 px, trait de 1,75 px à bouts ronds, couleur héritée (`currentColor`).
 * Décorative par défaut (`aria-hidden`) ; avec `titre`, l'icône porte un nom accessible (role="img").
 * Aucune dépendance : chaque tracé est écrit ici. Voir apps/web/DESIGN.md (Icônes).
 */
export type IconName =
  | 'batiment'
  | 'calculatrice'
  | 'euro'
  | 'repere'
  | 'bouclier'
  | 'document'
  | 'fleche'
  | 'coche'
  | 'info'
  | 'alerte'
  | 'lien-externe'
  | 'menu'
  | 'fermer'
  | 'globe'
  | 'personne'
  | 'mallette'
  | 'courriel'
  | 'chevron'
  | 'loupe'
  | 'retour'
  | 'crayon'
  | 'livre'
  | 'diplome'
  | 'recrutement'
  | 'virage'
  | 'train'
  | 'lit'
  | 'couverts';

const point = (cx: number, cy: number) => <circle cx={cx} cy={cy} r="1.1" fill="currentColor" stroke="none" />;

const TRACES: Record<IconName, ReactNode> = {
  batiment: (
    <>
      <path d="M4.5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h7.5A1.5 1.5 0 0 1 15 5v15.5" />
      <path d="M15 9.5h3a1.5 1.5 0 0 1 1.5 1.5v9.5" />
      <path d="M3 20.5h18" />
      <path d="M8 8h3.5M8 11.75h3.5M8 15.5h3.5" />
    </>
  ),
  calculatrice: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <rect x="8" y="6" width="8" height="3.5" rx="0.75" />
      {point(9, 13.5)}
      {point(12, 13.5)}
      {point(15, 13.5)}
      {point(9, 17.25)}
      {point(12, 17.25)}
      {point(15, 17.25)}
    </>
  ),
  euro: (
    <>
      <path d="M17.5 7.1A6.5 6.5 0 1 0 17.5 16.9" />
      <path d="M4.5 10.25h9M4.5 13.75h9" />
    </>
  ),
  repere: (
    <>
      <path d="M12 21s-6.5-5.7-6.5-11.25a6.5 6.5 0 0 1 13 0C18.5 15.3 12 21 12 21z" />
      <circle cx="12" cy="9.75" r="2.4" />
    </>
  ),
  bouclier: (
    <>
      <path d="M12 3.25 19 6v5.5c0 4.4-2.9 8-7 9.25-4.1-1.25-7-4.85-7-9.25V6z" />
      <path d="m9 12.25 2.1 2.1L15.25 10" />
    </>
  ),
  document: (
    <>
      <path d="M14 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V7.5z" />
      <path d="M14 3.5v4h4" />
      <path d="M9 12.5h6M9 16h4" />
    </>
  ),
  fleche: <path d="M4.5 12h15M13.5 6l6 6-6 6" />,
  coche: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M12 11v5.25" />
      {point(12, 7.75)}
    </>
  ),
  alerte: (
    <>
      <path d="M10.3 4.3 2.9 17.2a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4.25" />
      {point(12, 16.9)}
    </>
  ),
  'lien-externe': (
    <>
      <path d="M13.5 4.5h6v6" />
      <path d="m19.5 4.5-8.25 8.25" />
      <path d="M17.5 13.5v4.5a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V8A1.5 1.5 0 0 1 6 6.5h4.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  fermer: <path d="M6 6l12 12M18 6 6 18" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M3.25 12h17.5" />
      <path d="M12 3.25c2.4 2.5 3.6 5.4 3.6 8.75S14.4 18.25 12 20.75C9.6 18.25 8.4 15.35 8.4 12S9.6 5.75 12 3.25z" />
    </>
  ),
  personne: (
    <>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.75 20c.9-3.75 3.75-5.75 7.25-5.75s6.35 2 7.25 5.75" />
    </>
  ),
  mallette: (
    <>
      <rect x="3.5" y="7" width="17" height="13" rx="2" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M3.5 12.5h17" />
    </>
  ),
  courriel: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4.5 7.5 7.5 5.75 7.5-5.75" />
    </>
  ),
  chevron: <path d="m9.5 6 6 6-6 6" />,
  loupe: (
    <>
      <circle cx="10.75" cy="10.75" r="6.25" />
      <path d="m15.5 15.5 4.75 4.75" />
    </>
  ),
  retour: <path d="M19.5 12h-15M10.5 6l-6 6 6 6" />,
  crayon: (
    <>
      <path d="M15.6 4.4a2.05 2.05 0 0 1 2.9 0l1.1 1.1a2.05 2.05 0 0 1 0 2.9L8.9 19.1l-4.4 1.1 1.1-4.4z" />
      <path d="m13.75 6.25 4 4" />
    </>
  ),
  livre: (
    <>
      <path d="M12 6.5c-1.6-1.3-3.9-2-6.5-2H3.75v13.5H5.5c2.6 0 4.9.7 6.5 2 1.6-1.3 3.9-2 6.5-2h1.75V4.5H18.5c-2.6 0-4.9.7-6.5 2z" />
      <path d="M12 6.5v13.5" />
    </>
  ),
  diplome: (
    <>
      <path d="m2.75 9.25 9.25-4.5 9.25 4.5-9.25 4.5z" />
      <path d="M6.5 11.1v4.4c1.4 1.3 3.4 2 5.5 2s4.1-.7 5.5-2v-4.4" />
      <path d="M21.25 9.25v5" />
    </>
  ),
  recrutement: (
    <>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3 19.5c.8-3.4 3.4-5.25 6.5-5.25 1.6 0 3 .45 4.1 1.3" />
      <path d="M18.5 13.5v6M15.5 16.5h6" />
    </>
  ),
  virage: (
    <>
      <path d="M5 20.5v-6.75A4.75 4.75 0 0 1 9.75 9H19" />
      <path d="m15 5 4 4-4 4" />
    </>
  ),
  train: (
    <>
      <rect x="6" y="3.5" width="12" height="13.5" rx="3" />
      <path d="M6 11h12M9.75 6.75h4.5" />
      <path d="m8.5 20.5 1.5-3.5M15.5 20.5 14 17" />
      {point(9, 14)}
      {point(15, 14)}
    </>
  ),
  lit: (
    <>
      <path d="M3.5 5.5v14M20.5 19.5v-4H3.5" />
      <path d="M10 15.5V10h7.5a3 3 0 0 1 3 3v2.5" />
      <circle cx="6.75" cy="12.25" r="1.75" />
    </>
  ),
  couverts: (
    <>
      <path d="M7 3.5v17M4.5 3.5v4.75a2.5 2.5 0 0 0 5 0V3.5" />
      <path d="M17 20.5V3.5c-2.2.8-3.25 3.1-3.25 6.25v3.5H17" />
    </>
  ),
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  name: IconName;
  /** Nom accessible : à donner seulement quand l'icône porte seule un sens (sinon elle reste décorative). */
  titre?: string;
}

export function Icon({ name, titre, className = 'size-5', strokeWidth = 1.75, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      focusable="false"
      {...(titre ? { role: 'img' } : { 'aria-hidden': true })}
      {...props}
    >
      {titre && <title>{titre}</title>}
      {TRACES[name]}
    </svg>
  );
}
