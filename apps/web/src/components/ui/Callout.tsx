import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
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

/* Charte financementopco : pas d'icône dans une pastille colorée ; le ton se lit au trait vertical de gauche (3 px) et
   au fond, et le préfixe caché le dit aux lecteurs d'écran. `icone` reste accepté pour compatibilité, sans effet. */
const TONS: Record<CalloutTone, { surface: string; prefixe: string }> = {
  info: { surface: 'border-prusse bg-white', prefixe: 'Information :' },
  confirmation: { surface: 'border-ardoise bg-white', prefixe: 'Confirmation :' },
  avertissement: { surface: 'border-encre bg-surligneur-doux', prefixe: 'Avertissement :' },
  alerte: { surface: 'border-rouge bg-rouge-soft', prefixe: 'Alerte :' },
};

export function Callout({ tone = 'info', titre, as: Balise = 'div', className, children }: CalloutProps) {
  const t = TONS[tone];
  const prefixe = <span className="sr-only">{t.prefixe} </span>;
  const aUnTitre = titre !== undefined && titre !== null && titre !== false && titre !== '';
  return (
    <Balise className={cx('rounded-[3px] border-l-[3px] px-4 py-3.5 sm:px-5 sm:py-4', t.surface, className)}>
      {aUnTitre && (
        <p className="text-[0.9375rem] leading-snug font-semibold text-texte">
          {prefixe}
          {titre}
        </p>
      )}
      <div className={cx('text-sm leading-relaxed text-texte-doux', aUnTitre && 'mt-1')}>
        {!aUnTitre && prefixe}
        {children}
      </div>
    </Balise>
  );
}
