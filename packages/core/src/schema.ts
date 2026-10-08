// ============================================================
// Schéma de validation (Zod), miroir de types.ts et aides/types.ts.
// Source de vérité partagée : utilisé par le BACKEND avant publication
// d'un dataset ET par l'APP après téléchargement, pour ne jamais
// charger de données corrompues.
// ============================================================

import { z } from 'zod';
import type { Aide } from './aides/types';

export const ConfidenceSchema = z.enum(['exact', 'estimated', 'depends_on_branche']);

/** SourcedValue<number | null> : le cas le plus courant. */
export const SourcedNumberSchema = z.object({
  value: z.number().nullable(),
  confidence: ConfidenceSchema,
  source_url: z.string().url().or(z.literal('')),
  note: z.string().optional(),
});

/**
 * Champ descriptif libre. Les données réelles mélangent string, objet sourcé
 * enrichi ou null. Ces champs ne pilotent PAS le calcul.
 */
export const FreeTextSchema = z.union([z.string(), z.record(z.unknown())]).nullable();

export const CompanySizeSchema = z.enum(['less_11', '11_49', '50_299', '300_plus']);

const DateIsoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date attendue au format AAAA-MM-JJ')
  .refine((s) => {
    // Aller-retour par Date : 2026-13-45 est invalide (toISOString lèverait), 2026-02-30 devient 2026-03-02.
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'date inexistante dans le calendrier');
const HttpsUrlSchema = z.string().url().startsWith('https://');

export const PlafondTailleSchema = z.object({
  taille: CompanySizeSchema,
  cout_horaire_max: z.number().nullable(),
  // Confiance et source propres au plafond horaire de la taille (absentes : « exact » et page de critères de l'OPCO).
  confidence: ConfidenceSchema.optional(),
  source_url: z.string().url().optional(),
  budget_annuel_max: z.number().nullable(),
  quota_horaire_max: z.number().nullable(),
  description: z.string(),
  prise_en_charge_salaires_horaire: z.number().nonnegative().nullable().optional(),
});

/** Une seule entrée par taille : le calcul ne retiendrait que la première. */
export const PlafondsParTailleSchema = z.array(PlafondTailleSchema).superRefine((plafonds, ctx) => {
  const vues = new Set<string>();
  for (const p of plafonds) {
    if (vues.has(p.taille)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `plafonds_par_taille : taille en double (${p.taille})` });
    }
    vues.add(p.taille);
  }
});

export const CoutHoraireSeuilSchema = z.object({
  max_heures: z.number().positive().nullable(),
  valeur: z.number().min(0),
});
const ModeSeuilsSchema = z.enum(['par_tranche', 'selon_duree_totale']);
const PorteeBudgetSchema = z.enum(['global', 'pedagogie']);
const ModeSalairesSchema = z.enum(['euro_par_heure', 'pourcentage_pedagogique', 'selon_accord', 'inclus_plafond_horaire']);
const UniteRestaurationSchema = z.enum(['repas', 'jour']);

export const VarianteBrancheSchema = z.object({
  id: z.string().min(1),
  branche_nom: z.string().min(1),
  idcc: z.array(z.string().regex(/^\d{4}$/)).min(1),
  // Rendue en lien par le site : une adresse https, comme la source d'une alerte.
  source_url: HttpsUrlSchema,
  confidence: ConfidenceSchema,
  note: z.string().optional(),
  // true : le barème de la variante est celui d'un plan conventionnel de branche qui prend le relais d'une enveloppe de plan de
  // développement des compétences épuisée ; le plafond annuel est `budget_annuel_max`. Vrai seulement (`false` refusé).
  relais_plan_conventionnel: z.literal(true).optional(),

  cout_horaire_inter: SourcedNumberSchema.optional(),
  cout_horaire_metier: SourcedNumberSchema.optional(),
  cout_horaire_seuils: z.array(CoutHoraireSeuilSchema).optional(),
  cout_horaire_seuils_mode: ModeSeuilsSchema.optional(),
  cout_horaire_seuils_certifiant: z.boolean().optional(),
  prise_en_charge_salaires: SourcedNumberSchema.optional(),
  prise_en_charge_salaires_mode: ModeSalairesSchema.optional(),
  frais_transport: SourcedNumberSchema.optional(),
  frais_hebergement: SourcedNumberSchema.optional(),
  frais_restauration: SourcedNumberSchema.optional(),
  frais_restauration_unite: UniteRestaurationSchema.optional(),
  frais_annexes_pourcentage: SourcedNumberSchema.optional(),
  budget_annuel_max: SourcedNumberSchema.optional(),
  budget_annuel_portee: PorteeBudgetSchema.optional(),
  budget_annuel_description: z.string().optional(),
  plafonds_par_taille: PlafondsParTailleSchema.optional(),
});

