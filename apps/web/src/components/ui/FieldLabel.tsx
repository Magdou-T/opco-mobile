import type { ReactNode } from 'react';

/**
 * Libellé d'un champ (Inter 600). Avec `htmlFor` c'est un <label> relié au champ ; sans lui, c'est le titre d'un groupe
 * de boutons (il porte alors l'`id` que le groupe référence). Un champ obligatoire porte un astérisque rouge et la
 * mention « (obligatoire) » pour les lecteurs d'écran ; un champ facultatif le dit en clair.
 *
 * Composant de présentation sans état ni événement, donc sans directive client. Le formulaire de contact l'importe d'ici
 * et n'embarque pas les champs du simulateur (`forms.tsx`, qui le réexporte pour ses propres importations).
 */
export function FieldLabel({
  label,
  required,
  facultatif,
  htmlFor,
  id,
}: {
  label: ReactNode;
  required?: boolean;
  facultatif?: boolean;
  htmlFor?: string;
  id?: string;
}) {
  const contenu = (
    <>
      {label}
      {required && (
        <>
          <span className="text-rouge" aria-hidden="true">
            {' '}*
          </span>
          <span className="sr-only"> (obligatoire)</span>
        </>
      )}
      {facultatif && <span className="font-normal text-texte-discret"> (facultatif)</span>}
    </>
  );
  const classe = 'block text-sm leading-snug font-semibold text-texte';
  return htmlFor ? (
    <label id={id} htmlFor={htmlFor} className={classe}>
      {contenu}
    </label>
  ) : (
    <p id={id} className={classe}>
      {contenu}
    </p>
  );
}
