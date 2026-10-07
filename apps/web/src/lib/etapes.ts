// ============================================================
// Étapes du simulateur du site. Le parcours est propre au site : l'app mobile
// garde le sien (WIZARD_STEPS dans @opco/core) et le moteur n'en impose aucun.
// ============================================================

export type EtapeSite = 'identification' | 'situation' | 'formation' | 'frais' | 'recap';

/** Ordre du parcours et libellés de la barre de progression (le numéro affiché est la position dans cette liste). */
export const ETAPES: { key: EtapeSite; label: string }[] = [
  { key: 'identification', label: 'Entreprise' },
  { key: 'situation', label: 'Bénéficiaire' },
  { key: 'formation', label: 'Formation' },
  { key: 'frais', label: 'Frais' },
  { key: 'recap', label: 'Récapitulatif' },
];