export const DispositifComplementaireSchema = z.object({
  id: z.string().min(1),
  nom: z.string().min(1),
  cumul: z.enum(['hors_budget', 'additif', 'alternatif']),
  montant_max: z.number().nullable(),
  unite: z.enum(['par_stagiaire', 'par_dossier', 'par_an', 'par_jour', 'par_heure']).nullable(),
  pourcentage_couts: z.number().nullable(),
  description: z.string().min(1),
  conditions: z.array(z.string()),
  demarches: z.string().min(1),
  tailles_eligibles: z.array(CompanySizeSchema).nullable(),
  publics: z.string().nullable(),
  idcc: z.array(z.string().regex(/^\d{4}$/)).optional(),
  note: z.string().optional(),
  confidence: ConfidenceSchema,
  // Rendue en lien par le site : une adresse https, comme la source d'une alerte.
  source_url: HttpsUrlSchema,
});

/** Alerte datée et sourcée publiée par un OPCO ; `idcc` vide = toutes les entreprises de l'OPCO. */
export const AlerteOpcoSchema = z.object({
  type: z.enum([
    'fonds_epuises',
    'changement_criteres',
    'dispositif_termine',
    'dispositif_non_confirme',
    'changement_paiement',
    'acces_restreint',
    'evolution_en_cours_annee',
    'echeance',
  ]),
  branche: z.string().min(1),
  idcc: z.array(z.string().regex(/^\d{4}$/)),
  source_url: HttpsUrlSchema,
  extrait: z.string().min(1),
  verifie_le: DateIsoSchema,
});

export const OpcoDataSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  nom_complet: z.string().optional(),
  secteurs: z.string(),
  secteurs_source: z.string(),
  email_contact: z.string(),
  url_finance_page: z.string(),

  types_formations: z.array(z.string()),
  types_formations_source: z.string(),

  cout_horaire_inter: SourcedNumberSchema,
  cout_horaire_intra: SourcedNumberSchema,
  cout_horaire_metier: SourcedNumberSchema,
  cout_horaire_seuils: z.array(CoutHoraireSeuilSchema).optional(),
  cout_horaire_seuils_mode: ModeSeuilsSchema.optional(),
  cout_horaire_seuils_certifiant: z.boolean().optional(),

  prise_en_charge_salaires: SourcedNumberSchema,
  prise_en_charge_salaires_mode: ModeSalairesSchema,

  frais_transport: SourcedNumberSchema,
  frais_hebergement: SourcedNumberSchema,
  frais_restauration: SourcedNumberSchema,
  frais_restauration_unite: UniteRestaurationSchema.optional(),
  frais_annexes_pourcentage: SourcedNumberSchema,

  budget_annuel_max: SourcedNumberSchema,
  budget_annuel_portee: PorteeBudgetSchema.optional(),
  budget_annuel_description: z.string(),
  quota_horaire_min: z.number().nullable(),
  quota_horaire_max: z.number().nullable(),

  profils_candidats: z.array(z.string()),
  tailles_cibles: z.string(),
  priorite_tpe_pme: z.boolean(),
  duree_min_formation: z.string().nullable(),

  processus_approbation: z.string(),
  delai_validation: FreeTextSchema,
  mode_paiement: z.string(),

  alternance_apprentissage: FreeTextSchema,
  alternance_professionnalisation: FreeTextSchema,

  cpf_abondement: z.boolean(),
  cpf_details: FreeTextSchema,

  vae_possible: z.boolean(),
  vae_details: FreeTextSchema,

  limite_dossiers_an: FreeTextSchema,

  specificites: z.string(),
  points_cles_maximisation: z.string(),

  plafonds_par_taille: PlafondsParTailleSchema.optional(),
  dispositifs_complementaires: z.array(DispositifComplementaireSchema).optional(),
  variantes_branche: z.array(VarianteBrancheSchema).optional(),
  derniere_verification: DateIsoSchema.optional(),
  alertes: z.array(AlerteOpcoSchema).optional(),
  note_variantes: z.string().optional(),
});

