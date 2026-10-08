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

/** Tranche d'un barème dégressif selon la durée de la formation (ex. Uniformation). */
export interface CoutHoraireSeuil {
  /** Durée (heures) jusqu'à laquelle ce taux s'applique ; null = au-delà du dernier seuil. */
  max_heures: number | null;
  /** Plafond horaire de la tranche (€/h). */
  valeur: number;
}

/**
 * Lecture d'un barème dégressif :
 * - 'par_tranche' (défaut) : chaque tranche d'heures est financée à son propre taux ;
 * - 'selon_duree_totale' : un seul taux, choisi selon la durée totale de la formation.
 */
export type ModeSeuils = 'par_tranche' | 'selon_duree_totale';

/**
 * Portée du plafond annuel :
 * - 'global' (défaut) : tous postes confondus ;
 * - 'pedagogie' : coûts pédagogiques seuls (salaires et frais annexes financés en plus).
 */
export type PorteeBudget = 'global' | 'pedagogie';

/**
 * Unité du forfait de restauration publié par l'OPCO :
 * - 'repas' : montant par repas (l'estimation retient un repas par jour de formation) ;
 * - 'jour' (défaut) : montant par jour de formation.
 */
export type UniteRestauration = 'repas' | 'jour';

/**
 * Champ descriptif libre d'un OPCO : texte libre ou objet détaillé { description, source_url, … } (null quand rien n'est
 * publié). Les données réelles mélangent les trois formes (OPCO EP, OPCO Santé, Uniformation) et FreeTextSchema les accepte.
 * Ces champs ne pilotent pas le calcul : un consommateur qui les affiche doit tolérer l'objet et null.
 */
export type FreeText = string | Record<string, unknown> | null;

export interface OpcoData {
  slug: string;
  name: string;
  /** Dénomination officielle complète de l'OPCO (« Opérateur de compétences de … »), affichée à côté du nom court. */
  nom_complet?: string;
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
  /**
   * Plafond horaire des formations certifiantes (CQP, certification, habilitation) ; à défaut, `cout_horaire_inter`.
   * Pour une habilitation, ce taux n'établit pas le plafond (les formations réglementaires ont parfois un taux distinct) :
   * une confiance « exact » devient « estimated » (voir `resolveHourlyCeiling`), sauf pour 0, marqueur d'enveloppe épuisée.
   */
  cout_horaire_metier: SourcedValue<number | null>;
  /** Barème dégressif selon la durée (prioritaire sur les plafonds horaires ci-dessus). */
  cout_horaire_seuils?: CoutHoraireSeuil[];
  cout_horaire_seuils_mode?: ModeSeuils;
  /** true : le barème dégressif ne s'applique qu'aux formations certifiantes ; sinon le plafond horaire habituel s'applique. */
  cout_horaire_seuils_certifiant?: boolean;

  // Prise en charge salaires
  prise_en_charge_salaires: SourcedValue<number | null>;
  prise_en_charge_salaires_mode: 'euro_par_heure' | 'pourcentage_pedagogique' | 'selon_accord' | 'inclus_plafond_horaire';

  // Frais annexes
  frais_transport: SourcedValue<number | null>;
  frais_hebergement: SourcedValue<number | null>;
  frais_restauration: SourcedValue<number | null>;
  /** Unité du forfait de restauration : par repas (l'estimation retient un repas par jour de formation) ou par jour. Absent : par jour. */
  frais_restauration_unite?: UniteRestauration;
  frais_annexes_pourcentage: SourcedValue<number | null>; // ex: Atlas 8%

  // Budget et plafonds
  budget_annuel_max: SourcedValue<number | null>;
  budget_annuel_portee?: PorteeBudget;
  budget_annuel_description: string;
  quota_horaire_min: number | null;
  /** Plafond d'heures : par action de formation, par salarié et par an, ou par stagiaire selon l'OPCO (voir `budget_annuel_description`). */
  quota_horaire_max: number | null;

  // Profils et conditions
  profils_candidats: string[];
  tailles_cibles: string;
  priorite_tpe_pme: boolean;
  duree_min_formation: string | null;

  // Processus
  processus_approbation: string;
  delai_validation: FreeText;
  mode_paiement: string;

