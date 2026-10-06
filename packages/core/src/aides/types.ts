// ============================================================
// Catalogue d'aides et de financements : types des donnees
// (snake_case, comme les fichiers JSON) et des resultats (camelCase).
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

/** Ce que l'aide reduit ou apporte. */
export type CategorieAide =
  | 'cout_formation' // reduit le cout pedagogique et les frais annexes
  | 'aide_employeur' // versee a l'employeur (embauche, salaires...)
  | 'remuneration_beneficiaire' // revenu du beneficiaire pendant la formation
  | 'avantage_fiscal_social' // credit d'impot, exonerations
  | 'service_gratuit'; // conseil ou accompagnement gratuit (sans montant)

export interface SourceAide {
  url: string;
  titre: string;
  /** Extrait mot pour mot de la page officielle justifiant les montants. */
  extrait: string;
}

/** Criteres verifies automatiquement ; un critere absent n'impose aucune contrainte. */
export interface CriteresAide {
  regions?: CodeRegion[];
  /** Localisation prise en compte : etablissement (defaut) ou residence du beneficiaire. */
  perimetre_region?: 'entreprise' | 'beneficiaire';
  departements?: string[];
  effectif_min?: number;
  effectif_max?: number;
  age_min?: number;
  age_max?: number;
  /** true : reserve aux personnes reconnues travailleurs handicapes. */
  rqth?: boolean;
  niveaux_diplome?: NiveauDiplome[];
  niveau_certification_max?: NiveauCertification;
  niveau_certification_min?: NiveauCertification;
  contrats?: ContractType[];
  types_alternance?: TypeAlternance[];
  anciennete_min_mois?: number;
  inscrit_france_travail?: boolean;
  statuts_dirigeant?: StatutDirigeant[];
  /** true : reserve aux micro-entrepreneurs ; false : les exclut. */
  micro_entrepreneur?: boolean;
  certifications?: CertificationType[];
  eligible_cpf?: boolean;
  duree_min_heures?: number;
  duree_max_heures?: number;
  opcos?: string[];
  idcc?: string[];
  naf_prefixes?: string[];
  structures?: TypeStructure[];
  qualiopi_requis?: boolean;
}

export interface MajorationAide {
  criteres: CriteresAide;
  valeur?: number | null;
  pourcentage?: number | null;
  plafond?: number | null;
  libelle: string;
}

export interface MontantAide {
  mode: 'forfait' | 'pourcentage' | 'par_heure' | 'par_mois' | 'solde_cpf' | 'non_chiffre';
  valeur: number | null;
  pourcentage: number | null;
  base: 'cout_pedagogique' | 'cout_total' | null;
  plafond: number | null;
  duree_max_mois: number | null;
  /** Regle lisible : « 5 000 € pour la 1re annee du contrat ». */
  libelle: string;
  /** La premiere majoration dont tous les criteres sont remplis remplace valeur, pourcentage et plafond. */
  majorations?: MajorationAide[];
}

export interface RegleCumul {
  cumulable: boolean;
  /** Identifiants d'aides « au choix » (jamais additionnees). */
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
  /** Dispositifs nationaux geres en region (Transitions Pro, Agefiph...). */
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

/** Fichiers JSON du catalogue embarque (data/aides/*.json). */
export interface FichierAides {
  meta: Record<string, unknown>;
  aides: Aide[];
}

export interface FichierPortails {
  meta: Record<string, unknown>;
  portails: PortailRegional[];
}

// --- Evaluation ---------------------------------------------------------------

export type StatutEligibilite = 'eligible' | 'a_verifier' | 'non_eligible';

/** Situation evaluee (derivee du parcours par profilDepuisWizard). null = information inconnue. */
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
  /** Frais annexes saisis (hebergement + restauration), en euros. */
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
  /** non_eligible : criteres non remplis ; a_verifier : informations a confirmer. */
  raisons: string[];
  /** true : aide sans rapport avec la situation (autre projet, autre public, autre region) — masquee a l'ecran. */
  horsPerimetre: boolean;
  conditions: string[];
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

/** Ordre d'empilement par defaut dans le plan de financement (petit = d'abord). */
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
  etat: 'Etat',
  region: 'Region',
  departement: 'Departement',
  france_travail: 'France Travail',
  transitions_pro: 'Transitions Pro',
  agefiph: 'Agefiph',
  europe: 'Union europeenne',
  cpf: 'Compte personnel de formation',
  opco: 'OPCO',
  faf: 'Fonds de formation des non-salaries',
  fiscal: 'Fiscalite',
  branche: 'Branche professionnelle',
  autre: 'Autres financeurs',
};
