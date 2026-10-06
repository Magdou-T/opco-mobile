'use client';

import { useWizard } from '@/hooks/useWizard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StepIdentification } from './StepIdentification';
import { StepSituation } from './StepSituation';
import { StepFormation } from './StepFormation';
import { StepFrais } from './StepFrais';
import { StepRecap } from './StepRecap';
import { FundingBreakdown } from '@/components/results/FundingBreakdown';
import { calculateFunding } from '@/lib/calculator';
import { getOpcoBySlug } from '../../../data/opcos';

export function WizardContainer() {
  const {
    currentStep,
    currentStepIndex,
    state,
    showResults,
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

  // Calculate funding result (pure derivation, never mutate state during render)
  const fundingResult = (() => {
    if (!showResults) return null;
    const slug = getEffectiveOpcoSlug();
    if (!slug) return null;
    const opco = getOpcoBySlug(slug);
    if (!opco) return null;

    const effectiveState =
      !state.trainingDays && state.durationHours
        ? { ...state, trainingDays: Math.ceil(state.durationHours / 7) }
        : state;

    return calculateFunding(opco, effectiveState);
  })();

  if (showResults && fundingResult) {
    return (
      <div className="space-y-6">
        <FundingBreakdown result={fundingResult} />
        <div className="flex flex-wrap justify-center gap-3 print:hidden">
          <button
            type="button"
            onClick={() => goToStep('recap')}
            className="rounded border border-ink bg-white px-6 py-3 text-sm font-medium transition-colors hover:bg-paper-deep"
          >
            Modifier mes informations
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded bg-cobalt px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-navy"
          >
            Nouvelle simulation
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded border border-ink bg-white px-6 py-3 text-sm font-medium transition-colors hover:bg-paper-deep"
          >
            Imprimer / PDF
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ProgressBar currentStepIndex={currentStepIndex} onStepClick={goToStep} />

      <div className="rounded border border-ink bg-white p-6 shadow-[5px_5px_0_0_var(--paper-deep)] md:p-8">
        {currentStep.key === 'identification' && (
          <StepIdentification state={state} updateState={updateState} />
        )}
        {currentStep.key === 'situation' && (
          <StepSituation state={state} updateState={updateState} />
        )}
        {currentStep.key === 'formation' && (
          <StepFormation state={state} updateState={updateState} updateFormationCosts={updateFormationCosts} />
        )}
        {currentStep.key === 'frais' && (
          <StepFrais state={state} updateState={updateState} />
        )}
        {currentStep.key === 'recap' && (
          <StepRecap state={state} onEdit={goToStep} />
        )}
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentStepIndex === 0}
          className={`rounded px-6 py-3 text-sm font-medium transition-colors ${
            currentStepIndex === 0
              ? 'cursor-not-allowed bg-paper-deep text-ink-faint'
              : 'border border-ink bg-white hover:bg-paper-deep'
          }`}
        >
          ← Précédent
        </button>

        {currentStep.key === 'recap' ? (
          <button
            type="button"
            onClick={calculate}
            className="rounded bg-cobalt px-8 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-navy"
          >
            Calculer mon financement
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext()}
            className={`rounded px-6 py-3 text-sm font-semibold transition-colors ${
              canGoNext()
                ? 'bg-cobalt text-white shadow-sm hover:bg-navy'
                : 'cursor-not-allowed bg-paper-deep text-ink-faint'
            }`}
          >
            Suivant →
          </button>
        )}
      </div>
    </div>
  );
}
