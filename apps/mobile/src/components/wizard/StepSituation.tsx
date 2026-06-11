// Étape 2 — Situation professionnelle.
// Port RN de opco-funding/src/components/wizard/StepSituation.tsx.

import { Text, View } from 'react-native';
import {
  CONTRACT_TYPE_LABELS,
  COMPANY_SIZE_LABELS,
  type CompanySize,
  type ContractType,
  type WizardState,
} from '@opco/core';
import { CheckboxRow, ChoiceButton, NumberField } from '@/components/ui/forms';

interface Props {
  state: WizardState;
  updateState: (updates: Partial<WizardState>) => void;
}

const SITUATIONS: { key: 'isHandicap' | 'isReconversion' | 'isSortieChomage'; label: string; desc: string }[] = [
  {
    key: 'isHandicap',
    label: 'Situation de handicap (RQTH)',
    desc: 'Peut ouvrir droit à des financements complémentaires',
  },
  {
    key: 'isReconversion',
    label: 'Reconversion professionnelle',
    desc: 'Projets de transition professionnelle',
  },
  {
    key: 'isSortieChomage',
    label: 'Sortie de chômage',
    desc: "Reprise d'emploi récente",
  },
];

export function StepSituation({ state, updateState }: Props) {
  return (
    <View className="gap-6">
      <View>
        <Text className="mb-2 text-xl font-semibold text-gray-900">
          Votre situation professionnelle
        </Text>
        <Text className="text-sm text-gray-600">
          Ces informations déterminent les plafonds et critères de financement applicables.
        </Text>
      </View>

      {/* Type de contrat */}
      <View className="gap-2">
        <Text className="text-sm font-medium text-gray-700">
          Type de contrat <Text className="text-red-500">*</Text>
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {(Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][]).map(
            ([key, label]) => (
              <View key={key} className="w-[48%]">
                <ChoiceButton
                  label={label}
                  selected={state.contractType === key}
                  onPress={() => updateState({ contractType: key })}
                />
              </View>
            ),
          )}
        </View>
      </View>

      {/* Taille entreprise */}
      <View className="gap-2">
        <Text className="text-sm font-medium text-gray-700">
          Taille de l'entreprise <Text className="text-red-500">*</Text>
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {(Object.entries(COMPANY_SIZE_LABELS) as [CompanySize, string][]).map(
            ([key, label]) => (
              <View key={key} className="w-[48%]">
                <ChoiceButton
                  label={label}
                  selected={state.companySize === key}
                  onPress={() => updateState({ companySize: key })}
                />
              </View>
            ),
          )}
        </View>
      </View>

      {/* Ancienneté */}
      <NumberField
        label="Ancienneté dans l'entreprise (en mois)"
        value={state.anciennete_mois}
        onChangeNumber={(v) => updateState({ anciennete_mois: v })}
        placeholder="Ex: 24"
      />

      {/* Situations particulières */}
      <View className="gap-2">
        <Text className="text-sm font-medium text-gray-700">
          Situations particulières (optionnel)
        </Text>
        <View className="gap-2">
          {SITUATIONS.map(({ key, label, desc }) => (
            <CheckboxRow
              key={key}
              label={label}
              description={desc}
              checked={state[key]}
              onToggle={(next) => updateState({ [key]: next })}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
