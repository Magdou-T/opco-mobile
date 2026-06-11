// ============================================================
// Types internes du pipeline backend.
// Les types de données métier (OpcoData, SourcedValue…) viennent de @opco/core.
// ============================================================

import type { OpcoData, Confidence, CompanySize } from '@opco/core';

/** Champs chiffrés (SourcedValue<number|null>) suivis par le pipeline. */
export const NUMERIC_FIELDS = [
  'cout_horaire_inter',
  'cout_horaire_intra',
  'cout_horaire_metier',
  'prise_en_charge_salaires',
  'frais_transport',
  'frais_hebergement',
  'frais_restauration',
  'frais_annexes_pourcentage',
  'budget_annuel_max',
] as const;

export type NumericField = (typeof NUMERIC_FIELDS)[number];

/** Sous-champs numériques d'un PlafondTaille suivis par le pipeline. */
export const PLAFOND_FIELDS = ['cout_horaire_max', 'budget_annuel_max', 'quota_horaire_max'] as const;
export type PlafondField = (typeof PLAFOND_FIELDS)[number];

// --- Sources (backend/sources/opco-sources.json) ---

export interface OpcoSource {
  slug: string;
  name: string;
  url_finance_page: string;
  field_urls: Partial<Record<NumericField, string>>;
  scrape_urls: string[];
}

export type OpcoSources = Record<string, OpcoSource>;

// --- SCRAPE ---

export interface ScrapedPage {
  url: string;
  text: string;
}

export interface ScrapeResult {
  slug: string;
  pages: ScrapedPage[];
  /** true si le contenu vient du cache local / d'une simulation (dry-run). */
  simulated: boolean;
}

// --- EXTRACT ---

export interface ExtractedField {
  field: NumericField;
  value: number | null;
  confidence: Confidence;
  /** Phrase EXACTE du texte source qui justifie le montant (jamais inventée). */
  quote: string;
  source_url: string;
}

export interface ExtractedPlafond {
  taille: CompanySize;
  cout_horaire_max: number | null;
  budget_annuel_max: number | null;
  quota_horaire_max: number | null;
  quote: string;
}

export interface ExtractionResult {
  slug: string;
  /** Uniquement les champs réellement trouvés dans le texte. */
  fields: ExtractedField[];
  plafonds_par_taille: ExtractedPlafond[];
}

// --- VERIFY ---

export type DiffStatus = 'unchanged' | 'modified' | 'new' | 'not_found';

export interface FieldDiff {
  /** ex: "cout_horaire_inter" ou "plafonds_par_taille[less_11].cout_horaire_max" */
  field: string;
  status: DiffStatus;
  oldValue: number | null;
  newValue: number | null;
  /** Confiance déclarée par l'extraction (si trouvée). */
  extractedConfidence?: Confidence;
  quote?: string;
  source_url?: string;
}

export interface OpcoDiff {
  slug: string;
  diffs: FieldDiff[];
}

// --- CORRECT ---

export interface ChangelogEntry {
  slug: string;
  field: string;
  action: 'updated' | 'added' | 'confirmed' | 'confidence_downgraded' | 'not_confirmed';
  oldValue: number | null;
  newValue: number | null;
  detail: string;
}

export interface CorrectionResult {
  opco: OpcoData;
  changelog: ChangelogEntry[];
}

// --- VALIDATE ---

export interface NeedsReviewEntry {
  slug: string;
  field: string;
  oldValue: number | null;
  newValue: number | null;
  reason: string;
}

export interface ValidationReport {
  ok: boolean;
  issues: string[];
  needsReview: NeedsReviewEntry[];
  /** OPCO sûrs à publier (changements hors-seuil REVENUS à l'ancienne valeur). */
  opcos: OpcoData[];
}

// --- PUBLISH ---

export interface PublishResult {
  version: number;
  generatedAt: string;
  sha256: string;
  opcoCount: number;
  files: { versioned: string; latest: string; manifest: string };
}

// --- Rapport global du run ---

export interface RunReport {
  mode: 'dry-run' | 'live';
  startedAt: string;
  diffs: OpcoDiff[];
  changelog: ChangelogEntry[];
  needsReview: NeedsReviewEntry[];
  issues: string[];
  published: PublishResult | null;
}
