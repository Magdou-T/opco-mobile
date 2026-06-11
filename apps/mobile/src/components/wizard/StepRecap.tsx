// Étape 5 — Récapitulatif avant calcul.
// Port RN de opco-funding/src/components/wizard/StepRecap.tsx.

import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  CONTRACT_TYPE_LABELS,
  COMPANY_SIZE_LABELS,
  TRAINING_TYPE_LABELS,
  TRAINING_MODE_LABELS,
  type WizardState,
  type WizardStep,
} from '@opco/core';

interface Props {
  state: WizardState;
  onEdit: (step: WizardStep) => void;
  opcoList: { slug: string; name: string; secteurs: string }[];
}

function Section({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <View className="rounded-lg border border-gray-200 bg-white p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-medium text-gray-900">{title}</Text>
        <Pressable onPress={onEdit} accessibilityRole="button">
          <Text className="text-sm font-medium text-blue-600">Modifier</Text>
        </Pressable>
      </View>
      <View className="gap-2">{children}</View>
    </View>
  );
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium text-gray-900">
        {value || '—'}
      </Text>
    </View>
  );
}

export function StepRecap({ state, onEdit, opcoList }: Props) {
  const opcoSlug = state.selectedOpcoSlug || state.detectedOpcoSlug;
  const opco = opcoSlug ? opcoList.find((o) => o.slug === opcoSlug) : null;

  return (
    <View className="gap-6">
      <View>
        <Text className="mb-2 text-xl font-semibold text-gray-900">Récapitulatif</Text>
        <Text className="text-sm text-gray-600">
          Vérifiez vos informations avant de lancer le calcul du financement.
        </Text>
      </View>

      {/* OPCO */}
      <Section title="OPCO" onEdit={() => onEdit('identification')}>
        <Item label="OPCO" value={opco?.name} />
        <Item label="Secteurs" value={opco?.secteurs} />
        {state.detectedCompanyName ? (
          <Item
            label="Entreprise"
            value={`${state.detectedCompanyName} (${state.sirenNumber})`}
          />
        ) : null}
      </Section>

      {/* Situation pro */}
      <Section title="Situation professionnelle" onEdit={() => onEdit('situation')}>
        <Item
          label="Contrat"
          value={state.contractType ? CONTRACT_TYPE_LABELS[state.contractType] : null}
        />
        <Item
          label="Taille entreprise"
          value={state.companySize ? COMPANY_SIZE_LABELS[state.companySize] : null}
        />
        <Item
          label="Ancienneté"
          value={state.anciennete_mois ? `${state.anciennete_mois} mois` : null}
        />
        {state.isHandicap ? <Item label="Handicap" value="Oui (RQTH)" /> : null}
        {state.isReconversion ? <Item label="Reconversion" value="Oui" /> : null}
        {state.isSortieChomage ? <Item label="Sortie chômage" value="Oui" /> : null}
      </Section>

      {/* Formation */}
      <Section title="Formation" onEdit={() => onEdit('formation')}>
        <Item label="Formation" value={state.formationNom} />
        <Item
          label="Type"
          value={state.formationType ? TRAINING_TYPE_LABELS[state.formationType] : null}
        />
        <Item
          label="Mode"
          value={state.trainingMode ? TRAINING_MODE_LABELS[state.trainingMode] : null}
        />
        <Item label="Durée" value={state.durationHours ? `${state.durationHours}h` : null} />
        <Item
          label="Coût total"
          value={state.pedagogyCostTotal ? `${state.pedagogyCostTotal} €` : null}
        />
        <Item
          label="Coût/heure"
          value={state.pedagogyCostPerHour ? `${state.pedagogyCostPerHour} €/h` : null}
        />
        <Item label="Organisme" value={state.organismeFormation} />
      </Section>

      {/* Frais */}
      {(state.needsTransport || state.needsAccommodation || state.needsMeals) && (
        <Section title="Frais annexes" onEdit={() => onEdit('frais')}>
          {state.needsTransport ? (
            <>
              <Item label="Transport" value={state.transportMode || 'Oui'} />
              {state.transportDistanceKm ? (
                <Item label="Distance" value={`${state.transportDistanceKm} km`} />
              ) : null}
            </>
          ) : null}
          {state.needsAccommodation ? (
            <>
              <Item label="Hébergement" value={`${state.accommodationNights} nuits`} />
              <Item
                label="Coût/nuit"
                value={
                  state.accommodationCostPerNight
                    ? `${state.accommodationCostPerNight} €`
                    : null
                }
              />
            </>
          ) : null}
          {state.needsMeals ? (
            <Item
              label="Restauration"
              value={state.mealCostPerDay ? `${state.mealCostPerDay} €/jour` : 'Oui'}
            />
          ) : null}
          <Item
            label="Jours de formation"
            value={state.trainingDays ? `${state.trainingDays} jours` : null}
          />
        </Section>
      )}
    </View>
  );
}
