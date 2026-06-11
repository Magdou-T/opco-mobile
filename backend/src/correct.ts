// ============================================================
// CORRECT — application des corrections selon les règles de la SPEC :
//
// 1. Valeur confirmée par la source -> met à jour `value`,
//    `confidence='exact'`, rafraîchit `source_url` + `note` (avec date).
// 2. Valeur NON retrouvée sur la source -> NE PAS supprimer ;
//    RÉTROGRADE la confidence (exact -> estimated -> depends_on_branche)
//    + note « non confirmé au JJ/MM ».
// 3. Jamais d'écrasement silencieux : CHAQUE changement est journalisé
//    dans un changelog lisible.
// ============================================================

import type { OpcoData, SourcedValue } from '@opco/core';
import { NUMERIC_FIELDS, PLAFOND_FIELDS } from './types';
import type { ChangelogEntry, CorrectionResult, FieldDiff, NumericField, OpcoDiff, PlafondField } from './types';
import { deepClone, downgradeConfidence, frDate, getField } from './util';

export interface CorrectOptions {
  /** Date du run (injectable pour les tests). */
  now?: Date;
}

/** Clé produite par verify : plafonds_par_taille[<index>:<taille>].<sous-champ> */
function isPlafondDiff(field: string): { index: number; taille: string; sub: PlafondField } | null {
  const m = /^plafonds_par_taille\[(\d+):([^\]]+)\]\.(.+)$/.exec(field);
  if (!m) return null;
  return { index: Number(m[1]), taille: m[2], sub: m[3] as PlafondField };
}

function applyToSourcedValue(
  sv: SourcedValue<number | null>,
  diff: FieldDiff,
  date: string,
  log: (entry: Omit<ChangelogEntry, 'slug'>) => void,
): void {
  switch (diff.status) {
    case 'unchanged': {
      // Confirmation explicite (montant présent noir sur blanc sur la source)
      // -> on peut consolider la confiance et dater la vérification.
      if (diff.newValue != null && diff.extractedConfidence === 'exact' && sv.confidence !== 'exact') {
        const old = sv.confidence;
        sv.confidence = 'exact';
        if (diff.source_url) sv.source_url = diff.source_url;
        sv.note = `Confirmé le ${date} — « ${diff.quote ?? ''} »`;
        log({
          field: diff.field,
          action: 'confirmed',
          oldValue: diff.oldValue,
          newValue: diff.newValue,
          detail: `Valeur ${diff.newValue} confirmée par la source ; confiance ${old} -> exact.`,
        });
      }
      break;
    }
    case 'modified':
    case 'new': {
      // Valeur confirmée par la source -> mise à jour + confidence exact
      // + source_url et note rafraîchies (avec date). Jamais silencieux.
      const old = sv.value;
      sv.value = diff.newValue;
      sv.confidence = 'exact';
      if (diff.source_url) sv.source_url = diff.source_url;
      sv.note = `Mis à jour le ${date} (ancienne valeur : ${old ?? 'aucune'}) — « ${diff.quote ?? ''} »`;
      log({
        field: diff.field,
        action: diff.status === 'new' ? 'added' : 'updated',
        oldValue: old,
        newValue: diff.newValue,
        detail:
          diff.status === 'new'
            ? `Nouveau montant ${diff.newValue} trouvé sur la source.`
            : `Montant ${old} -> ${diff.newValue} (confirmé par la source).`,
      });
      break;
    }
    case 'not_found': {
      // Valeur NON retrouvée -> on NE SUPPRIME PAS, on rétrograde la confiance.
      const oldConfidence = sv.confidence;
      const next = downgradeConfidence(oldConfidence);
      sv.note = `Non confirmé au ${date} — valeur conservée (${sv.value ?? 'aucune'}).`;
      if (next !== oldConfidence) {
        sv.confidence = next;
        log({
          field: diff.field,
          action: 'confidence_downgraded',
          oldValue: diff.oldValue,
          newValue: diff.oldValue,
          detail: `Montant non retrouvé sur la source ; confiance ${oldConfidence} -> ${next}. Valeur conservée.`,
        });
      } else {
        log({
          field: diff.field,
          action: 'not_confirmed',
          oldValue: diff.oldValue,
          newValue: diff.oldValue,
          detail: `Montant non retrouvé sur la source ; confiance déjà au plancher (${oldConfidence}). Valeur conservée.`,
        });
      }
      break;
    }
  }
}

/**
 * Applique les corrections issues du diff sur une copie de l'OPCO courant.
 * Ne supprime jamais une valeur ; journalise chaque changement.
 */
export function applyCorrections(current: OpcoData, diff: OpcoDiff, opts: CorrectOptions = {}): CorrectionResult {
  const date = frDate(opts.now ?? new Date());
  const opco = deepClone(current);
  const changelog: ChangelogEntry[] = [];
  const log = (entry: Omit<ChangelogEntry, 'slug'>) => changelog.push({ slug: current.slug, ...entry });

  for (const d of diff.diffs) {
    const plafond = isPlafondDiff(d.field);

    if (!plafond) {
      // Champ SourcedValue de premier niveau.
      if ((NUMERIC_FIELDS as readonly string[]).includes(d.field)) {
        applyToSourcedValue(getField(opco, d.field as NumericField), d, date, log);
      }
      continue;
    }

    // Sous-champ d'un plafond par taille (nombre nu, pas de confidence) :
    // - modified/new : on applique la valeur confirmée.
    // - not_found : on CONSERVE la valeur (pas de confidence à rétrograder),
    //   on journalise seulement.
    const entry = (opco.plafonds_par_taille ?? [])[plafond.index];
    if (!entry || entry.taille !== plafond.taille) continue;

    if (d.status === 'modified' || d.status === 'new') {
      const old = entry[plafond.sub];
      entry[plafond.sub] = d.newValue;
      log({
        field: d.field,
        action: d.status === 'new' ? 'added' : 'updated',
        oldValue: old,
        newValue: d.newValue,
        detail: `Plafond ${plafond.sub} (${plafond.taille}) : ${old ?? 'aucun'} -> ${d.newValue} (confirmé par la source).`,
      });
    } else if (d.status === 'not_found' && d.oldValue != null) {
      log({
        field: d.field,
        action: 'not_confirmed',
        oldValue: d.oldValue,
        newValue: d.oldValue,
        detail: `Plafond non retrouvé sur la source au ${date} ; valeur conservée.`,
      });
    }
  }

  return { opco, changelog };
}

/** Changelog -> lignes lisibles pour le manifest et le rapport. */
export function formatChangelog(entries: ChangelogEntry[]): string[] {
  return entries.map((e) => `[${e.slug}] ${e.field} (${e.action}) : ${e.detail}`);
}
