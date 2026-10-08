'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { FocusEvent, MouseEvent, ReactNode } from 'react';
import { cx } from '@/lib/cx';

/**
 * Parties de l'en-tête qui s'exécutent dans le navigateur, et rien d'autre : la page active (usePathname) et le menu
 * des petits écrans. Le logo, les icônes et le bouton principal sont rendus par le composant serveur SiteHeader et
 * passés ici tout faits : leur code ne part pas dans le navigateur.
 */

const NAVIGATION = [
  { href: '/simulateur', label: 'Simulateur' },
  { href: '/comprendre-les-opco', label: 'Comprendre les OPCO' },
  { href: '/obligations', label: 'Obligations' },
  { href: '/former-sans-budget', label: 'Former sans budget' },
  { href: '/opco', label: 'Les 11 OPCO' },
  { href: '/contact', label: 'Contact' },
];

/** Page active : l'adresse elle-même ou une de ses sous-pages (export avec barre oblique finale). */
function estActive(chemin: string, href: string): boolean {
  const c = chemin.length > 1 ? chemin.replace(/\/+$/, '') : chemin;
  return c === href || c.startsWith(`${href}/`);
}

/* Transitions limitées aux couleurs de fond et de texte : l'anneau de focus paraît d'emblée en orange foncé. */
const VARIANTES = {
  /**
   * Une seule ligne d'en-tête (à partir de 1 280 px) : libellés de 14 px, pilules serrées. Mesuré à 1 280 px avec une
   * barre de défilement classique (1 217 px utiles) : logo 263, navigation 675, bouton 226, il reste une vingtaine de px.
   */
  ligne: {
    liste: 'flex items-center gap-0.5',
    lien: 'inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-sm font-medium whitespace-nowrap transition-[color,background-color]',
  },
  /** Seconde ligne, sous l'en-tête collant (1 024 à 1 279 px) : elle défile avec la page. */
  'seconde-ligne': {
    liste: 'mx-auto flex h-12 max-w-6xl items-center gap-1 px-4 sm:px-6 [&>li:first-child]:-ml-3',
    lien: 'inline-flex h-9 items-center gap-2 rounded-full px-3 text-[0.9375rem] font-medium transition-[color,background-color]',
  },
  /** Menu des petits écrans : cibles de 48 px. */
  menu: {
    liste: 'mx-auto max-w-6xl px-4 py-3 sm:px-6',
    lien: 'flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-medium transition-[color,background-color]',
  },
} as const;

export function LiensNavigation({
  variante,
  chevron,
}: {
  variante: keyof typeof VARIANTES;
  /** Icône de fin de ligne du menu (rendue par le serveur). */
  chevron?: ReactNode;
}) {
  const chemin = usePathname() ?? '/';
  const v = VARIANTES[variante];
  const menu = variante === 'menu';
  return (
    <ul className={v.liste}>
      {NAVIGATION.map((item) => {
        const actif = estActive(chemin, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={actif ? 'page' : undefined}
              className={cx(
                v.lien,
                actif ? 'bg-lin font-semibold text-texte' : 'text-texte-doux hover:bg-lin-soft hover:text-texte',
              )}
            >
              {(actif || menu) && (
                <span
                  aria-hidden="true"
                  className={cx('size-1.5 shrink-0 rounded-full', actif ? 'bg-orange' : 'bg-filet-fort/40')}
                />
              )}
              {menu ? <span className="flex-1">{item.label}</span> : item.label}
              {menu && chevron}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Affiche son contenu partout sauf sur le simulateur (le bouton principal y mènerait à la page en cours). */
export function HorsDuSimulateur({ children }: { children: ReactNode }) {
  const chemin = usePathname() ?? '/';
  return estActive(chemin, '/simulateur') ? null : children;
}

/**
 * Menu des petits écrans (sous 1 024 px) : bouton « Menu » (aria-expanded, aria-controls) et panneau posé sous l'en-tête,
 * avec un voile sur la page. Il se ferme par Échap (le focus revient au bouton), par un clic sur le voile, par un lien du
 * panneau (le focus revient au bouton), quand le focus le quitte (Tab après le dernier lien, Maj+Tab avant le bouton :
 * rien ne reste masqué sous le panneau) et à chaque changement de page.
 */
export function MenuMobile({
  iconeOuvrir,
  iconeFermer,
  children,
}: {
  iconeOuvrir: ReactNode;
  iconeFermer: ReactNode;
  children: ReactNode;
}) {
  const chemin = usePathname() ?? '/';
  // Le menu est ouvert pour une page donnée. Dès que la page change (lien, retour ou avance de l'historique), l'état est
  // remis à zéro pendant le rendu, sans effet : sinon revenir par l'historique sur la page où il était ouvert le
  // rouvrirait seul.
  const [ouvertSur, setOuvertSur] = useState<string | null>(null);
  if (ouvertSur !== null && ouvertSur !== chemin) setOuvertSur(null);
  const ouvert = ouvertSur === chemin;
  const bouton = useRef<HTMLButtonElement>(null);

  const fermer = (rendreLeFocus: boolean) => {
    setOuvertSur(null);
    if (rendreLeFocus) bouton.current?.focus();
  };

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOuvertSur(null);
        bouton.current?.focus();
      }
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [ouvert]);

  const surSortieDuFocus = (e: FocusEvent<HTMLDivElement>) => {
    const suivant = e.relatedTarget;
    if (ouvert && suivant instanceof Node && !e.currentTarget.contains(suivant)) setOuvertSur(null);
  };

  const surClicDansLeMenu = (e: MouseEvent<HTMLElement>) => {
    if (e.target instanceof Element && e.target.closest('a')) fermer(true);
  };

  return (
    <div className="lg:hidden" onBlur={surSortieDuFocus}>
      <button
        ref={bouton}
        type="button"
        className="inline-flex size-11 items-center justify-center gap-2 rounded-full border border-filet-fort text-sm font-semibold text-texte transition-[background-color] hover:bg-lin-soft min-[400px]:w-auto min-[400px]:px-4"
        onClick={() => setOuvertSur(ouvert ? null : chemin)}
        aria-expanded={ouvert}
        aria-controls="menu-mobile"
      >
        {ouvert ? iconeFermer : iconeOuvrir}
        {/* Sous 400 px, l'icône seule tient à côté du logo ; « Menu » reste le nom du bouton. */}
        <span className="sr-only min-[400px]:not-sr-only">Menu</span>
      </button>
      <div
        aria-hidden="true"
        onClick={() => fermer(false)}
        className={cx('fixed inset-x-0 top-16 bottom-0 bg-encre/40', !ouvert && 'hidden')}
      />
      <nav
        id="menu-mobile"
        aria-label="Navigation principale"
        hidden={!ouvert}
        onClick={surClicDansLeMenu}
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-filet bg-white shadow-flottante"
      >
        {children}
      </nav>
    </div>
  );
}
