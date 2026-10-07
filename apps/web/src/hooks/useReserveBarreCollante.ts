'use client';

import { useEffect } from 'react';
import type { RefObject } from 'react';
import { VARIABLE_RESERVE, focusSousLaBarre, reserveDeLaBarre } from '@/lib/barreCollante';

/**
 * Barre de navigation collée au bas de l'écran (sous 1 024 px, hors récapitulatif) : WCAG 2.2, critère 2.4.11, aucun
 * contrôle qui a le focus ne passe dessous. Règle : apps/web/DESIGN.md, section 14.
 *
 * - Réserve : la hauteur réelle de la barre, plus 8 px d'air pour l'anneau de focus, est posée dans la variable
 *   `--reserve-barre-simulateur` de `html` ; `globals.css` en tire `scroll-padding-bottom` (un contrôle qui reçoit le
 *   focus s'arrête au-dessus de la barre) et, en négatif, le `scroll-margin-bottom` des contrôles de la barre (le focus
 *   qui y entre ou en sort ne fait plus sauter la page vers la position statique de la barre). Mesurée à chaque
 *   changement de taille de la barre (phrase d'aide qui s'allonge, zone de sécurité, texte agrandi), jamais écrite en
 *   dur ; retirée quand la barre ne colle plus et au démontage, sans toucher la réserve d'un autre élément.
 * - Focus : quand la barre grandit ou que le contenu de l'étape change de taille (erreur affichée au-dessus d'un champ
 *   pendant la frappe), le contrôle qui a le focus, s'il passe sous la barre, remonte juste au-dessus
 *   (`scrollIntoView({ block: 'nearest' })`, qui respecte la réserve).
 *
 * `cle` : valeur qui change quand la barre peut changer de disposition (affichage des résultats, dernière étape).
 */
export function useReserveBarreCollante(
  barre: RefObject<HTMLElement | null>,
  contenu: RefObject<HTMLElement | null>,
  cle: string,
): void {
  useEffect(() => {
    const element = barre.current;
    if (!element) return;
    const racine = document.documentElement;
    const zone = contenu.current;
    const colle = () => getComputedStyle(element).position === 'sticky';

    const garderLeFocusVisible = () => {
      const actif = document.activeElement;
      if (!(actif instanceof HTMLElement) || !(zone?.contains(actif) || element.contains(actif))) return;
      const bas = actif.getBoundingClientRect().bottom;
      if (focusSousLaBarre(bas, element.getBoundingClientRect().top, element.contains(actif), colle())) {
        actif.scrollIntoView({ block: 'nearest' });
      }
    };

    const reserver = () => {
      if (colle()) racine.style.setProperty(VARIABLE_RESERVE, `${reserveDeLaBarre(element.getBoundingClientRect().height)}px`);
      else racine.style.removeProperty(VARIABLE_RESERVE);
      garderLeFocusVisible();
    };

    reserver();
    const observateurBarre = new ResizeObserver(reserver);
    observateurBarre.observe(element);
    const observateurContenu = new ResizeObserver(garderLeFocusVisible);
    if (zone) observateurContenu.observe(zone);
    const grandEcran = window.matchMedia('(min-width: 64rem)');
    grandEcran.addEventListener('change', reserver);
    return () => {
      observateurBarre.disconnect();
      observateurContenu.disconnect();
      grandEcran.removeEventListener('change', reserver);
      racine.style.removeProperty(VARIABLE_RESERVE);
    };
  }, [barre, contenu, cle]);
}
