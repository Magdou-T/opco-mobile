// ============================================================
// VERIFY — comparaison champ par champ : dataset courant vs extraction.
//
// diffOpco() est PURE et déterministe (testée unitairement).
// reviewDiffsWithModel() est un avis consultatif optionnel (mode live,
// gaté derrière ANTHROPIC_API_KEY) rendu par un modèle Opus récent.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import type { OpcoData } from '@opco/core';
import { NUMERIC_FIELDS, PLAFOND_FIELDS } from './types';
import type { ExtractedPlafond, ExtractionResult, FieldDiff, OpcoDiff } from './types';
import { getField } from './util';
import { getVerifyModel, hasApiKey } from './extract';

/**
 * Compare le dataset courant et l'extraction, champ par champ.
 * - unchanged : même valeur (y compris null === null)
 * - modified  : valeur différente confirmée par la source
 * - new       : valeur absente du courant (null) mais trouvée sur la source
 * - not_found : champ non retrouvé sur la source (ou plus de valeur)
 */
export function diffOpco(current: OpcoData, extracted: ExtractionResult): OpcoDiff {
  const diffs: FieldDiff[] = [];

  // --- Champs SourcedValue ---
  for (const field of NUMERIC_FIELDS) {
    const oldValue = getField(current, field).value;
    const found = extracted.fields.find((f) => f.field === field);

    if (!found) {
      diffs.push({ field, status: 'not_found', oldValue, newValue: null });
      continue;
    }

    const newValue = found.value;
    const base = {
      field,
      oldValue,
      newValue,
      extractedConfidence: found.confidence,
      quote: found.quote,
      source_url: found.source_url,
    };

    if (oldValue === newValue) {
      diffs.push({ ...base, status: 'unchanged' });
    } else if (oldValue == null && newValue != null) {
      diffs.push({ ...base, status: 'new' });
    } else if (newValue == null) {
      // La source ne donne plus de montant chiffré -> traité comme non retrouvé.
      diffs.push({ ...base, status: 'not_found' });
    } else {
      diffs.push({ ...base, status: 'modified' });
    }
  }

  // --- Plafonds par taille ---
  // Certaines données ont des tailles DUPLIQUÉES (ex. Constructys publie deux
  // plafonds less_11 : bâtiment et travaux publics). On apparie donc par
  // ordre d'occurrence au sein d'une même taille, et la clé du diff porte
  // l'INDEX dans le tableau courant pour que correct/validate retrouvent
  // exactement la même entrée.
  const queues = new Map<string, ExtractedPlafond[]>();
  for (const p of extracted.plafonds_par_taille) {
    const q = queues.get(p.taille) ?? [];
    q.push(p);
    queues.set(p.taille, q);
  }

  (current.plafonds_par_taille ?? []).forEach((plafond, idx) => {
    const found = queues.get(plafond.taille)?.shift();
    for (const sub of PLAFOND_FIELDS) {
      const field = `plafonds_par_taille[${idx}:${plafond.taille}].${sub}`;
      const oldValue = plafond[sub];

      if (!found) {
        diffs.push({ field, status: 'not_found', oldValue, newValue: null });
        continue;
      }
      const newValue = found[sub];
      const base = { field, oldValue, newValue, quote: found.quote };
      if (oldValue === newValue) {
        diffs.push({ ...base, status: 'unchanged' });
      } else if (oldValue == null && newValue != null) {
        diffs.push({ ...base, status: 'new' });
      } else if (newValue == null) {
        diffs.push({ ...base, status: 'not_found' });
      } else {
        diffs.push({ ...base, status: 'modified' });
      }
    }
  });

  return { slug: current.slug, diffs };
}

/** Résumé compact d'un diff pour le rapport console. */
export function summarizeDiff(diff: OpcoDiff): string {
  const counts: Record<string, number> = {};
  for (const d of diff.diffs) counts[d.status] = (counts[d.status] ?? 0) + 1;
  const parts = Object.entries(counts).map(([k, v]) => `${k}=${v}`);
  return `${diff.slug}: ${parts.join(', ')}`;
}

/**
 * Avis consultatif d'un modèle Opus récent sur les écarts détectés
 * (mode live uniquement — gaté derrière ANTHROPIC_API_KEY).
 * Ne modifie JAMAIS les données : retourne un texte pour le rapport, qui rappelle le motif d'arrêt du modèle
 * (stop_reason) et dit quand l'avis est tronqué ou vide.
 */
export async function reviewDiffsWithModel(diffs: OpcoDiff[]): Promise<string> {
  if (!hasApiKey()) {
    return '[verify] Pas de clé API : revue IA des écarts sautée.';
  }
  const interesting = diffs
    .map((d) => ({ slug: d.slug, diffs: d.diffs.filter((x) => x.status !== 'unchanged') }))
    .filter((d) => d.diffs.length > 0);
  if (interesting.length === 0) return 'Aucun écart à examiner.';

  const client = new Anthropic();
  const response = await client.messages.create({
    model: getVerifyModel(),
    // La réflexion adaptative et le texte de l'avis se partagent max_tokens : 4 000 pouvaient être épuisés avant le
    // premier mot de l'avis. 16 000 reste sous la limite des requêtes sans flux (environ 21 000 pour un délai de 10 min).
    max_tokens: 16_000,
    thinking: { type: 'adaptive' },
    // Une ligne par écart suffit : l'effort par défaut de ce modèle (medium) réfléchit plus que nécessaire.
    output_config: { effort: 'low' },
    system:
      "Tu es un auditeur de données de financement OPCO. On te donne des écarts détectés entre le dataset publié et les montants extraits des sites officiels. Pour chaque écart, indique en une ligne s'il est plausible (évolution tarifaire normale) ou suspect (erreur d'extraction probable, ordre de grandeur incohérent, citation qui ne justifie pas le montant). Réponds en français, format liste compacte. Tu ne proposes JAMAIS de montant de remplacement.",
    messages: [{ role: 'user', content: JSON.stringify(interesting, null, 2) }],
  });

  const avis = response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  const arret = `stop_reason=${response.stop_reason}`;
  if (!avis) return `[verify] Aucun texte dans la réponse du modèle (${arret}).`;
  if (response.stop_reason === 'max_tokens') return `${avis}\n[verify] Avis tronqué : le modèle a atteint max_tokens (${arret}).`;
  return `${avis}\n[verify] ${arret}`;
}
