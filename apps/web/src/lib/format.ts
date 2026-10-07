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

/**
 * Convertit les dates ISO (AAAA-MM-JJ) d'un texte d'annotation en JJ/MM/AAAA, par remplacement de chaîne (aucun fuseau
 * horaire en jeu). À appliquer à tout texte des données affiché tel quel (notes de barème, de dispositif ou de variante,
 * conditions, démarches, textes libres) ; à ne pas appliquer aux extraits cités entre « » des alertes, qui restent mot
 * pour mot.
 */
export const texteFr = (s: string): string => s.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3/$2/$1');

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/**
 * 'AAAA-MM-JJ' → « octobre 2026 » (mois en toutes lettres), par table de mois : ni fuseau horaire ni données de langue
 * du moteur JavaScript en jeu. Toute autre forme est rendue telle quelle.
 */
export function moisAnneeFr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(iso);
  const mois = m ? MOIS[Number(m[2]) - 1] : undefined;
  return m && mois ? `${mois} ${m[1]}` : iso;
}

/** Extraits cités (« … », séparés ou non par « ; ») qui ouvrent une annotation. */
const CITATIONS_DE_TETE = /^(?:«[^»]*»\s*;?\s*)+/;

/** Mention de fin « (vérifié le … ) » ou « (relu en ligne le … ) » : la parenthèse finale qui date la vérification. */
const MENTION_DE_VERIFICATION = /\s*\((?:vérifié|relu)[^()]*\)\.?\s*$/;

/**
 * Fin de la première phrase : un point (ou « ! », « ? ») suivi d'une majuscule, d'une parenthèse, d'un guillemet ou de la
 * fin du texte. Les abréviations courantes (ex., env., cf., art., vs.) ne terminent pas la phrase.
 */
const FIN_DE_PHRASE = /(?<!\b(?:[Ee]x|[Ee]nv|[Cc]f|[Aa]rt|[Vv]s))[.!?](?=\s+[A-ZÀ-ÖØ-Þ«(]|$)/;

/**
 * Règle d'une annotation en une phrase, pour l'écran étroit où la colonne « Précision » est masquée. Les notes des
 * données commencent souvent par un ou plusieurs extraits cités entre « » (la source, mot pour mot) avant la règle
 * elle-même : ces extraits de tête sont sautés et la première phrase de la règle est gardée, sans la mention de fin
 * « (vérifié le … ) ». Sans règle propre (note faite de citations seules, ou suivies d'une simple parenthèse de
 * provenance « (fiche … ) »), la première citation est rendue telle quelle. Dates au format JJ/MM/AAAA.
 */
export function premierePhrase(note: string): string {
  const texte = texteFr(note).trim();
  const sansMention = (s: string): string => s.replace(MENTION_DE_VERIFICATION, '').trim();
  const regle = sansMention(texte.replace(CITATIONS_DE_TETE, ''));
  if (!regle || regle.startsWith('(')) return /^«[^»]*»/.exec(texte)?.[0] ?? sansMention(texte);
  const fin = FIN_DE_PHRASE.exec(regle);
  const phrase = fin ? regle.slice(0, fin.index + 1) : regle;
  // La mention de vérification emportait le point final d'une phrase unique : on le rétablit.
  return /[\p{L}\p{N}%€]$/u.test(phrase) ? `${phrase}.` : phrase;
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