  // Alternance
  alternance_apprentissage: FreeText;
  alternance_professionnalisation: FreeText;

  // CPF
  cpf_abondement: boolean;
  cpf_details: FreeText;

  // VAE
  vae_possible: boolean;
  vae_details: FreeText;

  // Limites
  limite_dossiers_an: FreeText;

  // Spécificités
  specificites: string;
  points_cles_maximisation: string;

  // Taille entreprise -> plafonds spécifiques
  plafonds_par_taille?: PlafondTaille[];

  // Dispositifs de financement complémentaires (cumuls d'enveloppes)
  dispositifs_complementaires?: DispositifComplementaire[];

  // Barèmes spécifiques par branche professionnelle (priment sur le défaut)
  variantes_branche?: VarianteBranche[];

  /** Date de dernière vérification des barèmes auprès des sources officielles (AAAA-MM-JJ). */
  derniere_verification?: string;

  /** Alertes publiées par l'OPCO (fonds épuisés, changements en cours d'année…), datées et sourcées. */
  alertes?: AlerteOpco[];
  /** Précision sur les barèmes par branche (par exemple pourquoi il n'y a pas de variante). */
  note_variantes?: string;
}

/**
 * Barème spécifique d'une branche professionnelle au sein d'un OPCO.
 * Chaque champ renseigné REMPLACE le champ correspondant du barème par
 * défaut de l'OPCO ; les champs absents héritent du défaut.
 * La variante est appliquée si l'IDCC détecté (recherche SIREN) figure dans
 * `idcc`, ou si l'utilisateur sélectionne la branche manuellement.
 */
export interface VarianteBranche {
  id: string;
  branche_nom: string;
  /** Codes IDCC couverts (4 chiffres, ex. "1516"). */
  idcc: string[];
  /** Page de critères de la branche (https), rendue en lien par le site. */
  source_url: string;
  confidence: Confidence;
  note?: string;
  /**
   * true : le barème de la variante est celui d'un plan conventionnel de branche qui prend le relais d'une enveloppe de plan de
   * développement des compétences épuisée (AKTO, organismes de formation, octobre 2026) ; le plafond annuel est
   * `budget_annuel_max`. Absent sinon (jamais `false`). Lu sur la variante rendue par `resolveVarianteBranche`.
   */
  relais_plan_conventionnel?: true;

  // Overrides (optionnels : héritent du défaut OPCO si absents)
  cout_horaire_inter?: SourcedValue<number | null>;
  cout_horaire_metier?: SourcedValue<number | null>;
  cout_horaire_seuils?: CoutHoraireSeuil[];
  cout_horaire_seuils_mode?: ModeSeuils;
  /**
   * true : le barème dégressif ne s'applique qu'aux formations certifiantes ; sinon le plafond horaire habituel s'applique.
   * Le drapeau suit le barème : absent, la variante reprend celui de l'OPCO avec ses seuils. Une variante qui publie ses
   * propres seuils doit le préciser quand le barème de l'OPCO est réservé aux certifiantes (false : valable pour toutes les formations).
   */
  cout_horaire_seuils_certifiant?: boolean;
  prise_en_charge_salaires?: SourcedValue<number | null>;
  prise_en_charge_salaires_mode?: OpcoData['prise_en_charge_salaires_mode'];
  frais_transport?: SourcedValue<number | null>;
  frais_hebergement?: SourcedValue<number | null>;
  frais_restauration?: SourcedValue<number | null>;
  /** Unité du forfait de restauration de la branche ; absent : celle de l'OPCO (même règle d'héritage que `frais_restauration`). */
  frais_restauration_unite?: UniteRestauration;
  /** Forfait de frais annexes en % des coûts pédagogiques financés ; value null : pas de forfait dans cette branche. */
  frais_annexes_pourcentage?: SourcedValue<number | null>;
  budget_annuel_max?: SourcedValue<number | null>;
  budget_annuel_portee?: PorteeBudget;
  budget_annuel_description?: string;
  plafonds_par_taille?: PlafondTaille[];
}

