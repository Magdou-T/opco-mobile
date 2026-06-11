// Étape 3 — Formation souhaitée.
// Port RN de opco-funding/src/components/wizard/StepFormation.tsx.

import { Text, View } from 'react-native';
import {
  TRAINING_MODE_LABELS,
  TRAINING_TYPE_LABELS,
  type CertificationType,
  type OpcoData,
  type TrainingMode,
  type TrainingType,
  type WizardState,
} from '@opco/core';
import { ChoiceButton, NumberField, TextField } from '@/components/ui/forms';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
  updateFormationCosts: (total: number | null, hours: number | null) => void;
  getOpcoBySlug: (slug: string) => OpcoData | undefined;
}

const CERTIFICATION_OPTIONS: { value: CertificationType | null; label: string }[] = [
  { value: null, label: 'Aucune / Ne sait pas' },
  { value: 'rncp', label: 'RNCP (Répertoire National)' },
  { value: 'cqp', label: 'CQP (Certificat de Qualification Professionnelle)' },
  { value: 'diplome', label: "Diplôme d'État" },
  { value: 'habilitation', label: 'Habilitation' },
  { value: 'autre', label: 'Autre' },
];

export function StepFormation({ state, updateState, updateFormationCosts, getOpcoBySlug }: Props) {
  const opcoSlug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = opcoSlug ? getOpcoBySlug(opcoSlug) : null;

  // Alert if cost/h exceeds OPCO ceiling
  const ceilingWarning = (() => {
    if (!opco || !state.pedagogyCostPerHour) return null;
    const ceiling = opco.cout_horaire_inter?.value || opco.cout_horaire_metier?.value;
    if (ceiling && state.pedagogyCostPerHour > ceiling) {
      return `Le coût horaire (${state.pedagogyCostPerHour} €/h) dépasse le plafond ${opco.name} (${ceiling} €/h). Le surplus sera à votre charge.`;
    }
    return null;
  })();

  return (
    <View className="gap-6">
      <View>
        <Text className="mb-2 text-xl font-semibold text-gray-900">Formation souhaitée</Text>
        <Text className="text-sm text-gray-600">
          Décrivez la formation pour laquelle vous souhaitez un financement.
        </Text>
      </View>

      {/* Nom formation */}
      <TextField
        label="Nom de la formation"
        value={state.formationNom || ''}
        onChangeText={(text) => updateState({ formationNom: text || null })}
        placeholder="Ex: Développeur web full stack"
      />

      {/* Type de formation */}
      <View className="gap-2">
        <Text className="text-sm font-medium text-gray-700">Type de formation</Text>
        <View className="flex-row flex-wrap gap-2">
          {(Object.entries(TRAINING_TYPE_LABELS) as [TrainingType, string][]).map(
            ([key, label]) => (
              <View key={key} className="w-[48%]">
                <ChoiceButton
                  label={label}
                  selected={state.formationType === key}
                  onPress={() => updateState({ formationType: key })}
                />
              </View>
            ),
          )}
        </View>
      </View>

      {/* Certification visée */}
      <View className="gap-2">
        <Text className="text-sm font-medium text-gray-700">Certification visée</Text>
        <View className="gap-2">
          {CERTIFICATION_OPTIONS.map(({ value, label }) => (
            <ChoiceButton
              key={value ?? 'none'}
              label={label}
              compact
              selected={state.certificationLevel === value}
              onPress={() => updateState({ certificationLevel: value })}
            />
          ))}
        </View>
      </View>

      {/* Mode formation */}
      <View className="gap-2">
        <Text className="text-sm font-medium text-gray-700">
          Mode de formation <Text className="text-red-500">*</Text>
        </Text>
        <View className="flex-row gap-2">
          {(Object.entries(TRAINING_MODE_LABELS) as [TrainingMode, string][]).map(
            ([key, label]) => (
              <View key={key} className="flex-1">
                <ChoiceButton
                  label={label}
                  center
                  selected={state.trainingMode === key}
                  onPress={() => updateState({ trainingMode: key })}
                />
              </View>
            ),
          )}
        </View>
      </View>

      {/* Durée et coûts */}
      <View className="flex-row gap-4">
        <View className="flex-1">
          <NumberField
            label="Durée (en heures)"
            required
            value={state.durationHours}
            onChangeNumber={(h) => updateFormationCosts(state.pedagogyCostTotal, h)}
            placeholder="Ex: 140"
          />
        </View>
        <View className="flex-1">
          <NumberField
            label="Coût total HT (€)"
            required
            decimal
            value={state.pedagogyCostTotal}
            onChangeNumber={(t) => updateFormationCosts(t, state.durationHours)}
            placeholder="Ex: 5600"
          />
        </View>
      </View>

      {/* Auto-calculated cost per hour */}
      {state.pedagogyCostPerHour != null && state.pedagogyCostPerHour > 0 && (
        <View
          className={`rounded-lg px-4 py-2 ${ceilingWarning ? 'bg-orange-50' : 'bg-gray-50'}`}
        >
          <Text className={`text-sm ${ceilingWarning ? 'text-orange-800' : 'text-gray-600'}`}>
            Coût horaire calculé :{' '}
            <Text className="font-semibold">{state.pedagogyCostPerHour} €/h</Text>
          </Text>
          {ceilingWarning && (
            <Text className="mt-1 text-xs text-orange-700">{ceilingWarning}</Text>
          )}
        </View>
      )}

      {/* Organisme */}
      <TextField
        label="Organisme de formation (optionnel)"
        value={state.organismeFormation || ''}
        onChangeText={(text) => updateState({ organismeFormation: text || null })}
        placeholder="Ex: AFPA, CNAM, organisme privé..."
      />
    </View>
  );
}
