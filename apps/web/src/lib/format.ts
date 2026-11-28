// ============================================================
// Formatage et libellés propres au site (le moteur et les types
// métier viennent de @opco/core).
// ============================================================

import type { DispositifComplementaire } from '@opco/core';
import { INSECABLE } from './insecable';

/**
 * Nombre suivi de son unité, à la française : milliers séparés (espace fine insécable, Intl fr-FR), virgule décimale,
 * espace insécable avant l'unité (« 1 500 h », « 24 mois », « 3,5 h ») ; l'unité ne passe jamais seule à la ligne.
 */
export function nombreEtUnite(n: number, unite: string): string {
  return `${new Intl.NumberFormat('fr-FR').format(n)}${INSECABLE}${unite}`;
}

/**
 * « de » devant un nom, élidé devant une voyelle : « d'AKTO », « d'OPCO 2i », « de Constructys ». L'article élidé qui
 * ouvre un nom passe en minuscule : « de l'Opcommerce », pas « de L'Opcommerce ».
 */
export function de(nom: string): string {
  if (/^L['’]/.test(nom)) return `de l${nom.slice(1)}`;
  return /^[aeiouyàâäéèêëîïôöûü]/i.test(nom) ? `d'${nom}` : `de ${nom}`;
}

/**
 * Montant en euros, à la française : un montant entier sans décimales (« 6 300 € »), tout autre montant avec deux
 * (« 1 500,50 € », jamais « 1 500,5 € »), jugé au centime près (un reste de calcul en virgule flottante ne fait pas
 * apparaître de décimales). Espace fine insécable entre les milliers et insécable avant « € » (Intl, fr-FR).
 */
export function formatEuro(amount: number): string {
  const decimales = Math.round(amount * 100) % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
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

const DATE_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const datesFr = (s: string): string => s.replace(DATE_ISO, '$3/$2/$1');

/**
 * Applique `transformer` au seul texte hors citation : les extraits cités entre « » restent mot pour mot (citations
 * imbriquées comprises ; une citation non refermée court jusqu'à la fin du texte ; un « » » isolé est un simple caractère).
 */
export function horsCitations(s: string, transformer: (morceau: string) => string): string {
  let resultat = '';
  let profondeur = 0;
  let debut = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '«') {
      if (profondeur === 0) {
        resultat += transformer(s.slice(debut, i));
        debut = i;
      }
      profondeur++;
    } else if (s[i] === '»' && profondeur > 0) {
      profondeur--;
      if (profondeur === 0) {
        resultat += s.slice(debut, i + 1);
        debut = i + 1;
      }
    }
  }
  return resultat + (profondeur > 0 ? s.slice(debut) : transformer(s.slice(debut)));
}

/**
 * Convertit les dates ISO (AAAA-MM-JJ) d'un texte d'annotation en JJ/MM/AAAA, par remplacement de chaîne (aucun fuseau
 * horaire en jeu). À appliquer à tout texte des données affiché tel quel (notes de barème, de dispositif ou de variante,
 * conditions, démarches, textes libres). Les extraits cités entre « » restent mot pour mot, dates comprises : seul le
 * texte hors citation est converti (citations imbriquées comprises ; une citation non refermée court jusqu'à la fin).
 */
export function texteFr(s: string): string {
  return horsCitations(s, datesFr);
}

/** Unités qu'une espace insécable attache au nombre qui les précède (mot entier : « 5 annexes » n'est pas « 5 ans »). */
const NOMBRE_ET_UNITE = /(\d) (?=(?:%|€|h|ans?|mois|jours?|heures?|km|nuits?|salariés?|euros?)(?![\p{L}\p{N}]))/gu;
/** Groupe de milliers : « 2 000 », « 1 500 000 ». */
const GROUPE_DE_MILLIERS = /(\d) (?=\d{3}(?!\d))/g;
/** Ponctuation haute précédée d'une espace ordinaire. */
const PONCTUATION_HAUTE = / (?=[:;?!])/g;

/**
 * Typographie française d'un texte tiré des tableaux ou des données (espaces ordinaires dans les sources) : espace
 * insécable avant « : ; ? ! », entre un nombre et son unité (%, €, h, ans, mois, jours, heures, km, nuits, salariés,
 * euros) et entre les groupes de milliers, pour qu'aucune ponctuation, unité ou fin de nombre ne commence seule une
 * ligne. Seules des espaces ordinaires deviennent insécables (même longueur, aucun autre caractère touché) ; les extraits
 * cités entre « » restent mot pour mot.
 */
export function typo(s: string): string {
  return horsCitations(s, (morceau) =>
    morceau
      .replace(PONCTUATION_HAUTE, INSECABLE)
      .replace(NOMBRE_ET_UNITE, `$1${INSECABLE}`)
      .replace(GROUPE_DE_MILLIERS, `$1${INSECABLE}`),
  );
}

/**
 * Montant écrit par le moteur dans ses textes de calcul : nombre à point décimal ou sans séparateur de milliers, suivi
 * de « € » avec ou sans espace (« 840.00 € », « 42.86 €/h », « 1500 € »). Ce qui précède le nombre n'est ni un chiffre,
 * ni un point, ni une virgule, ni un chiffre suivi d'une espace (ordinaire, insécable ou fine : `\s`) : un montant déjà
 * écrit à la française (« 1 500 € », « 9,15 € ») n'est jamais lu par morceaux.
 */
const MONTANT_DU_MOTEUR = /(?<![\d.,])(?<!\d\s)(\d+(?:\.\d+)?)\s?€/g;
/** « 2.000 € », « 12.500 € » : point séparateur de milliers (forme des citations de source), jamais lu comme décimale. */
const MILLIERS_A_POINT = /^[1-9]\d{0,2}(?:\.\d{3})+$/;

/**
 * Qui a écrit le texte : `donnees`, un humain (notes, conditions, démarches des barèmes et du catalogue), qui peut
 * séparer les milliers par un point (« 2.000 € ») ; `moteur`, le calcul de @opco/core, qui écrit ses nombres par
 * JavaScript : point décimal, jamais de séparateur de milliers (« 17.875 €/h » vaut 17,875 €/h, pas 17 875 €/h).
 */
export type AuteurDuTexte = 'donnees' | 'moteur';

/**
 * Montants en euros d'un texte réécrits par `formatEuro` : « 840.00 € » devient « 840 € », « 42.86 €/h » devient
 * « 42,86 €/h », « 12600.00 € » devient « 12 600 € ». Un montant déjà écrit à la française reste tel quel ; un nombre
 * collé à un autre n'est pas réinterprété. Point de milliers : dans un texte des données, « 2.000 € » reste tel quel
 * (jamais lu comme 2 €) ; dans un texte du moteur, tout nombre à point est décimal, arrondi au centime par `formatEuro`
 * (« 17.875 €/h » devient « 17,88 €/h »).
 */
export function montantsFr(s: string, auteur: AuteurDuTexte = 'donnees'): string {
  return s.replace(MONTANT_DU_MOTEUR, (montant: string, nombre: string) =>
    auteur === 'donnees' && MILLIERS_A_POINT.test(nombre) ? montant : formatEuro(Number(nombre)),
  );
}

/**
 * Nombre décimal du moteur hors montant, devant une durée, un pourcentage ou une autre unité (« 3.5h », la durée
 * minimale d'OCAPIAT ; « 12.5% ») : écrit à la française, deux décimales au plus (« 3,5h », « 12,5% »).
 */
const DECIMALE_DU_MOTEUR = /(?<![\d.,])\d+\.\d+(?![\d.,])(?=\s?(?:h|%|heures?|jours?|nuits?|km)(?![\p{L}\p{N}]))/gu;
const decimalesFr = (s: string): string =>
  s.replace(DECIMALE_DU_MOTEUR, (nombre) =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(nombre)),
  );

