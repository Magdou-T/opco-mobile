// ============================================================
// Catalogue d'aides et de financements : types des données
// (snake_case, comme les fichiers JSON) et des résultats (camelCase).
// ============================================================

import type {
  CertificationType,
  CodeRegion,
  Confidence,
  ContractType,
  NiveauCertification,
  NiveauDiplome,
  ProjetType,
  StatutBeneficiaire,
  StatutDirigeant,
  TypeAlternance,
  TypeStructure,
} from '../types';

export type Financeur =
  | 'etat'
  | 'region'
  | 'departement'
  | 'france_travail'
  | 'transitions_pro'
  | 'agefiph'
  | 'europe'
  | 'cpf'
  | 'opco'
  | 'faf'
  | 'fiscal'
  | 'branche'
  | 'autre';

/** Ce que l'aide réduit ou apporte. */
export type CategorieAide =
  | 'cout_formation' // paie la formation elle-même (frais pédagogiques, prise en charge, abondement) : réduit le reste à charge de la formation
  | 'aide_employeur' // versée à l'employeur (embauche, salaires…)
  | 'remuneration_beneficiaire' // revenu ou aide à la personne (rémunération, transport, hébergement, restauration, permis, équipement, mobilité) : jamais déduite du coût de la formation
  | 'avantage_fiscal_social' // crédit d'impôt, exonérations
  | 'service_gratuit'; // conseil ou accompagnement gratuit (sans montant)

export interface SourceAide {
  url: string;
  titre: string;
  /** Extrait mot pour mot de la page officielle justifiant les montants. */
  extrait: string;
}

/** Critères vérifiés automatiquement ; un critère absent n'impose aucune contrainte. */
export interface CriteresAide {
  regions?: CodeRegion[];
  /** Localisation prise en compte : établissement (défaut) ou résidence du bénéficiaire. */
  perimetre_region?: 'entreprise' | 'beneficiaire';
  departements?: string[];
  effectif_min?: number;
  effectif_max?: number;
  age_min?: number;
  age_max?: number;
  /** true : réservé aux personnes reconnues travailleurs handicapés. Uniquement vrai : `false` n'ajoute aucune restriction. */
  rqth?: true;
  niveaux_diplome?: NiveauDiplome[];
  niveau_certification_max?: NiveauCertification;
  niveau_certification_min?: NiveauCertification;
  contrats?: ContractType[];
  types_alternance?: TypeAlternance[];
  anciennete_min_mois?: number;
  inscrit_france_travail?: boolean;
  statuts_dirigeant?: StatutDirigeant[];
  /** true : réservé aux micro-entrepreneurs ; false : les exclut. */
  micro_entrepreneur?: boolean;
  certifications?: CertificationType[];
  /** true : réservé aux formations éligibles au CPF. Uniquement vrai : `false` n'ajoute aucune restriction. */
  eligible_cpf?: true;
  duree_min_heures?: number;
  duree_max_heures?: number;
  opcos?: string[];
  idcc?: string[];
  naf_prefixes?: string[];
  structures?: TypeStructure[];
  /** true : organisme de formation certifié Qualiopi exigé. Uniquement vrai : `false` n'ajoute aucune restriction. */
  qualiopi_requis?: true;
}

export interface MajorationAide {
  criteres: CriteresAide;
  valeur?: number | null;
  pourcentage?: number | null;
  plafond?: number | null;
  libelle: string;
}

export interface MontantAide {
  /**
   * Mode de calcul de l'estimation. `par_mois` : versé chaque mois de formation, au prorata de la durée de la
   * formation à temps plein (bornée à `duree_max_mois`) ; pour une aide versée sur une période indépendante de la
   * formation, utiliser `forfait` avec le total maximal.
   */
  mode: 'forfait' | 'pourcentage' | 'par_heure' | 'par_mois' | 'solde_cpf' | 'non_chiffre';
  valeur: number | null;
  pourcentage: number | null;
  base: 'cout_pedagogique' | 'cout_total' | null;
  plafond: number | null;
  /** `par_mois` : nombre maximal de mensualités, borne du prorata sur la durée de la formation. */
  duree_max_mois: number | null;
  /** Règle lisible : « 5 000 € pour la 1re année du contrat ». */
  libelle: string;
  /** La première majoration dont tous les critères sont remplis remplace valeur, pourcentage et plafond. */
  majorations?: MajorationAide[];
}

export interface RegleCumul {
  cumulable: boolean;
  /** Identifiants d'aides « au choix » (jamais additionnées). */
  alternatives?: string[];
  note?: string;
}