export interface PlafondTaille {
  taille: CompanySize;
  /**
   * Plafond horaire propre à cette taille (prioritaire sur les plafonds de l'OPCO). À renseigner seulement quand il diffère
   * selon la taille : une valeur qui répète `cout_horaire_inter` ou `cout_horaire_metier` reste à null, le champ garde alors
   * sa confiance et sa source.
   */
  cout_horaire_max: number | null;
  /** Confiance de `cout_horaire_max` ; absent : « exact ». */
  confidence?: Confidence;
  /** Source de `cout_horaire_max` ; absent : la page de critères de l'OPCO. */
  source_url?: string;
  budget_annuel_max: number | null;
  /** Plafond d'heures : par action de formation, par salarié et par an, ou par stagiaire selon l'OPCO (voir `description`). */
  quota_horaire_max: number | null;
  description: string;
  /**
   * Prise en charge des salaires en €/h propre à cette taille (mode euro_par_heure). Absent : taux de l'OPCO ; null : pas de prise en charge pour cette taille.
   * Un taux propre à la taille l'emporte sur le salaire d'une variante de branche qui hérite des `plafonds_par_taille` de l'OPCO : une variante qui change les salaires doit aussi surcharger ces entrées.
   */
  prise_en_charge_salaires_horaire?: number | null;
}

/**
 * Dispositif de financement complémentaire au plan de développement des
 * compétences (PDC) mutualisé : abondements CPF, dispositifs hors budget
 * annuel, catalogues dédiés, versements volontaires…
 */
export interface DispositifComplementaire {
  id: string;
  nom: string;
  /**
   * Règle de cumul avec l'enveloppe PDC :
   * - hors_budget : ne consomme PAS le budget annuel PDC (s'ajoute)
   * - additif     : enveloppe distincte qui s'ajoute au PDC
   * - alternatif  : remplace le PDC (catalogue/dispositif dédié, non cumulable)
   */
  cumul: 'hors_budget' | 'additif' | 'alternatif';
  /** Plafond en euros si publié (null si non chiffré publiquement). */
  montant_max: number | null;
  unite: 'par_stagiaire' | 'par_dossier' | 'par_an' | 'par_jour' | 'par_heure' | null;
  /** Pourcentage des coûts pédagogiques pris en charge, si applicable. */
  pourcentage_couts: number | null;
  description: string;
  /** Conditions d'attribution, affichées telles quelles à l'utilisateur. */
  conditions: string[];
  /** Démarche concrète : où et comment faire la demande. */
  demarches: string;
  /** Tailles d'entreprise éligibles (null = toutes). */
  tailles_eligibles: CompanySize[] | null;
  /** Public visé si restreint (ex. « salariés de 50 ans et plus »). */
  publics: string | null;
  /** Réservé aux entreprises de ces conventions collectives (IDCC sur 4 chiffres) ; absent ou vide : toutes les entreprises. */
  idcc?: string[];
  /** Précision sur le dispositif (portée, plafond, particularité). */
  note?: string;
  confidence: Confidence;
  source_url: string;
}

// --- Alertes publiées par les OPCO ---

export type TypeAlerteOpco =
  | 'fonds_epuises'
  | 'changement_criteres'
  | 'dispositif_termine'
  | 'dispositif_non_confirme'
  | 'changement_paiement'
  | 'acces_restreint'
  | 'evolution_en_cours_annee'
  | 'echeance';

/** Alerte datée et sourcée publiée par un OPCO (ex. enveloppe épuisée dans une branche). */
export interface AlerteOpco {
  type: TypeAlerteOpco;
  /** Branche ou périmètre concerné, tel que publié. */
  branche: string;
  /** IDCC concernés ; vide = toutes les entreprises de l'OPCO. */
  idcc: string[];
  source_url: string;
  /** Extrait mot pour mot de la source. */
  extrait: string;
  /** Date de vérification (AAAA-MM-JJ). */
  verifie_le: string;
}

export const ALERTE_OPCO_LABELS: Record<TypeAlerteOpco, string> = {
  fonds_epuises: 'Fonds épuisés',
  changement_criteres: 'Critères modifiés',
  dispositif_termine: 'Dispositif terminé',
  dispositif_non_confirme: 'Dispositif non confirmé',
  changement_paiement: 'Modalités de paiement modifiées',
  acces_restreint: 'Accès restreint',
  evolution_en_cours_annee: "Évolution en cours d'année",
  echeance: 'Échéance',
};

