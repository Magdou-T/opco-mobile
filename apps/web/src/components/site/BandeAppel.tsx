import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

/**
 * Bande d'appel à l'action de fin de page (accueil, guides) : aplat bleu de Prusse (charte financementopco, aucun
 * dégradé ni décor), titre `h2` en Newsreader blanc, phrase facultative et bouton surligneur, texte encre (11,93:1). Une
 * seule par page.
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
    <section aria-labelledby={id} className="surface-orange">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between md:py-14">
        <div className="max-w-2xl">
          <h2 id={id} className="text-titre text-white">
            {titre}
          </h2>
          {texte && <p className="mt-3 text-base text-texte-sur-prusse">{texte}</p>}
        </div>
        <Button href={href} variant="inverse" size="lg" fleche pleineLargeur="mobile" className="shrink-0">
          {libelle}
        </Button>
      </div>
    </section>
  );
}
