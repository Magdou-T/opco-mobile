// ============================================================
// Schéma de validation (Zod) — miroir de types.ts.
// Source de vérité partagée : utilisé par le BACKEND avant publication
// d'un dataset ET par l'APP après téléchargement, pour ne jamais
// charger de données corrompues.
// ============================================================

import { z } from 'zod';

export const ConfidenceSchema = z.enum(['exact', 'estimated', 'depends_on_branche']);

/** SourcedValue<number | null> — le cas le plus courant. */
export const SourcedNumberSchema = z.object({
  value: z.number().nullable(),
  confidence: ConfidenceSchema,
  source_url: z.string().url().or(z.literal('')),
  note: z.string().optional(),
});

/**
 * Champ descriptif libre. Les données réelles mélangent string, objet sourcé
 * enrichi (ex. opco-ep, uniformation) ou null. Ces champs ne pilotent PAS le
 * calcul → on tolère les trois formes plutôt que d'imposer un contrat factice.
 */
export const FreeTextSchema = z
  .union([z.string(), z.record(z.unknown())])
  .nullable();

export const CompanySizeSchema = z.enum(['less_11', '11_49', '50_299', '300_plus']);

export const PlafondTailleSchema = z.object({
  taille: CompanySizeSchema,
  cout_horaire_max: z.number().nullable(),
  budget_annuel_max: z.number().nullable(),
  quota_horaire_max: z.number().nullable(),
  description: z.string(),
});

export const VarianteBrancheSchema = z.object({
  id: z.string().min(1),
  branche_nom: z.string().min(1),
  idcc: z.array(z.string().regex(/^\d{4}$/)).min(1),
  source_url: z.string().min(1),
  confidence: ConfidenceSchema,
  note: z.string().optional(),

  cout_horaire_inter: SourcedNumberSchema.optional(),
  cout_horaire_metier: SourcedNumberSchema.optional(),
  prise_en_charge_salaires: SourcedNumberSchema.optional(),
  prise_en_charge_salaires_mode: z
    .enum(['euro_par_heure', 'pourcentage_pedagogique', 'selon_accord', 'inclus_plafond_horaire'])
    .optional(),
  frais_transport: SourcedNumberSchema.optional(),
  frais_hebergement: SourcedNumberSchema.optional(),
  frais_restauration: SourcedNumberSchema.optional(),
  budget_annuel_max: SourcedNumberSchema.optional(),
  budget_annuel_description: z.string().optional(),
  plafonds_par_taille: z.array(PlafondTailleSchema).optional(),
});

export const DispositifComplementaireSchema = z.object({
  id: z.string().min(1),
  nom: z.string().min(1),
  cumul: z.enum(['hors_budget', 'additif', 'alternatif']),
  montant_max: z.number().nullable(),
  unite: z
    .enum(['par_stagiaire', 'par_dossier', 'par_an', 'par_jour', 'par_heure'])
    .nullable(),
  pourcentage_couts: z.number().nullable(),
  description: z.string().min(1),
  conditions: z.array(z.string()),
  demarches: z.string().min(1),
  tailles_eligibles: z.array(CompanySizeSchema).nullable(),
  publics: z.string().nullable(),
  confidence: ConfidenceSchema,
  source_url: z.string(),
});

export const OpcoDataSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  secteurs: z.string(),
  secteurs_source: z.string(),
  email_contact: z.string(),
  url_finance_page: z.string(),

  types_formations: z.array(z.string()),
  types_formations_source: z.string(),

  cout_horaire_inter: SourcedNumberSchema,
  cout_horaire_intra: SourcedNumberSchema,
  cout_horaire_metier: SourcedNumberSchema,

  prise_en_charge_salaires: SourcedNumberSchema,
  prise_en_charge_salaires_mode: z.enum([
    'euro_par_heure',
    'pourcentage_pedagogique',
    'selon_accord',
    'inclus_plafond_horaire',
  ]),

  frais_transport: SourcedNumberSchema,
  frais_hebergement: SourcedNumberSchema,
  frais_restauration: SourcedNumberSchema,
  frais_annexes_pourcentage: SourcedNumberSchema,

  budget_annuel_max: SourcedNumberSchema,
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

  plafonds_par_taille: z.array(PlafondTailleSchema).optional(),

  dispositifs_complementaires: z.array(DispositifComplementaireSchema).optional(),

  variantes_branche: z.array(VarianteBrancheSchema).optional(),
});

