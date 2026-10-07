import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

/**
 * Encadré d'information. Le ton se lit dans le titre et dans un préfixe réservé aux lecteurs d'écran (« Alerte : »…) ;
 * la couleur et l'icône ne font que l'appuyer. Contenu statique : pas de role="alert" (réservé aux messages qui
 * apparaissent en cours d'usage).
 *
 * - info : fond lin, pastille turquoise foncé.
 * - confirmation : fond turquoise doux, coche.
 * - avertissement : fond or doux, pastille or à glyphe encre (9,37:1).
 * - alerte : fond rouge doux, pastille rouge à glyphe blanc (6,39:1).
 *
 * Titre en texte (#1A1A1A) et corps en texte doux : au moins 7:1 sur chacun des quatre fonds.
 * Voir apps/web/DESIGN.md (Primitives).
 */
export type CalloutTone = 'info' | 'confirmation' | 'avertissement' | 'alerte';

export interface CalloutProps {
  tone?: CalloutTone;
  titre?: ReactNode;
  /** Remplace l'icône du ton. */
  icone?: IconName;
  as?: 'div' | 'aside';
  className?: string;
  children: ReactNode;
}

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const TONS: Record<CalloutTone, { surface: string; pastille: string; icone: IconName; prefixe: string }> = {
  info: {
    surface: 'border-filet bg-lin-soft',
    pastille: 'bg-turquoise-deep text-white',
    icone: 'info',
    prefixe: 'Information :',
  },
  confirmation: {
    surface: 'border-turquoise/30 bg-turquoise-soft',
    pastille: 'bg-turquoise-deep text-white',
    icone: 'coche',
    prefixe: 'Confirmation :',
  },
  avertissement: {
    surface: 'border-or/60 bg-or-soft',
    pastille: 'bg-or text-encre',
    icone: 'alerte',
    prefixe: 'Avertissement :',
  },
  alerte: {
    surface: 'border-rouge/25 bg-rouge-soft',
    pastille: 'bg-rouge text-white',
    icone: 'alerte',
    prefixe: 'Alerte :',
  },
};

export function Callout({ tone = 'info', titre, icone, as: Balise = 'div', className, children }: CalloutProps) {
  const t = TONS[tone];
  const prefixe = <span className="sr-only">{t.prefixe} </span>;
  const aUnTitre = titre !== undefined && titre !== null && titre !== false && titre !== '';
  return (
    <Balise className={cx('flex gap-3.5 rounded-2xl border p-4 sm:p-5', t.surface, className)}>
      <span aria-hidden="true" className={cx('mt-px grid size-8 shrink-0 place-items-center rounded-full', t.pastille)}>
        <Icon name={icone ?? t.icone} className="size-[18px]" strokeWidth={2} />
      </span>
      <div className="min-w-0 pt-1">
        {aUnTitre && (
          <p className="font-display text-[0.9375rem] leading-snug font-bold text-texte">
            {prefixe}
            {titre}
          </p>
        )}
        <div className={cx('text-sm leading-relaxed text-texte-doux', aUnTitre && 'mt-1')}>
          {!aUnTitre && prefixe}
          {children}
        </div>
      </div>
    </Balise>
  );
}
