'use client';

import { useEffect, useRef, useState } from 'react';
import { cx } from '@/lib/cx';
import { Icon } from '@/components/ui/Icon';

export interface EntreeSommaire {
  /** Identifiant de la section visée (ancre). */
  id: string;
  libelle: string;
  /** Nombre d'alertes d'une fiche, affiché en pastille rouge après le libellé. */
  compte?: number;
}

/** « 1 alerte », « 12 alertes » : le nombre de la pastille, pour les lecteurs d'écran. */
function nombreDAlertes(n: number): string {
  return `${n} ${n > 1 ? 'alertes' : 'alerte'}`;
}

/**
 * Sommaire d'une page longue (fiches OPCO, guides) : une seule navigation, nommée par `etiquette`.
 * - Sous 1 024 px : liste repliée dans un bloc « Sommaire » (`<details>`), en tête du contenu.
 * - À partir de 1 024 px : colonne collante sous l'en-tête (`.sommaire-collant`), la section à l'écran signalée
 *   (pilule lin et point orange, `aria-current="location"`).
 * Un lien suit l'ancre comme d'habitude (défilement natif, `scroll-padding-top` compte l'en-tête) ; le bloc replié se
 * referme, puis le focus passe au titre de la section (rendu focalisable par programme s'il ne l'est pas) : la lecture
 * au clavier ou au lecteur d'écran reprend là. Seule l'interaction justifie le code client : les liens sont rendus
 * par le serveur et fonctionnent sans JavaScript.
 */
export function Sommaire({
  entrees,
  etiquette,
  titre = 'Sommaire',
  numerote = false,
  className,
}: {
  entrees: EntreeSommaire[];
  etiquette: string;
  titre?: string;
  /** Numéros « 01 », « 02 »… devant les libellés (sections numérotées des guides). */
  numerote?: boolean;
  className?: string;
}) {
  const [actif, setActif] = useState<string | null>(null);
  const bloc = useRef<HTMLDetailsElement>(null);

  // Section active : la dernière dont le haut a passé le tiers supérieur de l'écran ; en bas de page, la dernière.
  useEffect(() => {
    const cibles = entrees
      .map((e) => document.getElementById(e.id))
      .filter((c): c is HTMLElement => c !== null);
    if (cibles.length === 0) return;
    let image = 0;
    const mesurer = () => {
      image = 0;
      const seuil = window.innerHeight * 0.3;
      let courant: string | null = null;
      for (const c of cibles) if (c.getBoundingClientRect().top <= seuil) courant = c.id;
      const enBas = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      setActif(enBas ? cibles[cibles.length - 1].id : courant);
    };
    const planifier = () => {
      if (!image) image = window.requestAnimationFrame(mesurer);
    };
    planifier();
    window.addEventListener('scroll', planifier, { passive: true });
    window.addEventListener('resize', planifier);
    return () => {
      window.removeEventListener('scroll', planifier);
      window.removeEventListener('resize', planifier);
      if (image) window.cancelAnimationFrame(image);
    };
  }, [entrees]);

  const aller = (id: string) => () => {
    // Replié avant le défilement natif : la cible est mesurée à sa position définitive.
    if (bloc.current?.open) bloc.current.open = false;
    window.setTimeout(() => {
      const section = document.getElementById(id);
      if (!section) return;
      const titre = section.matches('h1, h2, h3') ? section : section.querySelector<HTMLElement>('h2, h3');
      const cible = titre ?? section;
      if (!cible.hasAttribute('tabindex')) cible.setAttribute('tabindex', '-1');
      cible.focus({ preventScroll: true });
    }, 0);
  };

  const liste = (replie: boolean) => (
    <ol className={cx('space-y-0.5', replie && 'py-1')}>
      {entrees.map((e, i) => {
        const estActif = !replie && actif === e.id;
        return (
          <li key={e.id}>
            <a
              href={`#${e.id}`}
              onClick={aller(e.id)}
              aria-current={estActif ? 'location' : undefined}
              className={cx(
                'flex items-start gap-2.5 rounded-xl px-3 text-sm leading-snug transition-[color,background-color]',
                replie ? 'min-h-11 items-center py-2' : 'py-2',
                estActif ? 'bg-lin font-semibold text-texte' : 'text-texte-doux hover:bg-lin-soft hover:text-texte',
              )}
            >
              {numerote ? (
                <span className="amount mt-px w-5 shrink-0 text-xs text-texte-discret">{String(i + 1).padStart(2, '0')}</span>
              ) : (
                <span
                  aria-hidden="true"
                  className={cx('mt-[0.45em] size-1.5 shrink-0 rounded-full', estActif ? 'bg-orange' : 'bg-filet-fort/60')}
                />
              )}
              <span className="min-w-0 flex-1">{e.libelle}</span>
              {/* Pastille muette, nombre dit en toutes lettres : le nom du lien est « Alertes (12 alertes) », pas
                  « Alertes12 ». */}
              {e.compte != null && (
                <>
                  <span
                    aria-hidden="true"
                    className="shrink-0 rounded-full bg-rouge-soft px-2 text-xs leading-5 font-semibold text-rouge"
                  >
                    {e.compte}
                  </span>
                  <span className="sr-only"> ({nombreDAlertes(e.compte)})</span>
                </>
              )}
            </a>
          </li>
        );
      })}
    </ol>
  );

  return (
    <nav aria-label={etiquette} className={cx('print:hidden', className)}>
      <details ref={bloc} className="group/sommaire rounded-carte border border-filet bg-white shadow-douce lg:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-carte px-4 py-3 font-semibold text-texte [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2.5">
            <Icon name="menu" className="size-5 text-turquoise-deep" />
            {titre}
          </span>
          <Icon name="chevron" className="size-4 rotate-90 text-texte-discret transition-transform duration-200 group-open/sommaire:-rotate-90" strokeWidth={2} />
        </summary>
        <div className="border-t border-filet px-2 pb-2">{liste(true)}</div>
      </details>
      <div className="sommaire-collant hidden lg:block">
        <p className="surtitre mb-3 pl-3">{titre}</p>
        {liste(false)}
      </div>
    </nav>
  );
}
