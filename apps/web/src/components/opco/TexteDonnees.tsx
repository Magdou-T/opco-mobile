import { Fragment } from 'react';
import { definirAbreviations } from '@/lib/fiche';
import { texteDonnees } from '@/lib/format';

/**
 * Texte des données affiché sur une fiche OPCO : dates JJ/MM/AAAA, montants et typographie à la française
 * (`texteDonnees`, jamais à l'intérieur d'un extrait cité « … »), et sigles vérifiés sur la page officielle de l'OPCO
 * définis à leur première occurrence (`<abbr title>`). Les données ne sont pas modifiées : seul l'affichage change.
 */
export function TexteDonnees({ texte, sigles }: { texte: string; sigles?: Readonly<Record<string, string>> }) {
  const affiche = texteDonnees(texte);
  if (!sigles) return <>{affiche}</>;
  return (
    <>
      {definirAbreviations(affiche, sigles).map((m, i) =>
        m.genre === 'texte' ? (
          <Fragment key={i}>{m.valeur}</Fragment>
        ) : (
          <abbr
            key={i}
            title={m.definition}
            className="cursor-help underline decoration-texte-discret decoration-dotted underline-offset-[0.2em]"
          >
            {m.valeur}
          </abbr>
        ),
      )}
    </>
  );
}