// --- Wizard / User Input Types ---

export type ContractType = 'cdi' | 'cdd' | 'interim' | 'alternance';
export type CompanySize = 'less_11' | '11_49' | '50_299' | '300_plus';
export type TrainingType = 'non_certifiante' | 'qualification' | 'certification' | 'vae' | 'reconversion' | 'cqp' | 'habilitation';
export type CertificationType = 'rncp' | 'rs' | 'cqp' | 'diplome' | 'habilitation' | 'aucune' | 'autre';
export type TrainingMode = 'presentiel' | 'distance' | 'hybride';
export type TransportMode = 'train' | 'avion' | 'voiture' | 'autre';

// --- Projet, bénéficiaire, géographie ---

export type ProjetType =
  | 'formation_salarie'
  | 'reconversion_salarie'
  | 'recrutement_demandeur_emploi'
  | 'alternance'
  | 'formation_dirigeant';

/** Personne qui suit la formation ou qui est recrutée. */
export type StatutBeneficiaire = 'salarie' | 'demandeur_emploi' | 'alternant' | 'dirigeant';
export type NiveauDiplome = 'sans_diplome' | 'cap_bep' | 'bac' | 'bac_plus_2' | 'bac_plus_3_et_plus';
/** Niveau du cadre national des certifications (3 = CAP … 8 = doctorat). */
export type NiveauCertification = 3 | 4 | 5 | 6 | 7 | 8;
export type StatutDirigeant =
  | 'commercant'
  | 'artisan'
  | 'profession_liberale'
  | 'exploitant_agricole'
  | 'assimile_salarie';
export type TypeStructure = 'ess' | 'siae' | 'association';
export type TypeAlternance = 'apprentissage' | 'professionnalisation';
/** Certitude de l'identification de l'OPCO ('confirme' : source officielle sous licence). */
export type CertitudeOpco = 'confirme' | 'fiable' | 'a_confirmer' | 'inconnu';
/** Code région INSEE (13 régions métropolitaines + 5 régions d'outre-mer). */
export type CodeRegion =
  | '84' | '27' | '53' | '24' | '94' | '44' | '32' | '11' | '28' | '75' | '76' | '52' | '93'
  | '01' | '02' | '03' | '04' | '06';

export const STATUT_PAR_PROJET: Record<ProjetType, StatutBeneficiaire> = {
  formation_salarie: 'salarie',
  reconversion_salarie: 'salarie',
  recrutement_demandeur_emploi: 'demandeur_emploi',
  alternance: 'alternant',
  formation_dirigeant: 'dirigeant',
};

export const PROJET_LABELS: Record<ProjetType, { label: string; description: string }> = {
  formation_salarie: {
    label: 'Former un salarié',
    description: "Développer les compétences d'un salarié de l'entreprise",
  },
  reconversion_salarie: {
    label: "Reconversion d'un salarié",
    description: "Changer de métier, dans l'entreprise ou en dehors",
  },
  recrutement_demandeur_emploi: {
    label: "Recruter et former un demandeur d'emploi",
    description: "Former une personne inscrite à France Travail avant ou à l'embauche",
  },
  alternance: {
    label: 'Recruter en alternance',
    description: "Contrat d'apprentissage ou de professionnalisation",
  },
  formation_dirigeant: {
    label: 'Former le dirigeant',
    description: "Chef d'entreprise, travailleur indépendant ou dirigeant non salarié",
  },
};

export const NIVEAU_DIPLOME_LABELS: Record<NiveauDiplome, string> = {
  sans_diplome: 'Sans diplôme',
  cap_bep: 'CAP / BEP',
  bac: 'Bac',
  bac_plus_2: 'Bac +2',
  bac_plus_3_et_plus: 'Bac +3 et plus',
};

