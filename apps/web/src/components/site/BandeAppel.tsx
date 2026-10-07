import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

/**
 * Bande d'appel à l'action de fin de page (accueil, guides) : surface orange en dégradé (texte blanc, 4,65:1 au point le
 * plus clair), rail et jalons décoratifs à droite à partir de 768 px, titre `h2`, phrase facultative et bouton inverse
 * (pilule blanche). Une seule par page, jamais à moins d'un écran d'une autre zone en dégradé (DESIGN.md, section 6).
 */
export function BandeAppel({
  id,
  titre,
  texte,
  href = '/simulateur/',
  libelle,
}: {
  /** Identifiant du titre (la section s'y rattache par aria-labelledby). */
  id: string;
  titre: ReactNode;
  texte?: ReactNode;
  href?: string;
  libelle: string;
}) {
  return (
    <section aria-labelledby={id} className="surface-orange relative overflow-hidden">
      <div aria-hidden="true" className="decor pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] md:block">
        <span className="absolute top-1/2 right-[-3rem] left-0 h-1.5 -translate-y-1/2 rounded-full bg-white/20" />
        {[12, 46, 80].map((x) => (
          <span
            key={x}
            className="absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/70 bg-orange-deep"
            style={{ left: `${x}%` }}
          />
        ))}
      </div>
      <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between md:py-14">
        <div className="max-w-xl">
          <h2 id={id} className="text-titre font-bold">
            {titre}
          </h2>
          {texte && <p className="mt-3 text-chapeau text-white">{texte}</p>}
        </div>
        <Button href={href} variant="inverse" size="lg" fleche pleineLargeur="mobile" className="shrink-0">
          {libelle}
        </Button>
      </div>
    </section>
  );
}
