// ============================================================
// EXTRACT — extraction IA des montants depuis le texte des pages.
//
// - GATÉ derrière ANTHROPIC_API_KEY : sans clé, extractAmounts() lève.
// - Sortie STRICTEMENT structurée (structured outputs + schéma Zod),
//   limitée aux champs chiffrés du OpcoDataSchema.
// - Règle d'or appliquée par le prompt : ne renvoyer QUE des montants
//   présents dans le texte, citer la phrase source, marquer
//   depends_on_branche si le site renvoie à un accord de branche,
//   NE JAMAIS inventer de montant.
//
// Modèles (configurables par env, IDs actuels issus de la skill claude-api) :
//   EXTRACT_MODEL (défaut claude-haiku-4-5)  — extraction structurée
//   VERIFY_MODEL  (défaut claude-opus-4-8)   — raisonnement sur les écarts
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// Le helper zodOutputFormat du SDK exige l'API zod v4 (sous-chemin 'zod/v4').
import { z } from 'zod/v4';
import { NUMERIC_FIELDS, type ExtractionResult, type ScrapeResult } from './types';

export const DEFAULT_EXTRACT_MODEL = 'claude-haiku-4-5';
export const DEFAULT_VERIFY_MODEL = 'claude-opus-4-8';

export function getExtractModel(): string {
  return process.env.EXTRACT_MODEL || DEFAULT_EXTRACT_MODEL;
}
export function getVerifyModel(): string {
  return process.env.VERIFY_MODEL || DEFAULT_VERIFY_MODEL;
}

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// --- Schéma de sortie structurée (miroir partiel d'OpcoDataSchema) ----------

const ConfidenceSchema = z.enum(['exact', 'estimated', 'depends_on_branche']);

const ExtractedFieldSchema = z.object({
  field: z.enum(NUMERIC_FIELDS),
  value: z
    .number()
    .nullable()
    .describe('Montant en euros (ou %) tel quel dans le texte. null si le texte dit explicitement que cela dépend de la branche.'),
  confidence: ConfidenceSchema.describe(
    "'exact' si le montant est écrit noir sur blanc, 'estimated' si déduit d'une fourchette, 'depends_on_branche' si le texte renvoie à un accord de branche.",
  ),
  quote: z.string().describe('Phrase EXACTE du texte qui justifie ce montant. Obligatoire, jamais paraphrasée.'),
  source_url: z.string().describe("URL de la page d'où provient la phrase."),
});

const ExtractedPlafondSchema = z.object({
  taille: z.enum(['less_11', '11_49', '50_299', '300_plus']),
  cout_horaire_max: z.number().nullable(),
  budget_annuel_max: z.number().nullable(),
  quota_horaire_max: z.number().nullable(),
  quote: z.string().describe('Phrase EXACTE du texte qui justifie ces plafonds.'),
});

export const ExtractionSchema = z.object({
  slug: z.string(),
  fields: z
    .array(ExtractedFieldSchema)
    .describe('UNIQUEMENT les champs dont un montant (ou un renvoi explicite à la branche) figure dans le texte. Omettre tout le reste.'),
  plafonds_par_taille: z
    .array(ExtractedPlafondSchema)
    .describe("Plafonds par taille d'entreprise si le texte en mentionne. Sinon tableau vide."),
});

// --- Prompt -----------------------------------------------------------------