/**
 * Texte des données prêt à l'affichage : dates au format JJ/MM/AAAA, montants écrits par `formatEuro` et typographie
 * française, hors extraits cités. Un texte écrit par le moteur passe par `texteMoteur`.
 */
export function texteDonnees(s: string): string {
  return typo(horsCitations(s, (morceau) => montantsFr(datesFr(morceau))));
}

/**
 * Texte écrit par le moteur (détail du calcul et notes des postes de l'OPCO, points d'attention) prêt à l'affichage :
 * comme `texteDonnees`, mais chaque nombre à point est décimal (le moteur n'écrit jamais de séparateur de milliers),
 * montant arrondi au centime (« 17.875 €/h » devient « 17,88 €/h », comme à l'étape Formation) ou autre nombre à
 * virgule (« 3.5h » devient « 3,5h »). Les extraits cités entre « » restent mot pour mot.
 */
export function texteMoteur(s: string): string {
  return typo(horsCitations(s, (morceau) => decimalesFr(montantsFr(datesFr(morceau), 'moteur'))));
}

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

/**
 * Vérification la plus récente des barèmes parmi les OPCO (AAAA-MM-JJ : l'ordre alphabétique est l'ordre
 * chronologique), annoncée par le pied de page et l'écran de résultats ; chaîne vide sans aucune date.
 */
