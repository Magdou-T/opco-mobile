// ============================================================
// Types partagés pour le Calculateur de Financement OPCO
// ============================================================

// --- OPCO Data Schema ---

export type Confidence = 'exact' | 'estimated' | 'depends_on_branche';

export interface SourcedValue<T = string> {
  value: T;
  confidence: Confidence;
  source_url: string;
  note?: string;
}

export interface OpcoData {
  slug: string;
  name: string;
  secteurs: string;
  secteurs_source: string;
  email_contact: string;
  url_finance_page: string;

  // Formations
  types_formations: string[];
  types_formations_source: string;

  // Coûts pédagogiques
  cout_horaire_inter: SourcedValue<number | null>;
  cout_horaire_intra: SourcedValue<number | null>;
  cout_horaire_metier: SourcedValue<number | null>;

  // Prise en charge salaires
  prise_en_charge_salaires: SourcedValue<number | null>;
  prise_en_charge_salaires_mode: 'euro_par_heure' | 'pourcentage_pedagogique' | 'selon_accord' | 'inclus_plafond_horaire';

  // Frais annexes
  frais_transport: SourcedValue<number | null>;
  frais_hebergement: SourcedValue<number | null>;
  frais_restauration: SourcedValue<number | null>;
  frais_annexes_pourcentage: SourcedValue<number | null>; // ex: Atlas 8%

  // Budget et plafonds
  budget_annuel_max: SourcedValue<number | null>;
  budget_annuel_description: string;
  quota_horaire_min: number | null;
  quota_horaire_max: number | null;

  // Profils et conditions
  profils_candidats: string[];
  tailles_cibles: string;
  priorite_tpe_pme: boolean;
  duree_min_formation: string | null;

  // Processus
  processus_approbation: string;
  delai_validation: string;
  mode_paiement: string;

  // Alternance
  alternance_apprentissage: string;
  alternance_professionnalisation: string;

  // CPF
  cpf_abondement: boolean;
  cpf_details: string;

  // VAE
  vae_possible: boolean;
  vae_details: string;

  // Limites
  limite_dossiers_an: string;

  // Spécificités
  specificites: string;
  points_cles_maximisation: string;

  // Taille entreprise -> plafonds spécifiques
  plafonds_par_taille?: PlafondTaille[];
}

export interface PlafondTaille {
  taille: CompanySize;
  cout_horaire_max: number | null;
  budget_annuel_max: number | null;
  quota_horaire_max: number | null;
  description: string;
}

// --- Wizard / User Input Types ---

export type ContractType = 'cdi' | 'cdd' | 'interim' | 'alternance';
export type CompanySize = 'less_11' | '11_49' | '50_299' | '300_plus';
export type TrainingType = 'qualification' | 'certification' | 'vae' | 'reconversion' | 'cqp' | 'habilitation';
export type CertificationType = 'rncp' | 'cqp' | 'diplome' | 'habilitation' | 'autre';
export type TrainingMode = 'presentiel' | 'distance' | 'hybride';
export type TransportMode = 'train' | 'avion' | 'voiture' | 'autre';

export interface WizardState {
  // Step 1: OPCO Identification
  opcoKnown: boolean | null;
  selectedOpcoSlug: string | null;
  companyName: string | null;
  sirenNumber: string | null;
  detectedOpcoSlug: string | null;
  detectedIdcc: string | null;
  detectedCompanyName: string | null;

  // Step 2: Situation professionnelle
  contractType: ContractType | null;
  companySize: CompanySize | null;
  anciennete_mois: number | null;
  isHandicap: boolean;
  isReconversion: boolean;
  isSortieChomage: boolean;

  // Step 3: Formation
  formationNom: string | null;
  formationType: TrainingType | null;
  certificationLevel: CertificationType | null;
  durationHours: number | null;
  pedagogyCostTotal: number | null;
  pedagogyCostPerHour: number | null;
  trainingMode: TrainingMode | null;
  organismeFormation: string | null;

