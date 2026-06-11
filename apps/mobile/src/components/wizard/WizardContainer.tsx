// Conteneur du wizard 5 étapes + affichage des résultats.
// Port RN de opco-funding/src/components/wizard/WizardContainer.tsx.
// Le calcul vient EXCLUSIVEMENT de calculateFunding (@opco/core) appliqué
// au dataset actif (cache validé ou données embarquées).

import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { calculateFunding, type FundingResult, type WizardState } from '@opco/core';
import { useWizard } from '@/hooks/useWizard';
import { useActiveOpcos } from '@/hooks/useActiveOpcos';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StepIdentification } from './StepIdentification';
import { StepSituation } from './StepSituation';
import { StepFormation } from './StepFormation';
import { StepFrais } from './StepFrais';
import { StepRecap } from './StepRecap';
import { FundingBreakdown } from '@/components/results/FundingBreakdown';
import { formatDateFr } from '@/lib/dataset-sync';

export function WizardContainer() {
  const {
    currentStep,
    currentStepIndex,
    state,
    showResults,
    hydrated,
    updateState,
    canGoNext,
    goNext,
    goPrev,
    goToStep,
    calculate,
    reset,
    getEffectiveOpcoSlug,
    updateFormationCosts,
  } = useWizard();

  const { loading, opcoList, getOpcoBySlug, generatedAt } = useActiveOpcos();

  if (!hydrated || loading) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Calculate funding result (même logique que la V1 : trainingDays auto = ceil(h/7))
  const fundingResult: FundingResult | null = (() => {
    if (!showResults) return null;
    const slug = getEffectiveOpcoSlug();
    if (!slug) return null;
    const opco = getOpcoBySlug(slug);
    if (!opco) return null;

    const effectiveState: WizardState =
      !state.trainingDays && state.durationHours
        ? { ...state, trainingDays: Math.ceil(state.durationHours / 7) }
        : state;

    return calculateFunding(opco, effectiveState);
  })();

  if (showResults && fundingResult) {
    return (
      <ScrollView
        className="flex-1 bg-gray-100"
        contentContainerClassName="p-4 pb-12 gap-6"
      >
        <FundingBreakdown result={fundingResult} />
        <View className="gap-3">
          <Pressable
            onPress={() => goToStep('recap')}
            className="items-center rounded-lg border border-gray-300 bg-white px-6 py-3 active:bg-gray-50"
          >
            <Text className="text-sm font-medium text-gray-700">Modifier mes informations</Text>
          </Pressable>
          <Pressable
            onPress={reset}
            className="items-center rounded-lg bg-blue-600 px-6 py-3 active:bg-blue-700"
          >
            <Text className="text-sm font-medium text-white">Nouvelle simulation</Text>
          </Pressable>
        </View>
        <Text className="text-center text-xs text-gray-400">
          Données OPCO à jour au {formatDateFr(generatedAt)}
        </Text>
      </ScrollView>
    );
  }

  return (
    <View className="flex-1 bg-gray-100">
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 pb-6 gap-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress bar */}
        <ProgressBar currentStepIndex={currentStepIndex} onStepClick={goToStep} />

        {/* Step content */}
        <View className="rounded-xl border border-gray-200 bg-white p-5">
          {currentStep.key === 'identification' && (
            <StepIdentification state={state} updateState={updateState} opcoList={opcoList} />
          )}
          {currentStep.key === 'situation' && (
            <StepSituation state={state} updateState={updateState} />
          )}
          {currentStep.key === 'formation' && (
            <StepFormation
              state={state}
              updateState={updateState}
              updateFormationCosts={updateFormationCosts}
              getOpcoBySlug={getOpcoBySlug}
            />
          )}
          {currentStep.key === 'frais' && <StepFrais state={state} updateState={updateState} />}
          {currentStep.key === 'recap' && (
            <StepRecap state={state} onEdit={goToStep} opcoList={opcoList} />
          )}
        </View>
      </ScrollView>

      {/* Navigation */}
      <View className="flex-row justify-between gap-3 border-t border-gray-200 bg-white p-4">
        <Pressable
          onPress={goPrev}
          disabled={currentStepIndex === 0}
          className={`rounded-lg px-6 py-3 ${
            currentStepIndex === 0
              ? 'bg-gray-100'
              : 'border border-gray-300 bg-white active:bg-gray-50'
          }`}
        >
          <Text
            className={`text-sm font-medium ${
              currentStepIndex === 0 ? 'text-gray-400' : 'text-gray-700'
            }`}
          >
            Précédent
          </Text>
        </Pressable>

        {currentStep.key === 'recap' ? (
          <Pressable
            onPress={calculate}
            className="flex-1 items-center rounded-lg bg-blue-600 px-6 py-3 active:bg-blue-700"
          >
            <Text className="text-sm font-semibold text-white">Calculer mon financement</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={goNext}
            disabled={!canGoNext()}
            className={`rounded-lg px-8 py-3 ${
              canGoNext() ? 'bg-blue-600 active:bg-blue-700' : 'bg-gray-100'
            }`}
          >
            <Text
              className={`text-sm font-medium ${canGoNext() ? 'text-white' : 'text-gray-400'}`}
            >
              Suivant
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
