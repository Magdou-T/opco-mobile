'use client';

import { PROJET_LABELS } from '@opco/core';
import type { ProjetType, WizardState } from '@opco/core';
import { Icon } from '@/components/ui/Icon';
import { IndicateurChoix } from '@/components/ui/forms';
import { cx } from '@/lib/cx';
import { etatDepuisProjet } from '@/lib/parcours';
import { EnTeteEtape, ID_TITRE_ETAPE } from './EnTeteEtape';
import { ICONES_PROJET } from './libelles';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
}

const PROJETS = Object.entries(PROJET_LABELS) as [ProjetType, { label: string; description: string }][];

/**
 * Étape 1 : le projet oriente les questions posées au bénéficiaire et les aides recherchées. Une grande carte par
 * projet (bouton bascule, aria-pressed), une colonne sur mobile, deux au-delà de 640 px ; le groupe porte le nom du
 * titre de l'étape. Changer de projet efface les réponses propres à un autre statut (etatDepuisProjet).
 */
export function StepProjet({ state, updateState }: Props) {
  return (
    <div className="space-y-8">
      <EnTeteEtape
        etape="projet"
        titre="Votre projet"
        chapeau="Choisissez votre situation : le site recherche toutes les aides et tous les financements qui peuvent s'y appliquer."
      />

      <div role="group" aria-labelledby={ID_TITRE_ETAPE} className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {PROJETS.map(([projet, { label, description }]) => {
          const choisi = state.projetType === projet;
          return (
            <button
              key={projet}
              type="button"
              aria-pressed={choisi}
              onClick={() => updateState(etatDepuisProjet(state, projet))}
              className={cx(
                'group relative flex h-full w-full items-start gap-4 rounded-carte border p-4 text-left transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out sm:p-5',
                choisi
                  ? 'border-orange-deep bg-orange-soft ring-1 ring-orange-deep ring-inset'
                  : 'border-filet bg-white shadow-douce hover:-translate-y-0.5 hover:border-orange/45 hover:shadow-flottante',
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  'grid size-12 shrink-0 place-items-center rounded-2xl transition-colors',
                  choisi ? 'bg-white text-orange-deep' : 'bg-turquoise-soft text-turquoise-deep',
                )}
              >
                <Icon name={ICONES_PROJET[projet]} className="size-6" />
              </span>
              <span className="min-w-0 flex-1 pr-7">
                <span className="block font-display text-base leading-snug font-bold tracking-[-0.01em] text-texte sm:text-[1.0625rem]">
                  {label}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-texte-doux">{description}</span>
              </span>
              <IndicateurChoix selectionne={choisi} className="absolute top-4 right-4 sm:top-5 sm:right-5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
