'use client';

import { useState, useCallback, useMemo } from 'react';
import { createInitialWizardState } from '@opco/core';
import type { WizardState } from '@opco/core';
import { ETAPES, champsManquants, indexPrecedent, indexSuivant } from '@/lib/etapes';
import type { EtapeSite } from '@/lib/etapes';
import { coutsDeFormation, reponsesInconnuesApres } from '@/lib/parcours';
import type { QuestionAvecInconnu } from '@/lib/parcours';

/** Aucune réponse « Je ne sais pas » (état de départ et nouvelle simulation). */
const AUCUNE_REPONSE_INCONNUE: ReadonlySet<QuestionAvecInconnu> = new Set();

export function useWizard() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [state, setState] = useState<WizardState>(createInitialWizardState);
  const [showResults, setShowResults] = useState(false);
  // État propre au site : les questions auxquelles l'utilisateur a répondu « Je ne sais pas » (la valeur reste null pour
  // le moteur). Toute écriture d'une de ces questions par `updateState` efface sa réponse (`reponsesInconnuesApres`).
  const [reponsesInconnues, setReponsesInconnues] = useState(AUCUNE_REPONSE_INCONNUE);

  const currentStep = ETAPES[currentStepIndex];

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
    setReponsesInconnues((prev) => reponsesInconnuesApres(prev, updates));
  }, []);

  /** Réponse à une question qui admet « Je ne sais pas » : `null` est cette réponse, retenue par le site. */
  const repondre = useCallback(<K extends QuestionAvecInconnu>(question: K, valeur: WizardState[K]) => {
    const maj = { [question]: valeur } as Partial<WizardState>;
    setState((prev) => ({ ...prev, ...maj }));
    setReponsesInconnues((prev) => reponsesInconnuesApres(prev, maj, valeur == null ? question : undefined));
  }, []);

  /** Ce qui manque pour quitter l'étape affichée (vide : « Suivant » est actif). Voir `champsManquants`. */
  const manquants = useMemo(() => champsManquants(currentStep.key, state), [currentStep.key, state]);

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
    setReponsesInconnues(AUCUNE_REPONSE_INCONNUE);
    setCurrentStepIndex(0);
    setShowResults(false);
  }, []);

  // Coût horaire recalculé quand le coût total ou la durée change, sans arrondi (coutsDeFormation).
  const updateFormationCosts = useCallback((total: number | null, hours: number | null) => {
    setState((prev) => ({ ...prev, ...coutsDeFormation(total, hours) }));
  }, []);

  return {
    currentStep,
    currentStepIndex,
    state,
    showResults,
    manquants,
    reponsesInconnues,
    updateState,
    repondre,
    goNext,
    goPrev,
    goToStep,
    calculate,
    reset,
    updateFormationCosts,
  };
}
