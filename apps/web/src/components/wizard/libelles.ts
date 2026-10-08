// Libellés et icônes partagés par plusieurs étapes du simulateur (le récapitulatif reprend ceux des étapes).
import type { ProjetType, TransportMode } from '@opco/core';
import type { IconName } from '@/components/ui/Icon';

/** Icône de chaque projet (cartes de l'étape Projet, section Projet du récapitulatif). */
export const ICONES_PROJET: Record<ProjetType, IconName> = {
  formation_salarie: 'livre',
  reconversion_salarie: 'virage',
  recrutement_demandeur_emploi: 'recrutement',
  alternance: 'diplome',
  formation_dirigeant: 'mallette',
};

/** Modes de transport de l'étape Frais. */
export const TRANSPORT_LABELS: Record<TransportMode, string> = {
  train: 'Train',
  avion: 'Avion',
  voiture: 'Voiture',
  autre: 'Autre',
};