/**
 * Bornes de cohérence (sanity checks) appliquées en plus du schéma de forme.
 * Renvoie la liste des problèmes détectés (vide = OK).
 */
export function sanityCheckOpco(o: z.infer<typeof OpcoDataSchema>): string[] {
  const issues: string[] = [];
  const inRange = (v: number | null, lo: number, hi: number, label: string) => {
    if (v != null && (v < lo || v > hi)) {
      issues.push(`${o.slug}: ${label}=${v} hors bornes [${lo}, ${hi}]`);
    }
  };

  inRange(o.cout_horaire_inter.value, 0, 200, 'cout_horaire_inter');
  inRange(o.cout_horaire_intra.value, 0, 200, 'cout_horaire_intra');
  inRange(o.cout_horaire_metier.value, 0, 200, 'cout_horaire_metier');
  inRange(o.frais_annexes_pourcentage.value, 0, 100, 'frais_annexes_pourcentage');
  inRange(o.budget_annuel_max.value, 0, 1_000_000, 'budget_annuel_max');

  for (const p of o.plafonds_par_taille ?? []) {
    inRange(p.cout_horaire_max, 0, 200, `plafond[${p.taille}].cout_horaire_max`);
    inRange(p.budget_annuel_max, 0, 1_000_000, `plafond[${p.taille}].budget_annuel_max`);
  }

  for (const d of o.dispositifs_complementaires ?? []) {
    inRange(d.montant_max, 0, 100_000, `dispositif[${d.id}].montant_max`);
    inRange(d.pourcentage_couts, 0, 100, `dispositif[${d.id}].pourcentage_couts`);
  }

  for (const v of o.variantes_branche ?? []) {
    inRange(v.cout_horaire_inter?.value ?? null, 0, 200, `variante[${v.id}].cout_horaire_inter`);
    inRange(v.cout_horaire_metier?.value ?? null, 0, 200, `variante[${v.id}].cout_horaire_metier`);
    inRange(v.budget_annuel_max?.value ?? null, 0, 1_000_000, `variante[${v.id}].budget_annuel_max`);
    for (const p of v.plafonds_par_taille ?? []) {
      inRange(p.cout_horaire_max, 0, 200, `variante[${v.id}].plafond[${p.taille}].cout_horaire_max`);
      inRange(p.budget_annuel_max, 0, 1_000_000, `variante[${v.id}].plafond[${p.taille}].budget_annuel_max`);
    }
  }
  return issues;
}

/** Manifest publié à côté du dataset, lu par l'app pour décider de la sync. */
export const DatasetManifestSchema = z.object({
  version: z.number().int().positive(),
  generatedAt: z.string(),
  sha256: z.string(),
  opcoCount: z.number().int(),
  changelog: z.array(z.string()),
});

/** Dataset complet téléchargé par l'app. */
export const DatasetSchema = z.object({
  version: z.number().int().positive(),
  generatedAt: z.string(),
  opcos: z.array(OpcoDataSchema),
});

export type DatasetManifest = z.infer<typeof DatasetManifestSchema>;
export type Dataset = z.infer<typeof DatasetSchema>;

/**
 * Valide un dataset complet (forme + bornes + présence des 11 OPCO).
 * Lève une erreur agrégée si invalide. Utilisé backend ET app.
 */
export function validateDataset(
  raw: unknown,
  opts: { minOpcoCount?: number } = {},
): Dataset {
  const parsed = DatasetSchema.parse(raw);
  const minCount = opts.minOpcoCount ?? 11;
  if (parsed.opcos.length < minCount) {
    throw new Error(
      `Dataset incomplet : ${parsed.opcos.length} OPCO, minimum attendu ${minCount}`,
    );
  }
  const issues = parsed.opcos.flatMap((o) => sanityCheckOpco(o));
  if (issues.length > 0) {
    throw new Error(`Dataset rejeté (bornes) :\n- ${issues.join('\n- ')}`);
  }
  return parsed;
}