/**
 * Bornes de cohérence (sanity checks) appliquées en plus du schéma de forme.
 * Renvoie la liste des problèmes détectés (vide = OK).
 */
export function sanityCheckOpco(o: z.infer<typeof OpcoDataSchema>): string[] {
  const issues: string[] = [];
  const inRange = (v: number | null, lo: number, hi: number, label: string) => {
    if (v != null && (v < lo || v > hi)) issues.push(`${o.slug}: ${label}=${v} hors bornes [${lo}, ${hi}]`);
  };
  /** Barème par tranche : valeurs bornées, et dernière tranche (après tri par max_heures) sans limite d'heures. */
  const verifierBareme = (seuils: z.infer<typeof CoutHoraireSeuilSchema>[] | undefined, prefixe: string) => {
    if (!seuils?.length) return;
    for (const s of seuils) inRange(s.valeur, 0, 200, `${prefixe}cout_horaire_seuils.valeur`);
    const triees = [...seuils].sort((a, b) => (a.max_heures ?? Infinity) - (b.max_heures ?? Infinity));
    if (triees[triees.length - 1].max_heures != null) {
      issues.push(`${o.slug}: ${prefixe}cout_horaire_seuils : la dernière tranche doit avoir max_heures null`);
    }
  };

  inRange(o.cout_horaire_inter.value, 0, 200, 'cout_horaire_inter');
  inRange(o.cout_horaire_intra.value, 0, 200, 'cout_horaire_intra');
  inRange(o.cout_horaire_metier.value, 0, 200, 'cout_horaire_metier');
  inRange(o.frais_annexes_pourcentage.value, 0, 100, 'frais_annexes_pourcentage');
  inRange(o.budget_annuel_max.value, 0, 1_000_000, 'budget_annuel_max');
  verifierBareme(o.cout_horaire_seuils, '');

  for (const p of o.plafonds_par_taille ?? []) {
    inRange(p.cout_horaire_max, 0, 200, `plafond[${p.taille}].cout_horaire_max`);
    inRange(p.budget_annuel_max, 0, 1_000_000, `plafond[${p.taille}].budget_annuel_max`);
    inRange(p.prise_en_charge_salaires_horaire ?? null, 0, 200, `plafond[${p.taille}].prise_en_charge_salaires_horaire`);
  }
  for (const d of o.dispositifs_complementaires ?? []) {
    inRange(d.montant_max, 0, 100_000, `dispositif[${d.id}].montant_max`);
    inRange(d.pourcentage_couts, 0, 100, `dispositif[${d.id}].pourcentage_couts`);
  }
  for (const v of o.variantes_branche ?? []) {
    inRange(v.cout_horaire_inter?.value ?? null, 0, 200, `variante[${v.id}].cout_horaire_inter`);
    inRange(v.cout_horaire_metier?.value ?? null, 0, 200, `variante[${v.id}].cout_horaire_metier`);
    inRange(v.frais_annexes_pourcentage?.value ?? null, 0, 100, `variante[${v.id}].frais_annexes_pourcentage`);
    inRange(v.budget_annuel_max?.value ?? null, 0, 1_000_000, `variante[${v.id}].budget_annuel_max`);
    verifierBareme(v.cout_horaire_seuils, `variante[${v.id}].`);
    for (const p of v.plafonds_par_taille ?? []) {
      inRange(p.cout_horaire_max, 0, 200, `variante[${v.id}].plafond[${p.taille}].cout_horaire_max`);
      inRange(p.budget_annuel_max, 0, 1_000_000, `variante[${v.id}].plafond[${p.taille}].budget_annuel_max`);
      inRange(
        p.prise_en_charge_salaires_horaire ?? null,
        0,
        200,
        `variante[${v.id}].plafond[${p.taille}].prise_en_charge_salaires_horaire`,
      );
    }
  }
  return issues;
}

