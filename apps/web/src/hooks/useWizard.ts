'use client';

import { useState, useCallback, useMemo } from 'react';
import { ID_PROFIL_PRINCIPAL, champsDuProfilPrincipal, createInitialWizardState } from '@opco/core';
import type { ChampsProfil, ProjetType, WizardState } from '@opco/core';
import { ETAPES, champsManquants, indexPrecedent, indexSuivant } from '@/lib/etapes';
import type { EtapeSite } from '@/lib/etapes';
import {
  ajouterProfil,
  basculerModePrix,
  changerProjetDuProfil,
  definirNombre,
  etatDepuisPrix,
  inconnuesApresMaj,
  inconnuesSansProfil,
  majProfil,
  normaliserGroupe,
  retirerProfil,
} from '@/lib/groupe';
import type { InconnuesParProfil } from '@/lib/groupe';
import { champsDepuisProjet, reponsesInconnuesApres } from '@/lib/parcours';
import type { QuestionAvecInconnu, QuestionDeProfil } from '@/lib/parcours';

/** Aucune réponse « Je ne sais pas » (état de départ et nouvelle simulation). */
const AUCUNE_REPONSE_INCONNUE: ReadonlySet<QuestionAvecInconnu> = new Set();
const AUCUNE_INCONNUE_DE_PROFIL: InconnuesParProfil = {};
/** Réponses d'un profil vide : un changement de statut en tire les réponses « Je ne sais pas » à remettre à vide. */
const REPONSES_VIDES = champsDuProfilPrincipal(createInitialWizardState());

/** Actions du groupe : étape Participants (profils, effectifs) et prix de la formation (par personne ou pour le groupe). */
export interface ActionsDuGroupe {
  ajouterProfil: () => void;
  /** Retire un profil supplémentaire. */
  retirerProfil: (id: string) => void;
  /** Met à jour les réponses d'un profil (l'identifiant `principal` désigne le profil principal). */
  majProfil: (id: string, maj: Partial<ChampsProfil>) => void;
  /** Change le statut d'un profil : seules les réponses du nouveau statut et les questions communes restent. */
  changerProjetProfil: (id: string, projet: ProjetType) => void;
  definirNombre: (id: string, nombre: number) => void;
  /** Réponse à une question qui admet « Je ne sais pas » : `null` est cette réponse, retenue par le profil. */
  repondreProfil: <K extends QuestionDeProfil>(id: string, question: K, valeur: ChampsProfil[K]) => void;
  /** Passe de « par personne » à « pour le groupe » (et inversement) en gardant le coût réel. */
  basculerModePrix: (versGroupe: boolean) => void;
}

export function useWizard() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [state, setState] = useState<WizardState>(createInitialWizardState);
  const [showResults, setShowResults] = useState(false);
  // État propre au site : les questions auxquelles l'utilisateur a répondu « Je ne sais pas » (la valeur reste null pour
  // le moteur). Toute écriture d'une de ces questions par `updateState` efface sa réponse (`reponsesInconnuesApres`).
  const [reponsesInconnues, setReponsesInconnues] = useState(AUCUNE_REPONSE_INCONNUE);
  // Les mêmes réponses pour chaque profil supplémentaire, par identifiant (`inconnuesApresMaj`).
  const [inconnuesProfils, setInconnuesProfils] = useState(AUCUNE_INCONNUE_DE_PROFIL);

  const currentStep = ETAPES[currentStepIndex];

  // Chaque mise à jour passe par `normaliserGroupe` : effectifs bornés, prix du groupe et coût d'une personne cohérents.
  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => normaliserGroupe({ ...prev, ...updates }));
    setReponsesInconnues((prev) => reponsesInconnuesApres(prev, updates));
  }, []);

  /** Réponse à une question qui admet « Je ne sais pas » : `null` est cette réponse, retenue par le site. */
  const repondre = useCallback(<K extends QuestionAvecInconnu>(question: K, valeur: WizardState[K]) => {
    const maj = { [question]: valeur } as Partial<WizardState>;
    setState((prev) => normaliserGroupe({ ...prev, ...maj }));
    setReponsesInconnues((prev) => reponsesInconnuesApres(prev, maj, valeur == null ? question : undefined));
  }, []);

  const groupe = useMemo<ActionsDuGroupe>(
    () => ({
      ajouterProfil: () => setState((prev) => ajouterProfil(prev)),
      retirerProfil: (id) => {
        setState((prev) => retirerProfil(prev, id));
        setInconnuesProfils((prev) => inconnuesSansProfil(prev, id));
      },
      majProfil: (id, maj) => {
        if (id === ID_PROFIL_PRINCIPAL) {
          updateState(maj);
          return;
        }
        setState((prev) => majProfil(prev, id, maj));
        setInconnuesProfils((prev) => inconnuesApresMaj(prev, id, maj));
      },
      changerProjetProfil: (id, projet) => {
        setState((prev) => changerProjetDuProfil(prev, id, projet));
        setInconnuesProfils((prev) => inconnuesApresMaj(prev, id, champsDepuisProjet(REPONSES_VIDES, projet)));
      },
      definirNombre: (id, nombre) => setState((prev) => definirNombre(prev, id, nombre)),
      repondreProfil: (id, question, valeur) => {
        if (id === ID_PROFIL_PRINCIPAL) {
          repondre(question, valeur);
          return;
        }
        const maj = { [question]: valeur } as Partial<ChampsProfil>;
        setState((prev) => majProfil(prev, id, maj));
        setInconnuesProfils((prev) => inconnuesApresMaj(prev, id, maj, valeur == null ? question : undefined));
      },
      basculerModePrix: (versGroupe) => setState((prev) => basculerModePrix(prev, versGroupe)),
    }),
    [updateState, repondre],
  );

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
    setInconnuesProfils(AUCUNE_INCONNUE_DE_PROFIL);
    setCurrentStepIndex(0);
    setShowResults(false);
  }, []);

  // Coût horaire recalculé quand le prix ou la durée change, sans arrondi (`etatDepuisPrix`). `saisie` est le prix saisi :
  // celui d'une personne, ou celui de tout le groupe quand `pourLeGroupe` (à partir de deux personnes).
  const updateFormationCosts = useCallback((saisie: number | null, hours: number | null, pourLeGroupe = false) => {
    setState((prev) => etatDepuisPrix(prev, saisie, hours, pourLeGroupe));
  }, []);

  return {
    currentStep,
    currentStepIndex,
    state,
    showResults,
    manquants,
    reponsesInconnues,
    inconnuesProfils,
    updateState,
    repondre,
    groupe,
    goNext,
    goPrev,
    goToStep,
    calculate,
    reset,
    updateFormationCosts,
  };
}
