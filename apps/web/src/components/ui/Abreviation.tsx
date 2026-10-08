import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { definirAbreviations } from '@/lib/sigles';

/**
 * Sigle défini à sa première occurrence par une infobulle (`<abbr title>`), souligné en pointillé. Module léger (sans
 * lib/fiche.ts) : le simulateur et l'écran de résultats l'importent.
 */
export function Abreviation({ definition, children }: { definition: string; children: ReactNode }) {
  return (
    <abbr
      title={definition}
      className="cursor-help underline decoration-texte-discret decoration-dotted underline-offset-[0.2em]"
    >
      {children}
    </abbr>
  );
}

/** Texte rendu à l'identique, chaque sigle de `sigles` défini à sa première occurrence (`definirAbreviations`). */
export function TexteAvecSigles({ texte, sigles }: { texte: string; sigles: Readonly<Record<string, string>> }) {
  return (
    <>
      {definirAbreviations(texte, sigles).map((m, i) =>
        m.genre === 'texte' ? (
          <Fragment key={i}>{m.valeur}</Fragment>
        ) : (
          <Abreviation key={i} definition={m.definition}>
            {m.valeur}
          </Abreviation>
        ),
      )}
    </>
  );
}