export const NIVEAU_CERTIFICATION_LABELS: Record<NiveauCertification, string> = {
  3: 'Niveau 3 (CAP, BEP)',
  4: 'Niveau 4 (Bac)',
  5: 'Niveau 5 (Bac +2)',
  6: 'Niveau 6 (Bac +3 / +4)',
  7: 'Niveau 7 (Bac +5)',
  8: 'Niveau 8 (Doctorat)',
};

export const STATUT_DIRIGEANT_LABELS: Record<StatutDirigeant, string> = {
  commercant: 'Commerçant (ou prestataire de services)',
  artisan: 'Artisan',
  profession_liberale: 'Profession libérale',
  exploitant_agricole: 'Exploitant agricole',
  assimile_salarie: 'Dirigeant assimilé salarié (président de SAS, gérant minoritaire…)',
};

export const TYPE_ALTERNANCE_LABELS: Record<TypeAlternance, string> = {
  apprentissage: "Contrat d'apprentissage",
  professionnalisation: 'Contrat de professionnalisation',
};

export const CERTIFICATION_LABELS: Record<CertificationType, string> = {
  rncp: 'RNCP (titre ou diplôme enregistré)',
  rs: 'Répertoire spécifique (RS)',
  cqp: 'CQP (certificat de qualification professionnelle)',
  diplome: "Diplôme d'État",
  habilitation: 'Habilitation',
  aucune: 'Aucune certification',
  autre: 'Autre',
};

export interface WizardState {
  // Étape 0 : projet
  projetType: ProjetType | null;

  // Étape 1 : entreprise et OPCO
  opcoKnown: boolean | null;
  selectedOpcoSlug: string | null;
  companyName: string | null;
  sirenNumber: string | null;
  /** SIRET du siège (recherche entreprise). */
  siret: string | null;
  detectedOpcoSlug: string | null;
  detectedIdcc: string | null;
  detectedCompanyName: string | null;
  /** Branche choisie manuellement (id de VarianteBranche) : prime sur l'IDCC détecté. */
  selectedBrancheId: string | null;
  /** Certitude de l'identification automatique de l'OPCO. */
  opcoCertitude: CertitudeOpco | null;
  /** Tous les IDCC déclarés par l'entreprise et ses établissements. */
  idccEtablissements: string[];
  /** IDCC déclarés par le siège (présélection en cas de pluralité). */
  idccSiege: string[];
  regionCode: CodeRegion | null;
  departementCode: string | null;
  codeNaf: string | null;
  /** Code de tranche d'effectif INSEE (indicatif, année N-2). */
  trancheEffectifInsee: string | null;
  companySize: CompanySize | null;
  /** Effectif exact, si l'utilisateur le précise (affine les seuils des aides). */
  effectif: number | null;
  /** Statuts connus via la recherche entreprise (ESS, SIAE, association). */
  structures: TypeStructure[];
  /** Budget formation déjà consommé auprès de l'OPCO cette année (euros). Déduit du plafond annuel. */
  budgetDejaConsomme: number | null;

  // Étape 2 : bénéficiaire
  contractType: ContractType | null;
  anciennete_mois: number | null;
  isHandicap: boolean;
  isReconversion: boolean;
  isSortieChomage: boolean;
  ageBeneficiaire: number | null;
  niveauDiplome: NiveauDiplome | null;
  typeAlternance: TypeAlternance | null;
  inscritFranceTravail: boolean | null;
  statutDirigeant: StatutDirigeant | null;
  microEntrepreneur: boolean | null;
  soldeCpf: number | null;
  /** Région de résidence du bénéficiaire, si différente de celle de l'entreprise. */
  regionBeneficiaireCode: CodeRegion | null;

  // Étape 3 : formation
  formationNom: string | null;
  formationType: TrainingType | null;
  certificationLevel: CertificationType | null;
  niveauFormationVise: NiveauCertification | null;
  eligibleCpf: boolean | null;
  /** Mois de début prévu (AAAA-MM). */
  dateDebutFormation: string | null;
  organismeQualiopi: boolean | null;
  durationHours: number | null;
  pedagogyCostTotal: number | null;
  pedagogyCostPerHour: number | null;
  trainingMode: TrainingMode | null;
  organismeFormation: string | null;

