import type { ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Dessin d'un champ de saisie, partagé par les champs du simulateur (`forms.tsx`) et le formulaire de contact : 48 px de
 * haut, rayon 12 px (`rounded-champ`), contour filet-fort (3,54:1 sur blanc), contour orange foncé au focus (en plus de
 * l'anneau du site), rouge quand la saisie est refusée. La couleur du texte d'exemple (placeholder) vient de la règle
 * globale du site (globals.css). Transition sans `outline-color` : l'anneau de focus apparaît d'emblée (DESIGN.md,
 * section 7). Module sans directive client ni état : le formulaire de contact n'embarque pas les champs du simulateur.
 */
export const CHAMP =
  'block min-h-12 w-full rounded-champ border border-filet-fort bg-white px-4 py-2.5 text-base text-texte transition-[color,background-color,border-color] hover:border-texte-doux focus-visible:border-orange-deep aria-invalid:border-rouge';

/**
 * Zone de l'erreur d'un champ, entre son libellé et lui : elle existe toujours, pour que l'erreur soit annoncée
 * (poliment) quand elle apparaît ; l'erreur porte l'`id` que le champ cite dans `aria-describedby`.
 */
export function ZoneErreur({ id, erreur }: { id: string; erreur: ReactNode }) {
  return (
    <div aria-live="polite" className="[&:not(:empty)]:mt-2">
      {erreur ? (
        <p id={id} className="flex items-start gap-1.5 text-sm leading-snug font-medium text-rouge">
          <Icon name="alerte" className="mt-px size-4 shrink-0" strokeWidth={2} />
          <span>
            <span className="sr-only">Erreur : </span>
            {erreur}
          </span>
        </p>
      ) : null}
    </div>
  );
}
