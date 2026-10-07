'use client';

import type { ReactNode } from 'react';
import type { TransportMode, WizardState } from '@opco/core';
import type { IconName } from '@/components/ui/Icon';
import { CheckboxRow, ChoiceButton, ChoiceGroup, NumberField } from '@/components/ui/forms';
import { EnTeteEtape } from './EnTeteEtape';
import { TRANSPORT_LABELS } from './libelles';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
}

/** Besoin de frais (case à cocher en carte) et, quand il est coché, ses montants dans un panneau relié par un rail. */
function BlocFrais({
  icone,
  label,
  description,
  checked,
  onToggle,
  children,
}: {
  icone: IconName;
  label: string;
  description: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <CheckboxRow icone={icone} label={label} description={description} checked={checked} onToggle={onToggle} />
      {checked && (
        <div className="ml-6 space-y-5 border-l-2 border-orange-deep/40 pt-4 pb-1 pl-5 sm:ml-8 sm:pl-6">{children}</div>
      )}
    </div>
  );
}

/** Étape 5 (sautée pour une formation à distance) : frais de déplacement, d'hébergement et de repas, tous facultatifs. */
export function StepFrais({ state, updateState }: Props) {
  // Jours de formation estimés sur une base de 7 heures par jour, retenus quand le champ reste vide.
  const joursEstimes = state.durationHours ? Math.ceil(state.durationHours / 7) : 0;

  return (
    <div className="space-y-8">
      <EnTeteEtape
        etape="frais"
        titre="Frais annexes"
        chapeau="Si la formation oblige à se déplacer, indiquez les frais prévus. Certains OPCO prennent en charge tout ou partie de ces frais."
      />

      <NumberField
        label="Nombre de jours de formation"
        facultatif
        value={state.trainingDays}
        onChange={(trainingDays) => updateState({ trainingDays })}
        min={1}
        placeholder={joursEstimes > 0 ? `Ex : ${joursEstimes}` : 'Ex : 5'}
        helper={
          joursEstimes > 0
            ? `Sans saisie, ${joursEstimes} ${joursEstimes > 1 ? 'jours sont retenus' : 'jour est retenu'} (7 heures par jour).`
            : undefined
        }
      />

      <div className="space-y-4">
        <BlocFrais
          icone="train"
          label="J'ai besoin d'un déplacement"
          description="Trajet entre le lieu de travail ou le domicile et le lieu de formation."
          checked={state.needsTransport}
          onToggle={(needsTransport) => updateState({ needsTransport })}
        >
          <ChoiceGroup label="Mode de transport">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.entries(TRANSPORT_LABELS) as [TransportMode, string][]).map(([mode, libelle]) => (
                <ChoiceButton
                  key={mode}
                  label={libelle}
                  selected={state.transportMode === mode}
                  onClick={() => updateState({ transportMode: mode })}
                  compact
                />
              ))}
            </div>
          </ChoiceGroup>
          <NumberField
            label="Distance estimée (km)"
            facultatif
            value={state.transportDistanceKm}
            onChange={(transportDistanceKm) => updateState({ transportDistanceKm })}
            placeholder="Ex : 250"
          />
        </BlocFrais>

        <BlocFrais
          icone="lit"
          label="J'ai besoin d'un hébergement"
          description="Nuits sur place quand la formation est loin du domicile."
          checked={state.needsAccommodation}
          onToggle={(needsAccommodation) => updateState({ needsAccommodation })}
        >
          <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
            <NumberField
              label="Nombre de nuits"
              value={state.accommodationNights}
              onChange={(accommodationNights) => updateState({ accommodationNights })}
              min={1}
              placeholder="Ex : 10"
              largeur="pleine"
            />
            <NumberField
              label="Coût par nuit (€)"
              decimal
              value={state.accommodationCostPerNight}
              onChange={(accommodationCostPerNight) => updateState({ accommodationCostPerNight })}
              placeholder="Ex : 80"
              largeur="pleine"
            />
          </div>
        </BlocFrais>

        <BlocFrais
          icone="couverts"
          label="Frais de restauration"
          description="Repas pris pendant les jours de formation."
          checked={state.needsMeals}
          onToggle={(needsMeals) => updateState({ needsMeals })}
        >
          <NumberField
            label="Coût moyen par jour (€)"
            decimal
            value={state.mealCostPerDay}
            onChange={(mealCostPerDay) => updateState({ mealCostPerDay })}
            placeholder="Ex : 15"
          />
        </BlocFrais>
      </div>
    </div>
  );
}