// --- Catalogue d'aides, table IDCC et suggestions NAF --------------------------

export const CodeRegionSchema = z.enum([
  '84', '27', '53', '24', '94', '44', '32', '11', '28', '75', '76', '52', '93', '01', '02', '03', '04', '06',
]);
const ProjetTypeSchema = z.enum([
  'formation_salarie',
  'reconversion_salarie',
  'recrutement_demandeur_emploi',
  'alternance',
  'formation_dirigeant',
]);
const StatutBeneficiaireSchema = z.enum(['salarie', 'demandeur_emploi', 'alternant', 'dirigeant']);
const NiveauDiplomeSchema = z.enum(['sans_diplome', 'cap_bep', 'bac', 'bac_plus_2', 'bac_plus_3_et_plus']);
const NiveauCertificationSchema = z.union([
  z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7), z.literal(8),
]);
const StatutDirigeantSchema = z.enum(['commercant', 'artisan', 'profession_liberale', 'exploitant_agricole', 'assimile_salarie']);
const ContractTypeSchema = z.enum(['cdi', 'cdd', 'interim', 'alternance']);
const CertificationTypeSchema = z.enum(['rncp', 'rs', 'cqp', 'diplome', 'habilitation', 'aucune', 'autre']);
// Types de formation du parcours (WizardState.formationType), distincts de la certification visée.
const TrainingTypeSchema = z.enum(['non_certifiante', 'qualification', 'certification', 'vae', 'reconversion', 'cqp', 'habilitation']);
const FinanceurSchema = z.enum([
  'etat', 'region', 'departement', 'france_travail', 'transitions_pro', 'agefiph',
  'europe', 'cpf', 'opco', 'faf', 'fiscal', 'branche', 'autre',
]);

// Les schémas objet de cette section sont tous stricts (catalogue d'aides, portails régionaux, table IDCC
// et suggestions NAF) : une clé mal orthographiée (ex. `age_maxi`, `idcc_cibel`) serait sinon supprimée en
// silence par Zod, et l'aide perdrait une condition d'éligibilité, la convention son rattachement.
export const CriteresAideSchema = z.object({
  regions: z.array(CodeRegionSchema).optional(),
  perimetre_region: z.enum(['entreprise', 'beneficiaire']).optional(),
  departements: z.array(z.string().regex(/^(\d{2}|2A|2B|97[1-6])$/)).optional(),
  effectif_min: z.number().int().min(0).optional(),
  effectif_max: z.number().int().min(0).optional(),
  age_min: z.number().int().min(0).max(100).optional(),
  age_max: z.number().int().min(0).max(100).optional(),
  // rqth, eligible_cpf et qualiopi_requis : vrais seulement (un `false` serait ignoré sans bruit par l'évaluation).
  rqth: z.literal(true).optional(),
  niveaux_diplome: z.array(NiveauDiplomeSchema).optional(),
  niveau_certification_max: NiveauCertificationSchema.optional(),
  niveau_certification_min: NiveauCertificationSchema.optional(),
  contrats: z.array(ContractTypeSchema).optional(),
  types_alternance: z.array(z.enum(['apprentissage', 'professionnalisation'])).optional(),
  anciennete_min_mois: z.number().int().min(0).optional(),
  inscrit_france_travail: z.boolean().optional(),
  statuts_dirigeant: z.array(StatutDirigeantSchema).optional(),
  micro_entrepreneur: z.boolean().optional(),
  certifications: z.array(CertificationTypeSchema).optional(),
  types_formation: z.array(TrainingTypeSchema).min(1).optional(),
  eligible_cpf: z.literal(true).optional(),
  duree_min_heures: z.number().min(0).optional(),
  duree_max_heures: z.number().min(0).optional(),
  opcos: z.array(z.string().min(1)).optional(),
  idcc: z.array(z.string().regex(/^\d{4}$/)).optional(),
  naf_prefixes: z.array(z.string().min(2)).optional(),
  structures: z.array(z.enum(['ess', 'siae', 'association'])).optional(),
  qualiopi_requis: z.literal(true).optional(),
}).strict();

