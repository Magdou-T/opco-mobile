// Port quasi direct du hook useWizard de la V1 web
// (opco-funding/src/hooks/useWizard.ts), imports adaptés vers @opco/core
// + persistance AsyncStorage de l'état (reprise de session).

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  WIZARD_STEPS,
  createInitialWizardState,
  type WizardState,
  type WizardStep,
} from '@opco/core';
import { loadWizardState, saveWizardState, clearWizardState } from '@/lib/wizard-storage';

export function useWizard() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [state, setState] = useState<WizardState>(createInitialWizardState);
  const [showResults, setShowResults] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restauration de la session précédente
  useEffect(() => {
    let cancelled = false;
    loadWizardState().then((restored) => {
      if (!cancelled) {
        setState(restored);
        setHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persistance (débouncée) à chaque modification après hydratation
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveWizardState(state);
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, hydrated]);

  const currentStep = WIZARD_STEPS[currentStepIndex];

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const canGoNext = useCallback((): boolean => {
    switch (currentStep.key) {
      case 'identification':
        return !!(state.selectedOpcoSlug || state.detectedOpcoSlug);
      case 'situation':
        return !!(state.contractType && state.companySize);
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
    if (currentStepIndex < WIZARD_STEPS.length - 1) {
      // Skip frais step if training is distance-only
      const nextIndex = currentStepIndex + 1;
      if (WIZARD_STEPS[nextIndex].key === 'frais' && state.trainingMode === 'distance') {
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
      if (WIZARD_STEPS[prevIndex].key === 'frais' && state.trainingMode === 'distance') {
        setCurrentStepIndex(prevIndex - 1);
      } else {
        setCurrentStepIndex(prevIndex);
      }
    }
  }, [currentStepIndex, state.trainingMode]);

  const goToStep = useCallback((step: WizardStep) => {
    const index = WIZARD_STEPS.findIndex((s) => s.key === step);
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
    void clearWizardState();
  }, []);

  const getEffectiveOpcoSlug = useCallback((): string | null => {
    return state.selectedOpcoSlug || state.detectedOpcoSlug;
  }, [state.selectedOpcoSlug, state.detectedOpcoSlug]);

  // Auto-calculate pedagogyCostPerHour when total and hours change
  const updateFormationCosts = useCallback((total: number | null, hours: number | null) => {
    const perHour = total && hours && hours > 0 ? Math.round((total / hours) * 100) / 100 : null;
    setState((prev) => ({
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
  };
}
