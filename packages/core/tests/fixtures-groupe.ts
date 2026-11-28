import { createInitialWizardState } from '../src/types';
import type { ProfilSupplementaire, WizardState } from '../src/types';

/** Profil supplémentaire de test : un dirigeant artisan de 52 ans reconnu travailleur handicapé, deux personnes. */
export const supplementaire = (over: Partial<ProfilSupplementaire> = {}): ProfilSupplementaire => ({
  id: 'profil-2',
  nombre: 2,
  projetType: 'formation_dirigeant',
  contractType: null,
  anciennete_mois: null,
  isHandicap: true,
  ageBeneficiaire: 52,
  niveauDiplome: 'bac',
  typeAlternance: null,
  inscritFranceTravail: null,
  statutDirigeant: 'artisan',
  microEntrepreneur: false,
  soldeCpf: 900,
  regionBeneficiaireCode: null,
  ...over,
});

/** Groupe de test : trois salariés en CDI de 35 ans (profil principal) et le profil supplémentaire ci-dessus. */
export const groupe = (over: Partial<WizardState> = {}): WizardState => ({
  ...createInitialWizardState(),
  projetType: 'formation_salarie',
  contractType: 'cdi',
  ageBeneficiaire: 35,
  regionCode: '11',
  durationHours: 35,
  nombrePersonnes: 3,
  autresProfils: [supplementaire()],
  ...over,
});

export const AUJOURDHUI = '2026-10-05';