export interface Aide {
  id: string;
  nom: string;
  financeur: Financeur;
  financeur_nom: string;
  categorie: CategorieAide;
  projets: ProjetType[];
  beneficiaires: StatutBeneficiaire[];
  description: string;
  criteres: CriteresAide;
  conditions: string[];
  montant: MontantAide;
  cumul: RegleCumul;
  demarches: string[];
  url_demarche: string | null;
  /** Dispositifs nationaux gérés en région (Transitions Pro, Agefiph…). */
  liens_par_region?: Partial<Record<CodeRegion, string>>;
  sources: SourceAide[];
  /** AAAA-MM-JJ */
  derniere_verification: string;
  validite: { debut: string | null; fin: string | null };
  statut: 'actif' | 'a_confirmer' | 'suspendu';
  confidence: Confidence;
  ordre_empilement?: number;
}

export interface LienPortail {
  titre: string;
  url: string;
  type: 'region' | 'carif_oref' | 'transitions_pro' | 'france_travail' | 'agefiph' | 'autre';
}

export interface PortailRegional {
  region: CodeRegion;
  nom_region: string;
  liens: LienPortail[];
  derniere_verification: string;
}

/** Fichiers JSON du catalogue embarqué (data/aides/*.json). */
export interface FichierAides {
  meta: Record<string, unknown>;
  aides: Aide[];
}

export interface FichierPortails {
  meta: Record<string, unknown>;
  portails: PortailRegional[];
}

// --- Évaluation -------------------------------------------------------------

export type StatutEligibilite = 'eligible' | 'a_verifier' | 'non_eligible';

/** Situation évaluée (dérivée du parcours par profilDepuisWizard). null = information inconnue. */
export interface ProfilAides {
  projet: ProjetType;
  statutBeneficiaire: StatutBeneficiaire;
  regionEntreprise: CodeRegion | null;
  departementEntreprise: string | null;
  regionBeneficiaire: CodeRegion | null;
  /** Bornes connues de l'effectif (exact si min = max ; max null = sans borne haute). */
  effectifMin: number | null;
  effectifMax: number | null;
  codeNaf: string | null;
  idccs: string[];
  opco: string | null;
  /** null = statut de la structure inconnu (pas de recherche entreprise). */
  structures: TypeStructure[] | null;
  age: number | null;
  rqth: boolean;
  niveauDiplome: NiveauDiplome | null;
  contrat: ContractType | null;
  typeAlternance: TypeAlternance | null;
  ancienneteMois: number | null;
  inscritFranceTravail: boolean | null;
  statutDirigeant: StatutDirigeant | null;
  microEntrepreneur: boolean | null;
  certification: CertificationType | null;
  niveauFormationVise: NiveauCertification | null;
  eligibleCpf: boolean | null;
  dureeHeures: number | null;
  coutPedagogique: number | null;
  /** Frais annexes saisis (hébergement + restauration), en euros. */
  coutFraisAnnexes: number;
  qualiopi: boolean | null;
  soldeCpf: number | null;
}

export interface AideEvaluee {
  id: string;
  nom: string;
  financeur: Financeur;
  financeurNom: string;
  categorie: CategorieAide;
  description: string;
  statut: StatutEligibilite;
  /** non_eligible : critères non remplis ; a_verifier : informations à confirmer. */
  raisons: string[];
  /** true : aide sans rapport avec la situation (autre projet, autre public, autre région) — masquée à l'écran. */
  horsPerimetre: boolean;
  conditions: string[];
  /**
   * Rempli aussi pour une aide `non_eligible` (ce que l'aide verserait si le profil y avait droit) : ne jamais
   * l'afficher ni l'additionner pour une aide qui n'est pas `eligible`.
   */
  montantEstime: number | null;
  libelleMontant: string;
  cumulable: boolean;
  alternatives: string[];
  noteCumul: string | null;
  demarches: string[];
  urlDemarche: string | null;
  sources: SourceAide[];
  derniereVerification: string;
  confidence: Confidence;
  ordreEmpilement: number;
}

/** Ordre d'empilement par défaut dans le plan de financement (petit = d'abord). */
export const ORDRE_EMPILEMENT_DEFAUT: Record<Financeur, number> = {
  opco: 10,
  branche: 15,
  region: 20,
  departement: 25,
  agefiph: 30,
  europe: 40,
  etat: 50,
  france_travail: 50,
  transitions_pro: 50,
  faf: 60,
  fiscal: 80,
  autre: 85,
  cpf: 90,
};

export const FINANCEUR_LABELS: Record<Financeur, string> = {
  etat: 'État',
  region: 'Région',
  departement: 'Département',
  france_travail: 'France Travail',
  transitions_pro: 'Transitions Pro',
  agefiph: 'Agefiph',
  europe: 'Union européenne',
  cpf: 'Compte personnel de formation',
  opco: 'OPCO',
  faf: 'Fonds de formation des non-salariés',
  fiscal: 'Fiscalité',
  branche: 'Branche professionnelle',
  autre: 'Autres financeurs',
};