  // Step 4: Frais annexes
  needsTransport: boolean;
  transportMode: TransportMode | null;
  transportDistanceKm: number | null;
  needsAccommodation: boolean;
  accommodationNights: number | null;
  accommodationCostPerNight: number | null;
  needsMeals: boolean;
  mealCostPerDay: number | null;
  trainingDays: number | null;
}

// --- Calculation Result Types ---

export interface FundingLine {
  label: string;
  requestedAmount: number;
  fundedAmount: number;
  remainder: number;
  confidence: Confidence;
  sourceUrl: string;
  note?: string;
  /** Detailed calculation explanation shown in expandable section */
  details?: string[];
}

export interface FundingResult {
  opcoName: string;
  opcoSlug: string;
  opcoEmail: string;
  opcoUrl: string;
  lines: FundingLine[];
  totalRequested: number;
  totalFunded: number;
  totalRemainder: number;
  budgetCapApplied: boolean;
  budgetCapAmount: number | null;
  warnings: string[];
  conditions: string[];
  nextSteps: { label: string; url: string }[];
  delaiValidation: string;
  modePaiement: string;
}

// --- SIREN API Types ---

export interface SirenSearchResult {
  siren: string;
  nom_complet: string;
  siege: {
    code_postal: string;
    libelle_commune: string;
  };
  activite_principale: string;
  nombre_etablissements_ouverts: number;
  liste_idcc: string[];
  convention_collective_renseignee: boolean;
}

export interface SirenApiResponse {
  results: SirenSearchResult[];
  total_results: number;
}

// --- IDCC Mapping ---

export interface IdccOpcoMapping {
  [idcc: string]: {
    opco_slug: string;
    branche_name: string;
  };
}

// --- Wizard Step ---

export type WizardStep = 'identification' | 'situation' | 'formation' | 'frais' | 'recap';

export const WIZARD_STEPS: { key: WizardStep; label: string; icon: string }[] = [
  { key: 'identification', label: 'Votre OPCO', icon: '1' },
  { key: 'situation', label: 'Situation professionnelle', icon: '2' },
  { key: 'formation', label: 'Formation souhaitée', icon: '3' },
  { key: 'frais', label: 'Frais annexes', icon: '4' },
  { key: 'recap', label: 'Récapitulatif', icon: '5' },
];

// --- Company Size Labels ---

export const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  less_11: 'Moins de 11 salariés',
  '11_49': '11 à 49 salariés',
  '50_299': '50 à 299 salariés',
  '300_plus': '300 salariés et plus',
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  interim: 'Intérim',
  alternance: 'Alternance (apprentissage / professionnalisation)',
};

export const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  qualification: 'Qualification professionnelle',
  certification: 'Certification',
  vae: 'VAE (Validation des Acquis de l\'Expérience)',
  reconversion: 'Reconversion professionnelle',
  cqp: 'CQP (Certificat de Qualification Professionnelle)',
  habilitation: 'Habilitation',
};

export const TRAINING_MODE_LABELS: Record<TrainingMode, string> = {
  presentiel: 'Présentiel',
  distance: 'À distance',
  hybride: 'Hybride (présentiel + distance)',
};

// Initial wizard state
export function createInitialWizardState(): WizardState {
  return {
    opcoKnown: null,
    selectedOpcoSlug: null,
    companyName: null,
    sirenNumber: null,
    detectedOpcoSlug: null,
    detectedIdcc: null,
    detectedCompanyName: null,
    contractType: null,
    companySize: null,
    anciennete_mois: null,
    isHandicap: false,
    isReconversion: false,
    isSortieChomage: false,
    formationNom: null,
    formationType: null,
    certificationLevel: null,
    durationHours: null,
    pedagogyCostTotal: null,
    pedagogyCostPerHour: null,
    trainingMode: null,
    organismeFormation: null,
    needsTransport: false,
    transportMode: null,
    transportDistanceKm: null,
    needsAccommodation: false,
    accommodationNights: null,
    accommodationCostPerNight: null,
    needsMeals: false,
    mealCostPerDay: null,
    trainingDays: null,
  };
}
