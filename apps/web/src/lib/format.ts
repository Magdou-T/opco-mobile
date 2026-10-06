// ============================================================
// Formatage et libellés propres au site (le moteur et les types
// métier viennent de @opco/core).
// ============================================================

import type { DispositifComplementaire } from '@opco/core';

/** Montant en euros, à la française (« 6 300 € »). */
export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * 'AAAA-MM-JJ' → 'JJ/MM/AAAA', par découpage de chaîne (aucun fuseau horaire en jeu).
 * Toute autre forme est rendue telle quelle.
 */
export function dateFr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Règle de cumul d'un dispositif complémentaire avec l'enveloppe du plan de développement des compétences. */
export const CUMUL_LABELS: Record<DispositifComplementaire['cumul'], string> = {
  hors_budget: "s'ajoute au budget",
  additif: 'enveloppe distincte',
  alternatif: 'remplace le plan',
};

/** Explication de chaque règle de cumul, pour la légende des fiches. */
export const CUMUL_EXPLICATIONS: Record<DispositifComplementaire['cumul'], string> = {
  hors_budget: "ne consomme pas le budget annuel du plan de développement des compétences : il s'ajoute à ce budget.",
  additif: "enveloppe séparée, qui s'ajoute à celle du plan de développement des compétences.",
  alternatif: 'catalogue ou dispositif dédié qui remplace le plan pour la formation concernée : non cumulable avec lui.',
};

/** Ordre d'affichage des dispositifs : ce qui s'ajoute d'abord, ce qui remplace le plan ensuite. */
export const CUMUL_ORDRE: DispositifComplementaire['cumul'][] = ['hors_budget', 'additif', 'alternatif'];

/** Unité d'un montant plafond de dispositif (null : montant sans unité précisée). */
export const UNITE_DISPOSITIF_LABELS: Record<NonNullable<DispositifComplementaire['unite']>, string> = {
  par_stagiaire: 'par stagiaire',
  par_dossier: 'par dossier',
  par_an: 'par an',
  par_jour: 'par jour',
  par_heure: 'par heure',
};
