// Étape 4 — Frais annexes.
// Port RN de opco-funding/src/components/wizard/StepFrais.tsx.

import { Text, View } from 'react-native';
import type { TransportMode, WizardState } from '@opco/core';
import { CheckboxRow, ChoiceButton, NumberField } from '@/components/ui/forms';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
}

const TRANSPORT_MODES: [TransportMode, string][] = [
  ['train', 'Train'],
  ['avion', 'Avion'],
  ['voiture', 'Voiture'],
  ['autre', 'Autre'],
];

export function StepFrais({ state, updateState }: Props) {
  // Auto-calculate training days from hours (7h/day standard)
  const estimatedDays = state.durationHours ? Math.ceil(state.durationHours / 7) : 0;

  return (
    <View className="gap-6">
      <View>
        <Text className="mb-2 text-xl font-semibold text-gray-900">Frais annexes</Text>
        <Text className="text-sm text-gray-600">
          Si la formation nécessite un déplacement, indiquez vos frais prévisionnels.
          Certains OPCO prennent en charge tout ou partie de ces frais.
        </Text>
      </View>

      {/* Training days */}
      <NumberField
        label="Nombre de jours de formation"
        value={state.trainingDays ?? (estimatedDays || null)}
        onChangeNumber={(v) => updateState({ trainingDays: v })}
        placeholder={`Estimation : ${estimatedDays} jours (base 7h/jour)`}
        helper={
          !state.trainingDays && estimatedDays > 0
            ? `Estimation automatique : ${estimatedDays} jours (base 7h/jour). Modifiable.`
            : undefined
        }
      />

      {/* Transport */}
      <View className="gap-3 rounded-lg border border-gray-200 p-4">
        <CheckboxRow
          label="J'ai besoin d'un déplacement"
          checked={state.needsTransport}
          onToggle={(next) => updateState({ needsTransport: next })}
        />

        {state.needsTransport && (
          <View className="gap-3 pl-2">
            <View className="gap-2">
              <Text className="text-sm text-gray-600">Mode de transport</Text>
              <View className="flex-row gap-2">
                {TRANSPORT_MODES.map(([key, label]) => (
                  <View key={key} className="flex-1">
                    <ChoiceButton
                      label={label}
                      center
                      compact
                      selected={state.transportMode === key}
                      onPress={() => updateState({ transportMode: key })}
                    />
                  </View>
                ))}
              </View>
            </View>
            <NumberField
              label="Distance estimée (km)"
              value={state.transportDistanceKm}
              onChangeNumber={(v) => updateState({ transportDistanceKm: v })}
              placeholder="Ex: 250"
            />
          </View>
        )}
      </View>

      {/* Hébergement */}
      <View className="gap-3 rounded-lg border border-gray-200 p-4">
        <CheckboxRow
          label="J'ai besoin d'un hébergement"
          checked={state.needsAccommodation}
          onToggle={(next) => updateState({ needsAccommodation: next })}
        />

        {state.needsAccommodation && (
          <View className="flex-row gap-3 pl-2">
            <View className="flex-1">
              <NumberField
                label="Nombre de nuits"
                value={state.accommodationNights}
                onChangeNumber={(v) => updateState({ accommodationNights: v })}
                placeholder="Ex: 10"
              />
            </View>
            <View className="flex-1">
              <NumberField
                label="Coût par nuit (€)"
                decimal
                value={state.accommodationCostPerNight}
                onChangeNumber={(v) => updateState({ accommodationCostPerNight: v })}
                placeholder="Ex: 80"
              />
            </View>
          </View>
        )}
      </View>

      {/* Restauration */}
      <View className="gap-3 rounded-lg border border-gray-200 p-4">
        <CheckboxRow
          label="Frais de restauration"
          checked={state.needsMeals}
          onToggle={(next) => updateState({ needsMeals: next })}
        />

        {state.needsMeals && (
          <View className="pl-2">
            <NumberField
              label="Coût moyen par jour (€)"
              decimal
              value={state.mealCostPerDay}
              onChangeNumber={(v) => updateState({ mealCostPerDay: v })}
              placeholder="Ex: 15"
            />
          </View>
        )}
      </View>
    </View>
  );
}
