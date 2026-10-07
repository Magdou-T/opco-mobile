'use client';

import { useState, useCallback, useMemo } from 'react';
import { createInitialWizardState } from '@opco/core';
import type { WizardState } from '@opco/core';
import { ETAPES, champsManquants, indexPrecedent, indexSuivant } from '@/lib/etapes';
import type { EtapeSite } from '@/lib/etapes';

export function useWizard() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [state, setState] = useState<WizardState>(createInitialWizardState);
  const [showResults, setShowResults] = useState(false);

  const currentStep = ETAPES[currentStepIndex];

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  /** Ce qui manque pour quitter l'étape affichée (vide : « Suivant » est actif). Voir `champsManquants`. */
  const manquants = useMemo(() => champsManquants(currentStep.key, state), [currentStep.key, state]);

  const canGoNext = useCallback((): boolean => manquants.length === 0, [manquants]);

  // L'étape « Frais » est sautée, dans les deux sens, pour une formation entièrement à distance.
  const goNext = useCallback(() => {
    if (manquants.length > 0) return;
    setCurrentStepIndex((index) => indexSuivant(index, state));
  }, [manquants, state]);

  const goPrev = useCallback(() => {
    setCurrentStepIndex((index) => indexPrecedent(index, state));
  }, [state]);

  const goToStep = useCallback((step: EtapeSite) => {
    const index = ETAPES.findIndex((s) => s.key === step);
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

  // Coût horaire recalculé quand le coût total ou la durée change.
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
    manquants,
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
