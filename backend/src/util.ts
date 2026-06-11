// ============================================================
// Utilitaires partagés du pipeline.
// ============================================================

import crypto from 'node:crypto';
import type { OpcoData, SourcedValue, Confidence } from '@opco/core';
import type { NumericField } from './types';

/** SHA-256 hexadécimal du contenu d'octets exact. */
export function sha256Hex(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/** Date française JJ/MM/AAAA (utilisée dans les notes du changelog). */
export function frDate(d: Date = new Date()): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Accès typé à un champ chiffré d'un OpcoData. */
export function getField(opco: OpcoData, field: NumericField): SourcedValue<number | null> {
  return opco[field];
}

/** Rétrograde une confiance d'un cran : exact -> estimated -> depends_on_branche. */
export function downgradeConfidence(c: Confidence): Confidence {
  if (c === 'exact') return 'estimated';
  return 'depends_on_branche';
}

/** Clone profond (les OpcoData sont du JSON pur). */
export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

/** Pause asynchrone (throttle réseau). */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