  // Étape 4 : frais annexes
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

/** Poste de dépense d'une ligne de financement OPCO. */
export type PosteFinancement =
  | 'pedagogie'
  | 'salaires'
  | 'transport'
  | 'hebergement'
  | 'restauration'
  | 'frais_annexes';

export interface FundingLine {
  poste: PosteFinancement;
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

/** Dispositif complémentaire évalué pour la situation de l'utilisateur. */
export interface DispositifEligible {
  id: string;
  nom: string;
  cumul: 'hors_budget' | 'additif' | 'alternatif';
  /** Montant estimé pour CETTE formation si calculable (forfait ou % des coûts), sinon null. */
  montantEstime: number | null;
  description: string;
  conditions: string[];
  demarches: string;
  publics: string | null;
  /** Précision sur le dispositif (portée, plafond, particularité), reprise de `DispositifComplementaire.note` ; absente sans note. */
  note?: string;
  confidence: Confidence;
  sourceUrl: string;
}

export interface FundingResult {
  opcoName: string;
  opcoSlug: string;
  opcoEmail: string;
  opcoUrl: string;
  /** Dispositif au titre duquel l'estimation principale est calculée. */
  dispositifPrincipal: string;
  /**
   * true : entreprise de 50 salariés et plus pour laquelle l'OPCO ne publie aucune enveloppe (conventionnelle ou volontaire).
   * Les fonds mutualisés du plan de développement des compétences lui sont fermés (art. L. 6332-17 du code du travail) :
   * aucun financement n'est estimé sur ce dispositif et `demarches` renvoie vers les autres financements.
   */
  pdcFerme: boolean;
  /** Nom de la branche dont le barème a été appliqué (null = barème général de l'OPCO). */
  brancheAppliquee: string | null;
  lines: FundingLine[];
  totalRequested: number;
  totalFunded: number;
  totalRemainder: number;
  budgetCapApplied: boolean;
  budgetCapAmount: number | null;
  /** Budget déjà consommé cette année, déduit du plafond annuel. */
  budgetDejaConsomme: number;
  /** Dispositifs complémentaires éligibles à la situation (cumuls possibles). */
  dispositifsComplementaires: DispositifEligible[];
  /**
   * Enveloppe maximale potentielle = financement PDC estimé + dispositifs
   * cumulables chiffrables (hors_budget et additif). Les dispositifs
   * « alternatifs » ne sont pas additionnés.
   */
  enveloppeMaxPotentielle: number;
  warnings: string[];
  /** Alertes publiées par l'OPCO qui concernent l'entreprise (sa convention collective, ou toutes les branches). */
  alertes: AlerteOpco[];
  conditions: string[];
  /** Démarches concrètes, dans l'ordre, pour obtenir le financement. */
  demarches: string[];
  nextSteps: { label: string; url: string }[];
  /** Délai de validation publié par l'OPCO, en texte ; chaîne vide quand son champ libre est un objet détaillé ou null. */
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
  non_certifiante: 'Formation courte / non certifiante (plan de développement des compétences)',
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

export function createInitialWizardState(): WizardState {
  return {
    projetType: null,
    opcoKnown: null,
    selectedOpcoSlug: null,
    companyName: null,
    sirenNumber: null,
    siret: null,
    detectedOpcoSlug: null,
    detectedIdcc: null,
    detectedCompanyName: null,
    selectedBrancheId: null,
    opcoCertitude: null,
    idccEtablissements: [],
    idccSiege: [],
    regionCode: null,
    departementCode: null,
    codeNaf: null,
    trancheEffectifInsee: null,
    companySize: null,
    effectif: null,
    structures: [],
    budgetDejaConsomme: null,
    contractType: null,
    anciennete_mois: null,
    isHandicap: false,
    isReconversion: false,
    isSortieChomage: false,
    ageBeneficiaire: null,
    niveauDiplome: null,
    typeAlternance: null,
    inscritFranceTravail: null,
    statutDirigeant: null,
    microEntrepreneur: null,
    soldeCpf: null,
    regionBeneficiaireCode: null,
    formationNom: null,
    formationType: null,
    certificationLevel: null,
    niveauFormationVise: null,
    eligibleCpf: null,
    dateDebutFormation: null,
    organismeQualiopi: null,
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