const SYSTEM_PROMPT = `Tu es un extracteur de données de financement de la formation professionnelle (OPCO français).
On te donne le texte brut de pages officielles d'un OPCO. Tu dois en extraire les montants de prise en charge.

RÈGLES ABSOLUES — toute violation rend la sortie inutilisable :
1. Ne renvoie QUE des montants réellement présents dans le texte fourni. N'utilise JAMAIS tes connaissances générales sur les OPCO.
2. Pour CHAQUE montant, cite dans "quote" la phrase EXACTE du texte qui le contient (copie littérale, pas de paraphrase).
3. Si le texte renvoie à un accord de branche ("selon votre branche", "voir accord de branche", "critères de votre branche"…), renvoie le champ avec value=null et confidence="depends_on_branche", en citant la phrase.
4. Si un champ n'est PAS mentionné dans le texte, OMETS-le complètement du tableau "fields". Ne mets jamais 0 ou une estimation à la place.
5. N'INVENTE JAMAIS de montant. Mieux vaut un tableau "fields" vide qu'un montant deviné.
6. Les montants horaires sont en euros HT par heure ; budget_annuel_max en euros par an ; frais_annexes_pourcentage en pourcentage (0-100).

Signification des champs :
- cout_horaire_inter / cout_horaire_intra : plafond €/h des formations inter/intra-entreprises (plan de développement des compétences).
- cout_horaire_metier : plafond €/h des formations métier/certifiantes.
- prise_en_charge_salaires : prise en charge des salaires des stagiaires (€/h).
- frais_transport / frais_hebergement / frais_restauration : forfaits frais annexes (€, € par nuit, € par repas).
- frais_annexes_pourcentage : frais annexes exprimés en % du coût pédagogique.
- budget_annuel_max : plafond annuel de financement par entreprise (€).
- plafonds_par_taille : plafonds spécifiques selon la taille d'entreprise (moins de 11, 11-49, 50-299, 300+).`;

// --- API principale ---------------------------------------------------------

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!hasApiKey()) {
    throw new Error(
      "ANTHROPIC_API_KEY absente : l'extraction IA est désactivée. Utilisez --dry-run (extraction simulée) ou fournissez la clé.",
    );
  }
  if (!client) client = new Anthropic();
  return client;
}

/**
 * Transforme le texte scrappé d'un OPCO en montants structurés.
 * Lève si ANTHROPIC_API_KEY est absente (mode live uniquement).
 */
export async function extractAmounts(slug: string, scraped: ScrapeResult): Promise<ExtractionResult> {
  const anthropic = getClient();

  const corpus = scraped.pages
    .map((p) => `=== PAGE: ${p.url} ===\n${p.text.slice(0, 60_000)}`)
    .join('\n\n');

  const response = await anthropic.messages.parse({
    model: getExtractModel(),
    max_tokens: 8_000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `OPCO: ${slug}\n\nTexte des pages officielles :\n\n${corpus}\n\nExtrais les montants en respectant strictement les règles. slug="${slug}".`,
      },
    ],
    output_config: { format: zodOutputFormat(ExtractionSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error(`[extract] ${slug}: sortie structurée invalide (stop_reason=${response.stop_reason})`);
  }
  return { ...parsed, slug };
}

/**
 * Extraction simulée pour le dry-run : identité depuis le dataset courant
 * (aucun appel réseau ni IA). Les valeurs renvoyées sont exactement celles
 * du dataset — donc aucun montant inventé.
 */
export function simulateExtractionFromCurrent(opco: {
  slug: string;
  [k: string]: unknown;
}): ExtractionResult {
  const fields = NUMERIC_FIELDS.flatMap((field) => {
    const sv = opco[field] as { value: number | null; confidence: string; source_url: string } | undefined;
    if (!sv || typeof sv !== 'object') return [];
    return [
      {
        field,
        value: sv.value,
        confidence: sv.confidence as 'exact' | 'estimated' | 'depends_on_branche',
        quote: '[dry-run] valeur reprise du dataset courant (extraction simulée)',
        source_url: sv.source_url,
      },
    ];
  });

  const plafonds = Array.isArray(opco.plafonds_par_taille)
    ? (opco.plafonds_par_taille as Array<Record<string, unknown>>).map((p) => ({
        taille: p.taille as 'less_11' | '11_49' | '50_299' | '300_plus',
        cout_horaire_max: (p.cout_horaire_max as number | null) ?? null,
        budget_annuel_max: (p.budget_annuel_max as number | null) ?? null,
        quota_horaire_max: (p.quota_horaire_max as number | null) ?? null,
        quote: '[dry-run] plafonds repris du dataset courant (extraction simulée)',
      }))
    : [];

  return { slug: opco.slug, fields, plafonds_par_taille: plafonds };
}