const MajorationAideSchema = z.object({
  criteres: CriteresAideSchema,
  valeur: z.number().min(0).nullable().optional(),
  pourcentage: z.number().min(0).max(100).nullable().optional(),
  plafond: z.number().min(0).nullable().optional(),
  libelle: z.string().min(1),
}).strict();

export const MontantAideSchema = z
  .object({
    mode: z.enum(['forfait', 'pourcentage', 'par_heure', 'par_mois', 'solde_cpf', 'non_chiffre']),
    valeur: z.number().min(0).nullable(),
    pourcentage: z.number().min(0).max(100).nullable(),
    base: z.enum(['cout_pedagogique', 'cout_total']).nullable(),
    plafond: z.number().min(0).nullable(),
    duree_max_mois: z.number().int().positive().nullable(),
    libelle: z.string().min(1),
    majorations: z.array(MajorationAideSchema).optional(),
  })
  .strict()
  .superRefine((m, ctx) => {
    if ((m.mode === 'forfait' || m.mode === 'par_heure' || m.mode === 'par_mois') && m.valeur == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `montant.valeur requis pour le mode ${m.mode}` });
    }
    if (m.mode === 'pourcentage' && (m.pourcentage == null || m.base == null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'montant.pourcentage et montant.base requis pour le mode pourcentage' });
    }
    if (m.mode === 'par_mois' && m.duree_max_mois == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'montant.duree_max_mois requis pour le mode par_mois' });
    }
  });

export const SourceAideSchema = z.object({
  url: HttpsUrlSchema,
  titre: z.string().min(1),
  // Mot pour mot, 300 caractères au plus (spécification, protocole de recherche).
  extrait: z.string().min(1).max(300),
}).strict();

export const AideSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'identifiant kebab-case attendu'),
  nom: z.string().min(1),
  financeur: FinanceurSchema,
  financeur_nom: z.string().min(1),
  categorie: z.enum(['cout_formation', 'aide_employeur', 'remuneration_beneficiaire', 'avantage_fiscal_social', 'service_gratuit']),
  projets: z.array(ProjetTypeSchema).min(1),
  beneficiaires: z.array(StatutBeneficiaireSchema).min(1),
  description: z.string().min(1),
  criteres: CriteresAideSchema,
  conditions: z.array(z.string().min(1)),
  montant: MontantAideSchema,
  cumul: z
    .object({
      cumulable: z.boolean(),
      alternatives: z.array(z.string()).optional(),
      note: z.string().optional(),
    })
    .strict(),
  demarches: z.array(z.string().min(1)).min(1),
  url_demarche: HttpsUrlSchema.nullable(),
  liens_par_region: z.record(CodeRegionSchema, HttpsUrlSchema).optional(),
  sources: z.array(SourceAideSchema).min(1),
  derniere_verification: DateIsoSchema,
  validite: z.object({ debut: DateIsoSchema.nullable(), fin: DateIsoSchema.nullable() }).strict(),
  statut: z.enum(['actif', 'a_confirmer', 'suspendu']),
  confidence: ConfidenceSchema,
  ordre_empilement: z.number().optional(),
}).strict();

export const PortailRegionalSchema = z.object({
  region: CodeRegionSchema,
  nom_region: z.string().min(1),
  liens: z
    .array(
      z
        .object({
          titre: z.string().min(1),
          url: HttpsUrlSchema,
          type: z.enum(['region', 'carif_oref', 'transitions_pro', 'france_travail', 'agefiph', 'autre']),
        })
        .strict(),
    )
    .min(1),
  derniere_verification: DateIsoSchema,
}).strict();

export const IdccEntreeSchema = z.object({
  idcc: z.string().regex(/^\d{4}$/),
  titre: z.string().min(1),
  opco: z.string().min(1).nullable(),
  // fusionne : convention fusionnée dans une autre (`idcc_cible`) ou convention close (code fermé dans la table IDCC DSN) ;
  // une convention close n'a souvent pas de cible publiée (7509, 0438, 1237, 0779, 5545... : une cinquantaine d'entrées) et
  // garde alors son propre rattachement, expliqué par la note.
  statut: z.enum(['actif', 'fusionne', 'echappatoire', 'partage']),
  // Statut 'fusionne' : IDCC de rattachement, quand la convention a été fusionnée dans une autre (absent pour une convention close).
  idcc_cible: z.string().regex(/^\d{4}$/).optional(),
  opcos_possibles: z.array(z.string().min(1)).optional(),
  // true : l'OPCO de cette convention n'est établi par aucune source officielle propre à cet IDCC (repris d'une
  // ancienne table, ou déduit des conventions qu'elle remplace) ; la note en donne la raison.
  a_confirmer: z.boolean().optional(),
  note: z.string().optional(),
  source: z.string().min(1),
}).strict();