export function verificationLaPlusRecente(opcos: readonly { derniere_verification?: string | null }[]): string {
  return opcos.reduce(
    (recente, o) => (o.derniere_verification && o.derniere_verification > recente ? o.derniere_verification : recente),
    '',
  );
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

/** Adresse web : une phrase qui en porte une cite sa provenance. */
const ADRESSE_WEB = /https?:\/\//;

/**
 * La phrase sans ses parenthèses de source, c'est-à-dire celles qui contiennent une adresse web (citation et lien, par
 * exemple « (« … », https://…) ») ; les parenthèses imbriquées sont comptées, l'espace qui précède est retiré.
 */
function sansParenthesesDeSource(phrase: string): string {
  let sortie = '';
  let i = 0;
  while (i < phrase.length) {
    if (phrase[i] === '(') {
      let profondeur = 0;
      let j = i;
      for (; j < phrase.length; j++) {
        if (phrase[j] === '(') profondeur++;
        else if (phrase[j] === ')' && --profondeur === 0) break;
      }
      if (j < phrase.length) {
        const groupe = phrase.slice(i, j + 1);
        if (ADRESSE_WEB.test(groupe)) sortie = sortie.replace(/\s+$/, '');
        else sortie += groupe;
        i = j + 1;
        continue;
      }
    }
    sortie += phrase[i];
    i++;
  }
  return sortie.trim();
}

/**
 * Règle d'une annotation en une phrase, pour l'écran étroit où la colonne « Précision » est masquée. Les notes des
 * données commencent souvent par un ou plusieurs extraits cités entre « » (la source, mot pour mot) avant la règle
 * elle-même : ces extraits de tête sont sautés et la première phrase de la règle est gardée, sans la mention de fin
 * « (vérifié le … ) ». Sans règle propre (note faite de citations seules, ou suivies d'une simple parenthèse de
 * provenance « (fiche … ) »), la première citation est rendue telle quelle. Dates au format JJ/MM/AAAA.
 *
 * Une phrase qui porte une adresse web (http:// ou https://) est une phrase de provenance : le résumé se replie sur
 * l'extrait cité en tête. Sans extrait de tête, la phrase est gardée sans ses parenthèses de source (une règle suivie de
 * sa citation et de son lien) ; si l'adresse reste, le résumé est le premier extrait cité de la note.
 */
export function premierePhrase(note: string): string {
  const texte = texteFr(note).trim();
  const sansMention = (s: string): string => s.replace(MENTION_DE_VERIFICATION, '').trim();
  const citationDeTete = /^«[^»]*»/.exec(texte)?.[0];
  const regle = sansMention(texte.replace(CITATIONS_DE_TETE, ''));
  if (!regle || regle.startsWith('(')) return citationDeTete ?? sansMention(texte);
  const fin = FIN_DE_PHRASE.exec(regle);
  let phrase = fin ? regle.slice(0, fin.index + 1) : regle;
  if (ADRESSE_WEB.test(phrase)) {
    if (citationDeTete) return citationDeTete;
    const sansSource = sansParenthesesDeSource(phrase);
    if (!sansSource || ADRESSE_WEB.test(sansSource)) return /«[^»]*»/.exec(texte)?.[0] ?? phrase;
    phrase = sansSource;
  }
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
