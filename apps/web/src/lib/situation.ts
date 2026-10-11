// ============================================================
// En-tête de l'écran de résultats : étiquettes de la situation. Fonction pure, sans le catalogue d'aides ni le calcul :
// elle est dans le lot initial du simulateur, pour que l'attente du chargement affiche déjà l'en-tête réel (aucun saut
// de mise en page quand l'écran arrive). Tests : tests/resultats.test.ts.
// ============================================================

import { PROJET_LABELS, REGIONS, estCodeRegion, getEmbeddedOpcoBySlug, nombreDePersonnes } from '@opco/core';
import type { WizardState } from '@opco/core';
import { nombreEtUnite } from './format';

/**
 * Étiquettes de la situation : projet, OPCO retenu, région de l'entreprise, durée de la formation, puis le groupe quand il
 * compte plusieurs personnes (« 5 personnes », « 5 personnes · 2 profils »). Mêmes règles que le calcul de l'écran
 * (`calculer`, lib/resultats.ts) : projet non choisi « Former un salarié », OPCO choisi sinon détecté, région reconnue par
 * le moteur seulement ; une donnée absente n'a pas d'étiquette. La durée s'écrit comme au récapitulatif (`nombreEtUnite` :
 * « 1 500 h »).
 */
export function etiquettesDeSituation(
  state: Pick<
    WizardState,
    'projetType' | 'selectedOpcoSlug' | 'detectedOpcoSlug' | 'regionCode' | 'durationHours' | 'nombrePersonnes' | 'autresProfils'
  >,
): string[] {
  const slug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = slug ? getEmbeddedOpcoBySlug(slug) : undefined;
  const projet = state.projetType ?? 'formation_salarie';
  const personnes = nombreDePersonnes(state);
  const profils = 1 + (state.autresProfils?.length ?? 0);
  return [
    PROJET_LABELS[projet].label,
    opco?.name,
    estCodeRegion(state.regionCode) ? REGIONS[state.regionCode] : null,
    state.durationHours ? nombreEtUnite(state.durationHours, 'h') : null,
    personnes > 1
      ? `${nombreEtUnite(personnes, 'personnes')}${profils > 1 ? ` · ${nombreEtUnite(profils, 'profils')}` : ''}`
      : null,
  ].filter((e): e is string => !!e);
}
