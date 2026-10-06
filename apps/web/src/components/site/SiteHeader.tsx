'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV = [
  { href: '/simulateur', label: 'Simulateur' },
  { href: '/comprendre-les-opco', label: 'Comprendre les OPCO' },
  { href: '/obligations', label: 'Vos obligations' },
  { href: '/former-sans-budget', label: 'Se former sans budget' },
  { href: '/opco', label: 'Les 11 OPCO' },
  { href: '/contact', label: 'Nous contacter' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-ink bg-paper print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2" onClick={() => setOpen(false)}>
          <span className="font-display text-xl font-800 font-extrabold tracking-tight">
            financement<span className="text-cobalt">OPCO</span>
          </span>
          <span className="marginalia hidden sm:inline">financement formation · 2026</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/')) || (item.href === '/opco' && pathname.startsWith('/opco'));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-ink text-paper'
                    : 'text-ink-soft hover:bg-paper-deep hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile toggle */}
        <button
          type="button"
          className="rounded border border-ink px-3 py-1.5 text-sm font-medium lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          Menu
        </button>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          className="border-t border-rule px-4 py-2 lg:hidden"
          aria-label="Navigation mobile"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded px-2 py-2.5 text-sm font-medium text-ink-soft hover:bg-paper-deep hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
