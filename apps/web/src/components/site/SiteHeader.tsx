'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Logo } from '@/components/site/Logo';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

const NAV = [
  { href: '/simulateur', label: 'Simulateur' },
  { href: '/comprendre-les-opco', label: 'Comprendre les OPCO' },
  { href: '/obligations', label: 'Vos obligations' },
  { href: '/former-sans-budget', label: 'Se former sans budget' },
  { href: '/opco', label: 'Les 11 OPCO' },
  { href: '/contact', label: 'Nous contacter' },
];

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

/** Page active : l'adresse elle-même ou une de ses sous-pages (export avec barre oblique finale). */
function estActive(chemin: string, href: string): boolean {
  const c = chemin.length > 1 ? chemin.replace(/\/+$/, '') : chemin;
  return c === href || c.startsWith(`${href}/`);
}

/**
 * En-tête collant. Grand écran (≥ 1024 px) : logo et bouton principal, puis la navigation sur une seconde ligne
 * (pilule sur la page active). Petit écran : logo et bouton « Menu » qui ouvre la navigation (aria-expanded,
 * fermeture par Échap, par un clic hors du menu ou sur un lien ; le focus revient alors au bouton).
 */
export function SiteHeader() {
  const chemin = usePathname() ?? '/';
  const surLeSimulateur = estActive(chemin, '/simulateur');
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);

  const fermer = (rendreLeFocus: boolean) => {
    setOuvert(false);
    if (rendreLeFocus) bouton.current?.focus();
  };

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOuvert(false);
        bouton.current?.focus();
      }
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [ouvert]);

  return (
    <header className="entete-site sticky top-0 z-50 border-b border-filet bg-white print:hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-[4.5rem]">
        {/* La visibilité selon la largeur se règle sur des enveloppes : une classe d'affichage passée au composant
            entrerait en conflit avec son propre `inline-flex`. */}
        <Link href="/" className="-m-1.5 rounded-xl p-1.5" onClick={() => setOuvert(false)}>
          <span className="block lg:hidden">
            <Logo taille="compacte" />
          </span>
          <span className="hidden lg:block">
            <Logo />
          </span>
        </Link>

        {/* Sur la page du simulateur, le bouton principal mènerait à la page en cours : il s'efface. */}
        {!surLeSimulateur && (
          <div className="hidden lg:block">
            <Button href="/simulateur" size="md" fleche>
              Estimer mon financement
            </Button>
          </div>
        )}

        <button
          ref={bouton}
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-filet-fort/50 px-4 text-sm font-semibold text-texte transition-colors hover:bg-lin-soft lg:hidden"
          onClick={() => setOuvert((v) => !v)}
          aria-expanded={ouvert}
          aria-controls="menu-mobile"
        >
          <Icon name={ouvert ? 'fermer' : 'menu'} className="size-5" />
          Menu
        </button>
      </div>

      {/* Navigation grand écran : seconde ligne */}
      <nav aria-label="Navigation principale" className="hidden border-t border-filet/70 lg:block">
        <ul className="mx-auto flex h-12 max-w-6xl items-center gap-1 px-4 sm:px-6">
          {NAV.map((item, i) => {
            const actif = estActive(chemin, item.href);
            return (
              <li key={item.href} className={cx(i === 0 && '-ml-3')}>
                <Link
                  href={item.href}
                  aria-current={actif ? 'page' : undefined}
                  className={cx(
                    'inline-flex h-9 items-center gap-2 rounded-full px-3 text-[0.9375rem] font-medium transition-colors',
                    actif ? 'bg-lin font-semibold text-texte' : 'text-texte-doux hover:bg-lin-soft hover:text-texte',
                  )}
                >
                  {actif && <span aria-hidden="true" className="size-1.5 rounded-full bg-orange" />}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Navigation petit écran */}
      <div
        aria-hidden="true"
        onClick={() => fermer(false)}
        className={cx('fixed inset-x-0 top-16 bottom-0 bg-encre/40 lg:hidden', !ouvert && 'hidden')}
      />
      <nav
        id="menu-mobile"
        aria-label="Navigation principale"
        hidden={!ouvert}
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-filet bg-white shadow-flottante lg:hidden"
      >
        <ul className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          {NAV.map((item) => {
            const actif = estActive(chemin, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={actif ? 'page' : undefined}
                  onClick={() => fermer(true)}
                  className={cx(
                    'flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-medium transition-colors',
                    actif ? 'bg-lin font-semibold text-texte' : 'text-texte-doux hover:bg-lin-soft hover:text-texte',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx('size-1.5 shrink-0 rounded-full', actif ? 'bg-orange' : 'bg-filet-fort/40')}
                  />
                  <span className="flex-1">{item.label}</span>
                  <Icon name="chevron" className="size-4 text-texte-discret" />
                </Link>
              </li>
            );
          })}
        </ul>
        {!surLeSimulateur && (
          <div className="mx-auto max-w-6xl border-t border-filet px-4 pt-4 pb-5 sm:px-6">
            <Button href="/simulateur" size="lg" fleche pleineLargeur onClick={() => fermer(true)}>
              Estimer mon financement
            </Button>
          </div>
        )}
      </nav>
    </header>
  );
}
