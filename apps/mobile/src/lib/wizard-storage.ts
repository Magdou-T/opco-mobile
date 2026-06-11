// Persistance de l'état du wizard en AsyncStorage (reprise de session).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createInitialWizardState, type WizardState } from '@opco/core';

const STORAGE_KEY = '@opco/wizard-state';

export async function loadWizardState(): Promise<WizardState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialWizardState();
    const parsed = JSON.parse(raw) as Partial<WizardState>;
    // Merge sur l'état initial : tolère l'évolution du schéma entre versions.
    return { ...createInitialWizardState(), ...parsed };
  } catch {
    return createInitialWizardState();
  }
}

export async function saveWizardState(state: WizardState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persistance best-effort : un échec d'écriture ne doit pas casser l'UI.
  }
}

export async function clearWizardState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
