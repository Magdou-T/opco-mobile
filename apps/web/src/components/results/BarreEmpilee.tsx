import { cx } from '@/lib/cx';
import { typo } from '@/lib/format';
import { descriptionBarre, libellePart } from '@/lib/resultats';
import type { PartBarre } from '@/lib/resultats';
import { BORD_SEGMENT, COULEURS_FAMILLE, COULEURS_IMPRIMEES, SEGMENT_RESTE } from './Financeur';

/**
 * Barre horizontale empilée : une part par famille de financeurs puis le reste à charge (hachures). Jamais seule porteuse
 * d'information : son nom accessible (role="img") et la légende écrite donnent chaque part avec son libellé ; les
 * largeurs suivent les montants (au moins 6 px pour une part minuscule).
 */
export function BarreEmpilee({ parts, cout }: { parts: PartBarre[]; cout: number }) {
  if (parts.length === 0) return null;
  return (
    <figure className={cx('mt-7', COULEURS_IMPRIMEES)}>
      <div role="img" aria-label={descriptionBarre(parts, cout)} className="devoilement flex h-4 gap-0.5 sm:h-5">
        {parts.map((p) => (
          <span
            key={p.cle}
            className={cx('h-full min-w-1.5 first:rounded-l-full last:rounded-r-full', classeDePart(p))}
            style={{ flexGrow: Math.round(p.montant * 100), flexBasis: 0 }}
          />
        ))}
      </div>
      <figcaption className="mt-3.5">
        <ul role="list" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {parts.map((p) => (
            <li key={p.cle} className="inline-flex items-center gap-2">
              <span aria-hidden="true" className={cx('size-3 shrink-0 rounded-[0.25rem]', classeDePart(p))} />
              <span className="font-semibold text-texte">{typo(p.libelle)}</span>
              <span className="text-texte-doux tabular-nums">{libellePart(p)}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

const classeDePart = (p: PartBarre): string =>
  p.cle === 'reste' ? SEGMENT_RESTE : cx(COULEURS_FAMILLE[p.cle].fond, BORD_SEGMENT);