export const IdccTableSchema = z.record(z.string().regex(/^\d{4}$/), IdccEntreeSchema);

export const SuggestionNafSchema = z.object({
  prefixe: z.string().min(2),
  opco: z.string().min(1),
  part: z.number().min(0).max(1).nullable(),
  effectif_etablissements: z.number().int().min(0).nullable().optional(),
  libelle: z.string(),
  source: z.string().min(1),
}).strict();

/** Cohérence globale du catalogue (en plus du schéma). Renvoie la liste des problèmes. */
export function sanityCheckAides(aides: Aide[]): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const a of aides) {
    if (ids.has(a.id)) issues.push(`aide ${a.id} : identifiant en double`);
    ids.add(a.id);
  }
  for (const a of aides) {
    for (const alt of a.cumul.alternatives ?? []) {
      if (!ids.has(alt)) issues.push(`aide ${a.id} : alternative inconnue ${alt}`);
    }
    const { valeur, plafond } = a.montant;
    if (valeur != null && valeur > 100_000) issues.push(`aide ${a.id} : montant.valeur=${valeur} hors bornes`);
    if (plafond != null && plafond > 100_000) issues.push(`aide ${a.id} : montant.plafond=${plafond} hors bornes`);
    const c = a.criteres;
    if (c.age_min != null && c.age_max != null && c.age_min > c.age_max) issues.push(`aide ${a.id} : age_min > age_max`);
    if (c.effectif_min != null && c.effectif_max != null && c.effectif_min > c.effectif_max) {
      issues.push(`aide ${a.id} : effectif_min > effectif_max`);
    }
    if (a.validite.debut && a.validite.fin && a.validite.debut > a.validite.fin) {
      issues.push(`aide ${a.id} : validité incohérente`);
    }
  }
  return issues;
}

// --- Dataset et manifest --------------------------------------------------------

/** Manifest publié à côté du dataset, lu par l'app pour décider de la sync. */
export const DatasetManifestSchema = z.object({
  version: z.number().int().positive(),
  generatedAt: z.string(),
  sha256: z.string(),
  opcoCount: z.number().int(),
  aidesCount: z.number().int().optional(),
  changelog: z.array(z.string()),
});

/** Dataset complet téléchargé par l'app. Les sections v4 sont facultatives (compatibilité). */
export const DatasetSchema = z.object({
  version: z.number().int().positive(),
  generatedAt: z.string(),
  opcos: z.array(OpcoDataSchema),
  aides: z.array(AideSchema).optional(),
  idcc: IdccTableSchema.optional(),
  naf: z.array(SuggestionNafSchema).optional(),
  portails: z.array(PortailRegionalSchema).optional(),
});

export type DatasetManifest = z.infer<typeof DatasetManifestSchema>;
export type Dataset = z.infer<typeof DatasetSchema>;

/**
 * Valide un dataset complet (forme + bornes + présence des 11 OPCO + cohérence des aides).
 * Lève une erreur agrégée si invalide. Utilisé backend ET app.
 */
export function validateDataset(raw: unknown, opts: { minOpcoCount?: number } = {}): Dataset {
  const parsed = DatasetSchema.parse(raw);
  const minCount = opts.minOpcoCount ?? 11;
  if (parsed.opcos.length < minCount) {
    throw new Error(`Dataset incomplet : ${parsed.opcos.length} OPCO, minimum attendu ${minCount}`);
  }
  const issues = [
    ...parsed.opcos.flatMap((o) => sanityCheckOpco(o)),
    ...(parsed.aides ? sanityCheckAides(parsed.aides) : []),
  ];
  if (issues.length > 0) {
    throw new Error(`Dataset rejeté :\n- ${issues.join('\n- ')}`);
  }
  return parsed;
}
