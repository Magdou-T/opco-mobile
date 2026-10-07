'use client';

import { useEffect } from 'react';

/**
 * Blocs repliables (`<details>`) d'une fiche OPCO, sans rien rendre :
 * - quand l'adresse porte l'ancre d'un bloc (`/opco/akto/#hcr`, branche HCR) ou d'un élément qu'il contient, le bloc
 *   s'ouvre, au chargement et à chaque changement d'ancre ; sinon tout reste replié ;
 * - à l'impression, tous les blocs s'ouvrent (précisions, branches, listes de conventions), puis reprennent leur état.
 */
export function OuvertureDesDetails() {
  useEffect(() => {
    const ouvrirLaCible = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const cible = id ? document.getElementById(id) : null;
      if (!cible) return;
      let bloc: HTMLDetailsElement | null = cible instanceof HTMLDetailsElement ? cible : cible.closest('details');
      let ouvert = false;
      while (bloc) {
        if (!bloc.open) {
          bloc.open = true;
          ouvert = true;
        }
        bloc = bloc.parentElement?.closest('details') ?? null;
      }
      // Une cible à l'intérieur d'un bloc fermé n'avait pas de position : elle revient à l'écran une fois le bloc ouvert.
      if (ouvert && !(cible instanceof HTMLDetailsElement)) cible.scrollIntoView();
    };
    const fermesAvantImpression = new Set<HTMLDetailsElement>();
    const avantImpression = () => {
      document.querySelectorAll('details').forEach((d) => {
        if (!d.open) {
          fermesAvantImpression.add(d);
          d.open = true;
        }
      });
    };
    const apresImpression = () => {
      fermesAvantImpression.forEach((d) => {
        d.open = false;
      });
      fermesAvantImpression.clear();
    };
    ouvrirLaCible();
    window.addEventListener('hashchange', ouvrirLaCible);
    window.addEventListener('beforeprint', avantImpression);
    window.addEventListener('afterprint', apresImpression);
    return () => {
      window.removeEventListener('hashchange', ouvrirLaCible);
      window.removeEventListener('beforeprint', avantImpression);
      window.removeEventListener('afterprint', apresImpression);
    };
  }, []);
  return null;
}
