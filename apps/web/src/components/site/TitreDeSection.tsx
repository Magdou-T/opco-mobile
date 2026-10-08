import type { ReactNode } from 'react';

/**
 * Titre de section des pages de contenu (fiches OPCO, guides) : `h2` Montserrat 700 de 28 à 32 px, plus mesuré que
 * `text-titre` (40 px à 1 280 px) parce qu'une fiche compte jusqu'à sept sections ; focalisable par programme (le
 * sommaire y pose le focus) ; chapeau facultatif. La section le surmonte de son filet ponctué d'orange (`.rule-double`).
 * Voir apps/web/DESIGN.md, section 16.
 */
export function TitreDeSection({ id, titre, chapeau }: { id: string; titre: ReactNode; chapeau?: ReactNode }) {
  return (
    <div className="max-w-3xl">
      <h2
        id={id}
        tabIndex={-1}
        className="rounded-md text-[1.75rem] leading-[1.15] font-bold tracking-[-0.025em] break-words text-texte sm:text-[2rem]"
      >
        {titre}
      </h2>
      {chapeau && <p className="mt-3 max-w-2xl text-chapeau text-texte-doux">{chapeau}</p>}
    </div>
  );
}
