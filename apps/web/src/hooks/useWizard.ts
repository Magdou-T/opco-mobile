'use client';

import { useState, useCallback } from 'react';
import { createInitialWizardState } from '@opco/core';
import type { WizardState } from '@opco/core';
import { ETAPES } from '@/lib/etapes';
import type { EtapeSite } from '@/lib/etapes';
import { opcoRequis } from '@/lib/entreprise';

export function useWizard() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [state, setState] = useState<WizardState>(createInitialWizardState);
  const [showResults, setShowResults] = useState(false);

  const currentStep = ETAPES[currentStepIndex];

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const canGoNext = useCallback((): boolean => {
    switch (currentStep.key) {
      case 'identification':
        // OPCO choisi ou détecté (facultatif pour « former le dirigeant »), région et taille de l'entreprise.
        return (
          (!opcoRequis(state.projetType) || !!(state.selectedOpcoSlug || state.detectedOpcoSlug)) &&
          state.regionCode != null &&
          state.companySize != null
        );
      case 'situation':
        return !!state.contractType;
      case 'formation':
        return !!(state.durationHours && state.pedagogyCostTotal && state.trainingMode);
      case 'frais':
        return true; // Optional step
      case 'recap':
        return true;
      default:
        return false;
    }
  }, [currentStep.key, state]);

  const goNext = useCallback(() => {
    if (currentStepIndex < ETAPES.length - 1) {
      // Skip frais step if training is distance-only
      const nextIndex = currentStepIndex + 1;
      if (ETAPES[nextIndex].key === 'frais' && state.trainingMode === 'distance') {
        setCurrentStepIndex(nextIndex + 1);
      } else {
        setCurrentStepIndex(nextIndex);
      }
    }
  }, [currentStepIndex, state.trainingMode]);

  const goPrev = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevIndex = currentStepIndex - 1;
      // Skip frais step going backwards if training is distance
      if (ETAPES[prevIndex].key === 'frais' && state.trainingMode === 'distance') {
        setCurrentStepIndex(prevIndex - 1);
      } else {
        setCurrentStepIndex(prevIndex);
      }
    }
  }, [currentStepIndex, state.trainingMode]);

  const goToStep = useCallback((step: EtapeSite) => {
    const index = ETAPES.findIndex(s => s.key === step);
    if (index >= 0) {
      setCurrentStepIndex(index);
      setShowResults(false);
    }
  }, []);

  const calculate = useCallback(() => {
    setShowResults(true);
  }, []);

  const reset = useCallback(() => {
    setState(createInitialWizardState());
    setCurrentStepIndex(0);
    setShowResults(false);
  }, []);

  const getEffectiveOpcoSlug = useCallback((): string | null => {
    return state.selectedOpcoSlug || state.detectedOpcoSlug;
  }, [state.selectedOpcoSlug, state.detectedOpcoSlug]);

  // Auto-calculate pedagogyCostPerHour when total and hours change
  const updateFormationCosts = useCallback((total: number | null, hours: number | null) => {
    const perHour = total && hours && hours > 0 ? Math.round((total / hours) * 100) / 100 : null;
    setState(prev => ({
      ...prev,
      pedagogyCostTotal: total,
      durationHours: hours,
      pedagogyCostPerHour: perHour,
    }));
  }, []);

  return {
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
  };
}
