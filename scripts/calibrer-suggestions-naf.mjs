// ============================================================
// Calibrage des suggestions d'OPCO par code NAF (packages/core/data/idcc/naf-suggestions.json).
//
// Ce que fait le script : il refait de bout en bout la mesure décrite dans la spécification, section 5.5
// (docs/superpowers/specs/2026-10-05-aides-financements-design.md) :
//   1. nomenclature NAF rév. 2 de l'INSEE : les quatre listes officielles (divisions, groupes, classes, sous-classes), au
//      format XLS, lues par un lecteur intégré (aucune dépendance) ;
//   2. ressource la plus récente de la Table SIRET-OPCO de France compétences (data.gouv.fr, Licence Ouverte 2.0) ;
//   3. pour chaque préfixe candidat (par défaut : ceux de naf-suggestions.json et tous leurs ancêtres), un cadre de
//      tirage : unités légales actives de l'API Recherche d'entreprises dont l'activité principale relève du préfixe,
//      employeuses, en deux strates (1 à 9 salariés : 24 employeurs comptés ; 10 salariés et plus : 12 ; une strate trop
//      petite cède son quota à l'autre), sur des pages tirées au hasard (graine fixe, propre à chaque cadre), 6 unités au
//      plus par page ; le SIRET du siège est lu dans la Table SIRET-OPCO par l'API tabulaire (colonne OPCO_PROPRIETAIRE) ;
//   4. exclusions : catégorie juridique 7xxx (employeur de droit public : le résolveur ne lui suggère jamais d'OPCO d'après
//      le code NAF), siège sans SIRET, SIRET absent de la table, OPCO nul ou inconnu ;
//   5. agrégation pure (agregerSuggestions, exportée et testée par packages/core/tests/calibrer-suggestions-naf.test.ts) :
//      chaque préfixe est mesuré sur la population qu'il sert (ses sous-classes moins celles d'un préfixe plus long
//      retenu), avec les seuls tirages dont le cadre la contient en entier ; du plus long au plus court, il est retenu si
//      l'échantillon compte au moins 30 employeurs, si l'OPCO le plus fréquent en réunit au moins 60 % et si aucune de ses
//      sous-classes (10 employeurs observés au moins) ne relève en majorité d'un autre OPCO (secteur partagé) ; un préfixe
//      plus long qui donne le même OPCO que son ancêtre retenu est retiré quand l'ancêtre, remesuré avec lui, reste retenu ;
//   6. sorties : un JSON au format de naf-suggestions.json et un rapport Markdown (chiffres et décision de chaque préfixe,
//      écarts avec le fichier actuel, exceptions à déclarer, marges faibles).
//
// Lancement, depuis la racine du dépôt (Node 22 ou plus récent) :
//   node scripts/calibrer-suggestions-naf.mjs --cache <dossier hors du dépôt>
//   Options : --graine <entier> (20261008 par défaut) ; --prefixes 96.02A,47.73Z (remplace la liste par défaut) ;
//   --max-requetes <n> (plafond de requêtes réseau, 8000 par défaut ; les réponses déjà en cache ne comptent pas) ;
//   --ressource <identifiant de ressource data.gouv.fr> (par défaut : la plus récente) ; --sortie <fichier.json> et
//   --rapport <fichier.md> (par défaut dans le dossier de cache) ; --help.
// Requêtes : de l'ordre de 6 500 pour la liste par défaut (179 préfixes candidats, 138 cadres de tirage distincts ; par
//   cadre, 2 lectures du nombre d'unités, une dizaine de pages de l'API Recherche d'entreprises et 36 à 40 lectures de la
//   table, davantage quand le secteur compte beaucoup d'employeurs publics), plus 5 pour la nomenclature et les
//   métadonnées. 300 ms au moins entre deux requêtes (moins de 4 par seconde) ; au rythme mesuré le 08/10/2026 (0,75 s par
//   requête, attente comprise), compter une heure et demie. Chaque réponse est gardée dans le dossier de cache : une
//   relance avec le même dossier reprend là où la précédente s'est arrêtée, sans refaire une requête. Hôtes interrogés : www.insee.fr, www.data.gouv.fr,
//   tabular-api.data.gouv.fr, recherche-entreprises.api.gouv.fr ; jamais api.francecompetences.fr (refusé avant toute
//   requête, comme tout autre hôte).
// Quand le relancer : à chaque mise à jour de la Table SIRET-OPCO sur data.gouv.fr (nouveau mois de DSN), et à la revue
//   annuelle des données. Le script n'écrit jamais dans le dépôt : lire le rapport, reporter à la main les changements
//   retenus dans naf-suggestions.json, déclarer exceptions et marges faibles dans packages/core/tests/naf-suggestions.test.ts,
//   lancer les tests du cœur, puis mettre à jour la section 5.5 de la spécification et la date de la table citée par le
//   site (TABLE_SIRET_OPCO, apps/web/src/lib/mentions.ts).
// Limite de l'API Recherche d'entreprises : 10 000 unités au plus par requête (400 pages de 25) ; pour une strate plus
//   grande, le tirage porte sur les 10 000 premières unités dans l'ordre de l'API.
// ============================================================

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TABLE_ACTUELLE = join(RACINE, 'packages', 'core', 'data', 'idcc', 'naf-suggestions.json');

/** Source citée par chaque suggestion (champ `source` de naf-suggestions.json). */
export const SOURCE_TABLE_SIRET_OPCO = 'https://www.data.gouv.fr/datasets/table-siret-opco';
const API_JEU_DE_DONNEES = 'https://www.data.gouv.fr/api/1/datasets/table-siret-opco/';
const API_TABULAIRE = 'https://tabular-api.data.gouv.fr/api/resources';
const API_RECHERCHE = 'https://recherche-entreprises.api.gouv.fr/search';
const NOMENCLATURE_INSEE = 'https://www.insee.fr/fr/statistiques/fichier/2120875';

/** Seuls hôtes interrogés (https). Tout autre hôte, dont api.francecompetences.fr, est refusé avant la requête. */
export const HOTES_AUTORISES = new Set([
  'www.insee.fr',
  'www.data.gouv.fr',
  'tabular-api.data.gouv.fr',
  'recherche-entreprises.api.gouv.fr',
]);

/** Seuils de la méthode (spécification, section 5.5). */
export const SEUILS = Object.freeze({
  /** Part minimale de l'OPCO le plus fréquent. */
  partMinimale: 0.6,
  /** Taille minimale de l'échantillon d'un préfixe. */
  echantillonMinimal: 30,
  /** Employeurs observés à partir desquels une sous-classe peut révéler un secteur partagé. */
  sousClasseMinimale: 10,
  /** Part à partir de laquelle une sous-classe « relève en majorité » d'un autre OPCO. */
  partContradiction: 0.5,
  /** Part jusqu'à laquelle une entrée est dite à faible marge (à remesurer en priorité). */
  margeFaible: 0.7,
});

/** Strates du tirage : tranches d'effectif INSEE (employeurs seulement) et nombre d'employeurs comptés visé. */
export const STRATES = Object.freeze([
  { nom: '1 à 9 salariés', tranches: ['01', '02', '03'], quota: 24 },
  { nom: '10 salariés et plus', tranches: ['11', '12', '21', '22', '31', '32', '41', '42', '51', '52', '53'], quota: 12 },
]);

const PAR_PAGE = 25;
const PAGES_ACCESSIBLES = 400;
const UNITES_PAR_PAGE = 6;
const GRAINE_PAR_DEFAUT = 20261008;
const INTERVALLE_MS = 300;
const MAX_REQUETES_PAR_DEFAUT = 8000;

// ------------------------------------------------------------
// Fonctions pures (exportées pour les tests)
// ------------------------------------------------------------

/**
 * @typedef {object} Observation Un employeur compté : son cadre de tirage, son établissement siège, sa sous-classe et son OPCO.
 * @property {string} cadre préfixe du cadre de tirage (le plus court des préfixes candidats de même population)
 * @property {string} siret SIRET du siège (un établissement n'est compté qu'une fois)
 * @property {string} naf sous-classe NAF de l'unité légale (« 96.02A »)
 * @property {string} opco identifiant d'OPCO du cœur (« opco-ep »)
 */

/**
 * @typedef {object} Decision Mesure et décision pour un préfixe candidat.
 * @property {string} prefixe
 * @property {number} n employeurs de l'échantillon
 * @property {string | null} opco OPCO le plus fréquent
 * @property {number} compte employeurs de cet OPCO
 * @property {number} part part arrondie à deux décimales
 * @property {Record<string, number>} repartition employeurs par OPCO
 * @property {boolean} retenu
 * @property {string | null} motif raison d'un préfixe écarté (null s'il est retenu)
 */

/**
 * @typedef {object} EntreeCalibree Entrée retenue, au format de naf-suggestions.json (sans libellé ni source).
 * @property {string} prefixe
 * @property {string} opco
 * @property {number} part
 * @property {number} effectif_etablissements
 */

const DIACRITIQUES = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');

const OPCO_PAR_NOM = new Map([
  ['AFDAS', 'afdas'],
  ['AKTO', 'akto'],
  ['ATLAS', 'atlas'],
  ['CONSTRUCTYS', 'constructys'],
  ['OCAPIAT', 'ocapiat'],
  ['OPCOEP', 'opco-ep'],
  ['OPCOMOBILITES', 'opco-mobilites'],
  ['OPCOSANTE', 'opco-sante'],
  ['OPCO2I', 'opco2i'],
  ['OPCOMMERCE', 'opcommerce'],
  ['LOPCOMMERCE', 'opcommerce'],
  ['UNIFORMATION', 'uniformation'],
]);

/**
 * OPCO de la colonne OPCO_PROPRIETAIRE (« OPCO EP », « L'OPCOMMERCE », « Opco Santé ») en identifiant du cœur ; null pour
 * une valeur vide ou inconnue.
 * @param {unknown} valeur
 * @returns {string | null}
 */
export function opcoDepuisTable(valeur) {
  if (valeur == null) return null;
  const cle = String(valeur).normalize('NFD').replace(DIACRITIQUES, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return OPCO_PAR_NOM.get(cle) ?? null;
}

/**
 * Empreinte FNV-1a sur 32 bits : graine propre à chaque cadre de tirage (l'ajout d'un cadre ne change pas les autres).
 * @param {string} texte
 * @returns {number}
 */
export function empreinte(texte) {
  let h = 0x811c9dc5;
  for (const c of texte) {
    h ^= c.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Générateur mulberry32 : suite reproductible de nombres dans [0 ; 1[.
 * @param {number} graine
 * @returns {() => number}
 */
export function generateur(graine) {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mélange de Fisher-Yates, sans modifier la liste reçue.
 * @template T
 * @param {readonly T[]} liste
 * @param {() => number} hasard
 * @returns {T[]}
 */
export function melanger(liste, hasard) {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

/**
 * Préfixes NAF d'un code, du plus court au plus long : division, groupe, classe, sous-classe (« 47.73Z » donne 47, 47.7,
 * 47.73 et 47.73Z ; « 47.7 » donne 47 et 47.7).
 * @param {string} code
 * @returns {string[]}
 */
export function prefixesDe(code) {
  return [code.slice(0, 2), code.slice(0, 4), code.slice(0, 5), code].filter((p, i, t) => t.indexOf(p) === i);
}

/** Ordre des préfixes de naf-suggestions.json : ordre des caractères (« 10 » avant « 10.13B »). */
const parCode = (/** @type {string} */ a, /** @type {string} */ b) => (a < b ? -1 : a > b ? 1 : 0);
/** Du plus long au plus court, puis dans l'ordre des codes. */
const parLongueur = (/** @type {string} */ a, /** @type {string} */ b) => b.length - a.length || parCode(a, b);

/** Un établissement une fois : la première observation de chaque SIRET. */
const uniques = (/** @type {Observation[]} */ liste) => [...new Map(liste.map((o) => [o.siret, o])).values()];

/**
 * Répartition d'un échantillon par OPCO ; OPCO le plus fréquent (à égalité, le premier dans l'ordre des identifiants).
 * @param {Observation[]} liste
 */
function mesurer(liste) {
  /** @type {Map<string, number>} */
  const comptes = new Map();
  for (const o of liste) comptes.set(o.opco, (comptes.get(o.opco) ?? 0) + 1);
  const classes = [...comptes].sort((a, b) => b[1] - a[1] || parCode(a[0], b[0]));
  const n = liste.length;
  const [opco, compte] = classes[0] ?? [null, 0];
  return {
    n,
    opco,
    compte,
    ratio: n > 0 ? compte / n : 0,
    part: n > 0 ? Math.round((compte / n) * 100) / 100 : 0,
    repartition: Object.fromEntries(classes),
  };
}

const pourcent = (/** @type {number} */ x) => `${Math.round(x * 100)} %`;

/**
 * Agrégation de la méthode (spécification, section 5.5), sans entrée-sortie.
 * - Échantillon d'un préfixe : les employeurs de sa population (ses sous-classes moins celles d'un préfixe plus long
 *   retenu), tirés dans un cadre qui contient cette population en entier (le cadre du préfixe ou d'un de ses ancêtres :
 *   tirage proportionnel), chaque établissement une fois.
 * - Du plus long au plus court : un préfixe est retenu si l'échantillon compte au moins `echantillonMinimal` employeurs,
 *   si l'OPCO le plus fréquent en réunit au moins `partMinimale` et si aucune sous-classe de sa population, observée sur
 *   au moins `sousClasseMinimale` employeurs (tous cadres confondus), ne relève pour au moins `partContradiction` d'un
 *   autre OPCO (secteur partagé). Un préfixe écarté rend sa population à son ancêtre, mesuré ensuite.
 * - Redondance : un préfixe retenu qui donne le même OPCO que son plus proche ancêtre retenu est retiré quand l'ancêtre,
 *   remesuré avec sa population, reste retenu avec le même OPCO (jusqu'à ce que plus rien ne change).
 * @param {Observation[]} observations
 * @param {Partial<typeof SEUILS> & { prefixes?: string[] }} [options] `prefixes` : candidats (par défaut, les cadres)
 * @returns {{ entrees: EntreeCalibree[], decisions: Decision[], exceptions: { prefixe: string, opco: string, parent: string, opcoParent: string }[], margesFaibles: string[] }}
 */
export function agregerSuggestions(observations, options = {}) {
  const seuils = { ...SEUILS, ...options };
  const candidats = [...new Set(options.prefixes ?? observations.map((o) => o.cadre))].sort(parLongueur);
  /** @type {Map<string, Observation[]>} */
  const parSousClasse = new Map();
  for (const o of observations) parSousClasse.set(o.naf, [...(parSousClasse.get(o.naf) ?? []), o]);

  /** @returns {Decision} */
  const evaluer = (/** @type {string} */ prefixe, /** @type {Set<string>} */ retenus) => {
    // Population servie : les sous-classes du préfixe moins celles d'un préfixe plus long retenu.
    const plusLongs = [...retenus].filter((q) => q.length > prefixe.length && q.startsWith(prefixe));
    const dansLaPopulation = (/** @type {string} */ naf) => naf.startsWith(prefixe) && !plusLongs.some((q) => naf.startsWith(q));
    const liste = uniques(observations.filter((o) => prefixe.startsWith(o.cadre) && dansLaPopulation(o.naf)));
    const m = mesurer(liste);
    /** @type {string | null} */
    let motif = null;
    if (m.n < seuils.echantillonMinimal) {
      motif = `échantillon trop petit : ${m.n} employeurs (${seuils.echantillonMinimal} au moins)`;
    } else if (m.ratio < seuils.partMinimale) {
      motif = `secteur partagé : ${m.opco} réunit ${pourcent(m.ratio)} des employeurs (${pourcent(seuils.partMinimale)} au moins)`;
    } else {
      // Toute sous-classe observée de la population, quel que soit le cadre qui l'a tirée (le sien compris).
      for (const naf of [...parSousClasse.keys()].filter(dansLaPopulation).sort(parCode)) {
        const s = mesurer(uniques(parSousClasse.get(naf) ?? []));
        if (s.n >= seuils.sousClasseMinimale && s.opco !== m.opco && s.ratio >= seuils.partContradiction) {
          motif = `secteur partagé : la sous-classe ${naf} relève de ${s.opco} pour ${s.compte} employeurs sur ${s.n}`;
          break;
        }
      }
    }
    return {
      prefixe,
      n: m.n,
      opco: m.opco,
      compte: m.compte,
      part: m.part,
      repartition: m.repartition,
      retenu: motif === null,
      motif,
    };
  };

  /** @type {Set<string>} */
  const retenus = new Set();
  /** @type {Map<string, Decision>} */
  const decisions = new Map();
  for (const p of candidats) {
    const d = evaluer(p, retenus);
    decisions.set(p, d);
    if (d.retenu) retenus.add(p);
  }

  const ancetreRetenu = (/** @type {string} */ p, /** @type {Set<string>} */ ensemble) =>
    prefixesDe(p)
      .slice(0, -1)
      .reverse()
      .find((a) => a !== p && ensemble.has(a)) ?? null;
  const decision = (/** @type {string} */ p) => /** @type {Decision} */ (decisions.get(p));

  for (let change = true; change; ) {
    change = false;
    for (const p of [...retenus].sort(parLongueur)) {
      const a = ancetreRetenu(p, retenus);
      if (!a || decision(a).opco !== decision(p).opco) continue;
      const sansLui = new Set(retenus);
      sansLui.delete(p);
      const remesure = evaluer(a, sansLui);
      if (!remesure.retenu || remesure.opco !== decision(a).opco) continue;
      retenus.delete(p);
      decisions.set(a, remesure);
      decisions.set(p, { ...decision(p), retenu: false, motif: `redondant : même OPCO que ${a}, qui le couvre` });
      change = true;
      break;
    }
  }

  const entrees = [...retenus].sort(parCode).map((p) => {
    const d = decision(p);
    return { prefixe: p, opco: /** @type {string} */ (d.opco), part: d.part, effectif_etablissements: d.n };
  });
  const exceptions = entrees.flatMap((e) => {
    const parent = ancetreRetenu(e.prefixe, retenus);
    const opcoParent = parent ? decision(parent).opco : null;
    return parent && opcoParent && opcoParent !== e.opco ? [{ prefixe: e.prefixe, opco: e.opco, parent, opcoParent }] : [];
  });
  return {
    entrees,
    decisions: [...decisions.values()].sort((x, y) => parCode(x.prefixe, y.prefixe)),
    exceptions,
    margesFaibles: entrees.filter((e) => e.part <= seuils.margeFaible).map((e) => e.prefixe),
  };
}

/**
 * Écarts entre les entrées calibrées et la table actuelle : entrées ajoutées, retirées, OPCO changé, part changée d'au
 * moins `ecartDePart`.
 * @param {{ prefixe: string, opco: string, part: number | null, effectif_etablissements?: number | null }[]} entrees
 * @param {{ prefixe: string, opco: string, part: number | null, effectif_etablissements?: number | null }[]} actuelles
 * @param {number} [ecartDePart]
 */
export function comparerAvecTable(entrees, actuelles, ecartDePart = 0.05) {
  const avant = new Map(actuelles.map((e) => [e.prefixe, e]));
  const apres = new Map(entrees.map((e) => [e.prefixe, e]));
  const communes = entrees.filter((e) => avant.has(e.prefixe));
  const ancienne = (/** @type {string} */ p) => /** @type {(typeof actuelles)[number]} */ (avant.get(p));
  return {
    ajoutees: entrees.filter((e) => !avant.has(e.prefixe)),
    retirees: actuelles.filter((e) => !apres.has(e.prefixe)),
    opcoChange: communes
      .filter((e) => ancienne(e.prefixe).opco !== e.opco)
      .map((e) => ({ prefixe: e.prefixe, avant: ancienne(e.prefixe).opco, apres: e.opco })),
    partChange: communes
      .filter((e) => ancienne(e.prefixe).opco === e.opco && Math.abs((ancienne(e.prefixe).part ?? 0) - (e.part ?? 0)) >= ecartDePart)
      .map((e) => ({
        prefixe: e.prefixe,
        avant: ancienne(e.prefixe).part,
        apres: e.part,
        nAvant: ancienne(e.prefixe).effectif_etablissements ?? null,
        nApres: e.effectif_etablissements ?? null,
      })),
    inchangees: communes.filter(
      (e) => ancienne(e.prefixe).opco === e.opco && Math.abs((ancienne(e.prefixe).part ?? 0) - (e.part ?? 0)) < ecartDePart,
    ).length,
  };
}

/**
 * true si l'adresse peut être interrogée : https et hôte de la liste HOTES_AUTORISES (jamais api.francecompetences.fr).
 * @param {string} adresse
 */
export function hoteAutorise(adresse) {
  try {
    const { protocol, hostname } = new URL(adresse);
    return protocol === 'https:' && HOTES_AUTORISES.has(hostname) && !hostname.endsWith('francecompetences.fr');
  } catch {
    return false;
  }
}

/**
 * true si le chemin est dans le dépôt (ou est le dépôt) : le cache et les sorties restent hors du dépôt.
 * @param {string} chemin
 * @param {string} [racine]
 */
export function estDansLeDepot(chemin, racine = RACINE) {
  const rel = relative(racine, resolve(chemin));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

// ------------------------------------------------------------
// Lecture d'un classeur XLS (BIFF8 dans un fichier composé OLE2) : première feuille, textes et nombres
// ------------------------------------------------------------

/**
 * Flux « Workbook » d'un fichier composé OLE2.
 * @param {Buffer} octets
 */
function fluxDuClasseur(octets) {
  const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (octets.length < 512 || !signature.every((b, i) => octets[i] === b)) throw new Error('classeur XLS (OLE2) attendu');
  const tailleSecteur = 1 << octets.readUInt16LE(30);
  const tailleMini = 1 << octets.readUInt16LE(32);
  const nbSecteursFat = octets.readUInt32LE(44);
  const premierRepertoire = octets.readUInt32LE(48);
  const seuilMini = octets.readUInt32LE(56);
  const premierMiniFat = octets.readUInt32LE(60);
  let secteurDifat = octets.readUInt32LE(68);
  const FIN = 0xfffffffa;
  const decalage = (/** @type {number} */ s) => (s + 1) * tailleSecteur;
  /** @type {number[]} */
  const secteursFat = [];
  for (let i = 0; i < 109 && secteursFat.length < nbSecteursFat; i++) secteursFat.push(octets.readUInt32LE(76 + i * 4));
  while (secteursFat.length < nbSecteursFat && secteurDifat < FIN) {
    const base = decalage(secteurDifat);
    const parSecteur = tailleSecteur / 4 - 1;
    for (let i = 0; i < parSecteur && secteursFat.length < nbSecteursFat; i++) secteursFat.push(octets.readUInt32LE(base + i * 4));
    secteurDifat = octets.readUInt32LE(base + parSecteur * 4);
  }
  /** @type {number[]} */
  const fat = [];
  for (const s of secteursFat) for (let i = 0; i < tailleSecteur / 4; i++) fat.push(octets.readUInt32LE(decalage(s) + i * 4));
  const chaine = (/** @type {number} */ debut, /** @type {number[]} */ table) => {
    /** @type {number[]} */
    const suite = [];
    for (let s = debut; s < FIN; s = table[s]) {
      if (suite.length > table.length) throw new Error('classeur XLS : chaîne de secteurs en boucle');
      suite.push(s);
    }
    return suite;
  };
  const lire = (/** @type {number} */ debut) =>
    Buffer.concat(chaine(debut, fat).map((s) => octets.subarray(decalage(s), decalage(s) + tailleSecteur)));
  const repertoire = lire(premierRepertoire);
  const entrees = [];
  for (let o = 0; o + 128 <= repertoire.length; o += 128) {
    const longueurNom = repertoire.readUInt16LE(o + 64);
    entrees.push({
      nom: repertoire.subarray(o, o + Math.max(0, longueurNom - 2)).toString('utf16le'),
      type: repertoire[o + 66],
      debut: repertoire.readUInt32LE(o + 116),
      taille: repertoire.readUInt32LE(o + 120),
    });
  }
  const classeur = entrees.find((e) => e.type === 2 && (e.nom === 'Workbook' || e.nom === 'Book'));
  if (!classeur) throw new Error('classeur XLS : flux Workbook absent');
  if (classeur.taille >= seuilMini) return lire(classeur.debut).subarray(0, classeur.taille);
  const racine = entrees.find((e) => e.type === 5);
  if (!racine) throw new Error('classeur XLS : entrée racine absente');
  const miniFlux = lire(racine.debut);
  /** @type {number[]} */
  const miniFat = [];
  if (premierMiniFat < FIN) {
    const brut = lire(premierMiniFat);
    for (let i = 0; i + 4 <= brut.length; i += 4) miniFat.push(brut.readUInt32LE(i));
  }
  return Buffer.concat(chaine(classeur.debut, miniFat).map((s) => miniFlux.subarray(s * tailleMini, (s + 1) * tailleMini))).subarray(
    0,
    classeur.taille,
  );
}

/**
 * Table des chaînes partagées (enregistrement SST et ses CONTINUE) : une chaîne peut continuer d'un enregistrement à
 * l'autre, l'octet d'options étant alors répété au début de la suite.
 * @param {Buffer[]} morceaux
 */
function chainesPartagees(morceaux) {
  /** @type {string[]} */
  const chaines = [];
  let m = 0;
  let o = 8;
  const total = morceaux[0].readUInt32LE(4);
  const avancer = () => {
    if (o >= morceaux[m].length) {
      m++;
      o = 0;
    }
  };
  const lireOctets = (/** @type {number} */ n) => {
    /** @type {Buffer[]} */
    const parts = [];
    while (n > 0) {
      avancer();
      const k = Math.min(n, morceaux[m].length - o);
      parts.push(morceaux[m].subarray(o, o + k));
      o += k;
      n -= k;
    }
    return Buffer.concat(parts);
  };
  for (let i = 0; i < total; i++) {
    const cch = lireOctets(2).readUInt16LE(0);
    let options = lireOctets(1)[0];
    const runs = options & 0x08 ? lireOctets(2).readUInt16LE(0) : 0;
    const ext = options & 0x04 ? lireOctets(4).readUInt32LE(0) : 0;
    let texte = '';
    for (let reste = cch; reste > 0; ) {
      if (o >= morceaux[m].length) {
        m++;
        options = morceaux[m][0];
        o = 1;
      }
      const large = options & 0x01;
      const k = Math.min(reste, Math.floor((morceaux[m].length - o) / (large ? 2 : 1)));
      const brut = morceaux[m].subarray(o, o + k * (large ? 2 : 1));
      texte += large ? brut.toString('utf16le') : brut.toString('latin1');
      o += brut.length;
      reste -= k;
    }
    lireOctets(runs * 4 + ext);
    chaines.push(texte);
  }
  return chaines;
}

/**
 * Cellules de la première feuille d'un classeur XLS (BIFF8), ligne par ligne : textes (LABELSST, LABEL) et nombres
 * (NUMBER, RK). Assez pour les listes de la nomenclature NAF de l'INSEE ; ni formules ni dates.
 * @param {Buffer} octets
 * @returns {(string | number | undefined)[][]}
 */
export function lireXls(octets) {
  const flux = fluxDuClasseur(octets);
  /** @type {{ type: number, donnees: Buffer }[]} */
  const enregistrements = [];
  for (let o = 0; o + 4 <= flux.length; ) {
    const longueur = flux.readUInt16LE(o + 2);
    enregistrements.push({ type: flux.readUInt16LE(o), donnees: flux.subarray(o + 4, o + 4 + longueur) });
    o += 4 + longueur;
  }
  /** @type {string[]} */
  let sst = [];
  const iSst = enregistrements.findIndex((e) => e.type === 0x00fc);
  if (iSst >= 0) {
    const morceaux = [enregistrements[iSst].donnees];
    for (let j = iSst + 1; enregistrements[j]?.type === 0x003c; j++) morceaux.push(enregistrements[j].donnees);
    sst = chainesPartagees(morceaux);
  }
  const bofs = enregistrements.flatMap((e, i) => (e.type === 0x0809 ? [i] : []));
  /** @type {(string | number | undefined)[][]} */
  const lignes = [];
  const poser = (/** @type {number} */ r, /** @type {number} */ c, /** @type {string | number} */ valeur) => {
    (lignes[r] ??= [])[c] = valeur;
  };
  for (let i = bofs[1] ?? 0; i < enregistrements.length && enregistrements[i].type !== 0x000a; i++) {
    const { type, donnees: d } = enregistrements[i];
    if (type === 0x00fd) poser(d.readUInt16LE(0), d.readUInt16LE(2), sst[d.readUInt32LE(6)]);
    else if (type === 0x0204) {
      const cch = d.readUInt16LE(6);
      const texte = d[8] & 1 ? d.subarray(9, 9 + cch * 2).toString('utf16le') : d.subarray(9, 9 + cch).toString('latin1');
      poser(d.readUInt16LE(0), d.readUInt16LE(2), texte);
    } else if (type === 0x0203) poser(d.readUInt16LE(0), d.readUInt16LE(2), d.readDoubleLE(6));
    else if (type === 0x027e) {
      const rk = d.readInt32LE(6);
      const brut = Buffer.alloc(8);
      brut.writeInt32LE(rk & 0xfffffffc, 4);
      let n = rk & 2 ? rk >> 2 : brut.readDoubleLE(0);
      if (rk & 1) n /= 100;
      poser(d.readUInt16LE(0), d.readUInt16LE(2), n);
    }
  }
  return Array.from(lignes, (l) => l ?? []);
}

// ------------------------------------------------------------
// Entrées-sorties : client HTTP (cache, cadence, plafond), nomenclature, ressource, tirage
// ------------------------------------------------------------

class PlafondDeRequetes extends Error {}

const pause = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Client HTTP : réponses gardées dans le dossier de cache (une relance ne refait aucune requête faite), une requête au
 * plus toutes les `intervalleMs` millisecondes, `maxRequetes` requêtes réseau au plus, hôtes autorisés seulement.
 * @param {{ cache: string, maxRequetes: number, intervalleMs: number }} reglages
 */
function creerClient({ cache, maxRequetes, intervalleMs }) {
  let reseau = 0;
  let depuisCache = 0;
  let derniere = 0;
  mkdirSync(cache, { recursive: true });
  /**
   * @param {string} adresse
   * @param {{ binaire?: boolean }} [options]
   * @returns {Promise<any>}
   */
  async function obtenir(adresse, { binaire = false } = {}) {
    if (!hoteAutorise(adresse)) throw new Error(`hôte refusé : ${adresse}`);
    const fichier = join(cache, `${createHash('sha256').update(adresse).digest('hex').slice(0, 40)}.json`);
    if (existsSync(fichier)) {
      depuisCache++;
      const { corps } = JSON.parse(readFileSync(fichier, 'utf8'));
      return binaire ? Buffer.from(corps, 'base64') : JSON.parse(corps);
    }
    for (let essai = 0; ; essai++) {
      if (reseau >= maxRequetes) throw new PlafondDeRequetes(`plafond de ${maxRequetes} requêtes réseau atteint`);
      const attente = derniere + intervalleMs - Date.now();
      if (attente > 0) await pause(attente);
      derniere = Date.now();
      reseau++;
      const reponse = await fetch(adresse, {
        headers: { accept: binaire ? '*/*' : 'application/json', 'user-agent': 'opco-mobile/calibrer-suggestions-naf' },
      });
      if (reponse.ok) {
        const brut = binaire ? Buffer.from(await reponse.arrayBuffer()) : await reponse.text();
        const corps = binaire ? /** @type {Buffer} */ (brut).toString('base64') : /** @type {string} */ (brut);
        writeFileSync(fichier, JSON.stringify({ adresse, date: new Date().toISOString(), corps }));
        return binaire ? brut : JSON.parse(/** @type {string} */ (brut));
      }
      if ((reponse.status === 429 || reponse.status >= 500) && essai < 3) {
        await pause(2000 * 2 ** essai);
        continue;
      }
      throw new Error(`HTTP ${reponse.status} pour ${adresse}`);
    }
  }
  return { obtenir, compteurs: () => ({ reseau, depuisCache }) };
}

/**
 * Nomenclature NAF rév. 2 (INSEE) : sous-classes et libellés de tous les niveaux.
 * @param {{ obtenir: (adresse: string, options?: { binaire?: boolean }) => Promise<any> }} client
 */
async function lireNomenclature(client) {
  /** @type {Map<string, string>} */
  const libelles = new Map();
  /** @type {string[]} */
  const sousClasses = [];
  for (const niveau of [2, 3, 4, 5]) {
    const octets = await client.obtenir(`${NOMENCLATURE_INSEE}/naf2008_liste_n${niveau}.xls`, { binaire: true });
    for (const [brut, libelle] of lireXls(octets)) {
      const code = typeof brut === 'number' && niveau === 2 ? String(brut).padStart(2, '0') : String(brut ?? '').trim();
      const forme = [/^\d{2}$/, /^\d{2}\.\d$/, /^\d{2}\.\d{2}$/, /^\d{2}\.\d{2}[A-Z]$/][niveau - 2];
      if (!forme.test(code) || typeof libelle !== 'string') continue;
      libelles.set(code, libelle.trim());
      if (niveau === 5) sousClasses.push(code);
    }
  }
  if (sousClasses.length < 700) throw new Error(`nomenclature NAF incomplète : ${sousClasses.length} sous-classes lues`);
  return { libelles, sousClasses };
}

/**
 * Ressource principale (CSV) la plus récente de la Table SIRET-OPCO, ou celle demandée.
 * @param {{ obtenir: (adresse: string) => Promise<any> }} client
 * @param {string | null} demandee
 */
async function choisirRessource(client, demandee) {
  const jeu = await client.obtenir(API_JEU_DE_DONNEES);
  const ressources = (jeu.resources ?? []).filter(
    (/** @type {any} */ r) => (demandee ? r.id === demandee : r.type === 'main' && String(r.format).toLowerCase() === 'csv'),
  );
  ressources.sort((/** @type {any} */ a, /** @type {any} */ b) => parCode(String(b.last_modified), String(a.last_modified)));
  const r = ressources[0];
  if (!r) throw new Error(demandee ? `ressource ${demandee} absente du jeu de données` : 'aucune ressource CSV principale');
  return { id: String(r.id), titre: String(r.title), miseAJour: String(r.last_modified).slice(0, 10), licence: String(jeu.license) };
}

/**
 * Cadres de tirage : les candidats regroupés par population (même liste de sous-classes), étiquetés par le plus court.
 * @param {string[]} candidats
 * @param {string[]} sousClasses
 */
function cadresDeTirage(candidats, sousClasses) {
  /** @type {Map<string, { cadre: string, prefixes: string[], sousClasses: string[] }>} */
  const parPopulation = new Map();
  for (const p of [...candidats].sort(parCode)) {
    const liste = sousClasses.filter((s) => s.startsWith(p));
    if (liste.length === 0) throw new Error(`préfixe ${p} absent de la nomenclature NAF rév. 2`);
    const cle = liste.join(',');
    const existant = parPopulation.get(cle);
    if (existant) existant.prefixes.push(p);
    else parPopulation.set(cle, { cadre: p, prefixes: [p], sousClasses: liste });
  }
  return [...parPopulation.values()].sort((a, b) => parCode(a.cadre, b.cadre));
}

/**
 * Tirage d'un cadre : pages au hasard dans chaque strate (quotas, report d'une strate trop petite sur l'autre), 6 unités
 * au plus par page, siège joint à la Table SIRET-OPCO.
 * @param {{ client: { obtenir: (adresse: string) => Promise<any> }, ressource: string, graine: number }} contexte
 * @param {{ cadre: string, sousClasses: string[] }} cadre
 */
async function tirerCadre({ client, ressource, graine }, { cadre, sousClasses }) {
  const hasard = generateur(empreinte(`${graine}:${cadre}`));
  /** @type {Set<string>} */
  const vus = new Set();
  /** @type {Observation[]} */
  const observations = [];
  const exclus = { public: 0, sansSiege: 0, horsCadre: 0, absent: 0, opcoNul: 0, /** @type {string[]} */ opcoInconnu: [] };
  const adresse = (/** @type {readonly string[]} */ tranches, /** @type {number} */ page) =>
    `${API_RECHERCHE}?activite_principale=${sousClasses.join(',')}&etat_administratif=A` +
    `&tranche_effectif_salarie=${tranches.join(',')}&per_page=${PAR_PAGE}&page=${page}&minimal=true&include=siege`;
  const etats = STRATES.map((strate) => ({ strate, /** @type {number[] | null} */ pages: null, suivante: 0, comptes: 0 }));

  const tirer = async (/** @type {(typeof etats)[number]} */ etat, /** @type {number} */ besoin) => {
    if (etat.pages === null) {
      const premiere = await client.obtenir(adresse(etat.strate.tranches, 1));
      const total = Math.min(Number(premiere.total_pages) || 0, PAGES_ACCESSIBLES);
      etat.pages = melanger(Array.from({ length: total }, (_, i) => i + 1), hasard);
    }
    let comptes = 0;
    while (comptes < besoin && etat.suivante < etat.pages.length) {
      const page = etat.pages[etat.suivante++];
      const reponse = await client.obtenir(adresse(etat.strate.tranches, page));
      let examinees = 0;
      for (const u of melanger(reponse.results ?? [], hasard)) {
        if (comptes >= besoin || examinees >= UNITES_PAR_PAGE) break;
        if (!u?.siren || vus.has(u.siren)) continue;
        vus.add(u.siren);
        examinees++;
        const naf = String(u.activite_principale ?? '');
        if (String(u.nature_juridique ?? '').startsWith('7')) {
          exclus.public++;
          continue;
        }
        if (!naf.startsWith(cadre)) {
          exclus.horsCadre++;
          continue;
        }
        const siret = String(u.siege?.siret ?? '');
        if (!/^\d{14}$/.test(siret)) {
          exclus.sansSiege++;
          continue;
        }
        const ligne = await client.obtenir(`${API_TABULAIRE}/${ressource}/data/?SIRET__exact=${siret}`);
        const valeur = ligne.data?.[0]?.OPCO_PROPRIETAIRE;
        if (!ligne.data?.length) exclus.absent++;
        else if (valeur == null || String(valeur).trim() === '') exclus.opcoNul++;
        else {
          const opco = opcoDepuisTable(valeur);
          if (!opco) exclus.opcoInconnu.push(String(valeur));
          else {
            observations.push({ cadre, siret, naf, opco });
            comptes++;
          }
        }
      }
    }
    etat.comptes += comptes;
    return comptes;
  };

  const [petites, grandes] = etats;
  const total = STRATES.reduce((s, x) => s + x.quota, 0);
  await tirer(petites, petites.strate.quota);
  await tirer(grandes, total - petites.comptes);
  if (petites.comptes + grandes.comptes < total) await tirer(petites, total - petites.comptes - grandes.comptes);
  return { observations, exclus, parStrate: etats.map((e) => ({ strate: e.strate.nom, comptes: e.comptes })) };
}

// ------------------------------------------------------------
// Rapport
// ------------------------------------------------------------

/**
 * Rapport Markdown du calibrage (fonction pure).
 * @param {{
 *   date: string, graine: number, ressource: { id: string, titre: string, miseAJour: string, licence: string },
 *   requetes: { reseau: number, depuisCache: number }, interrompu: string | null, cadresTires: number, cadresTotal: number,
 *   perimetre: string,
 *   exclus: { public: number, sansSiege: number, horsCadre: number, absent: number, opcoNul: number, opcoInconnu: string[] },
 *   observations: number, resultat: ReturnType<typeof agregerSuggestions>, comparaison: ReturnType<typeof comparerAvecTable>,
 *   libelles: Map<string, string>,
 * }} d
 */
export function rapportMarkdown(d) {
  const nb = (/** @type {number} */ x) => new Intl.NumberFormat('fr-FR').format(x);
  const virgule = (/** @type {number | null | undefined} */ x) => (x == null ? '' : x.toFixed(2).replace('.', ','));
  const lignes = [
    '# Calibrage des suggestions d\'OPCO par code NAF',
    '',
    `- Date : ${d.date} ; graine ${d.graine}.`,
    `- Table SIRET-OPCO : ressource ${d.ressource.titre} (${d.ressource.id}), mise à jour le ${d.ressource.miseAJour}, licence ${d.ressource.licence}.`,
    `- Requêtes : ${nb(d.requetes.reseau)} au réseau, ${nb(d.requetes.depuisCache)} lues dans le cache.`,
    `- Cadres de tirage : ${d.cadresTires} sur ${d.cadresTotal}${d.interrompu ? ` ; tirage interrompu : ${d.interrompu} (relancer avec le même cache pour reprendre)` : ''}.`,
    `- Employeurs comptés : ${nb(d.observations)} ; écartés : ${d.exclus.public} employeurs de droit public (7xxx), ${d.exclus.absent} SIRET absents de la table, ${d.exclus.opcoNul} OPCO nuls, ${d.exclus.sansSiege} sans SIRET de siège, ${d.exclus.horsCadre} hors du cadre, ${d.exclus.opcoInconnu.length} OPCO inconnus${d.exclus.opcoInconnu.length ? ` (${[...new Set(d.exclus.opcoInconnu)].join(', ')})` : ''}.`,
    '',
    '## Préfixes mesurés',
    '',
    '| Préfixe | Intitulé | Employeurs | OPCO le plus fréquent | Part | Décision |',
    '|---|---|---|---|---|---|',
    ...d.resultat.decisions.map(
      (x) =>
        `| ${x.prefixe} | ${d.libelles.get(x.prefixe) ?? ''} | ${x.n} | ${x.opco ?? ''} | ${virgule(x.part)} | ${x.retenu ? 'retenu' : x.motif} |`,
    ),
    '',
    '## Écarts avec naf-suggestions.json',
    '',
    `- Périmètre de la comparaison : ${d.perimetre}.`,
    `- Entrées inchangées (même OPCO, part à moins de 0,05 près) : ${d.comparaison.inchangees}.`,
    `- Ajoutées : ${d.comparaison.ajoutees.map((e) => `${e.prefixe} (${e.opco}, ${virgule(e.part)}, ${e.effectif_etablissements})`).join(' ; ') || 'aucune'}.`,
    `- Retirées : ${d.comparaison.retirees.map((e) => `${e.prefixe} (${e.opco})`).join(' ; ') || 'aucune'}.`,
    `- OPCO changé : ${d.comparaison.opcoChange.map((e) => `${e.prefixe} (${e.avant} puis ${e.apres})`).join(' ; ') || 'aucun'}.`,
    `- Part changée d'au moins 0,05 : ${d.comparaison.partChange.map((e) => `${e.prefixe} (${virgule(e.avant)} sur ${e.nAvant ?? '?'}, puis ${virgule(e.apres)} sur ${e.nApres ?? '?'})`).join(' ; ') || 'aucune'}.`,
    '',
    '## À déclarer dans packages/core/tests/naf-suggestions.test.ts',
    '',
    `- Exceptions (OPCO différent de celui du préfixe parent retenu) : ${d.resultat.exceptions.map((e) => `${e.prefixe} (${e.opco}, sous ${e.parent} : ${e.opcoParent})`).join(' ; ') || 'aucune'}.`,
    `- Marges faibles (part de 0,60 à 0,70) : ${d.resultat.margesFaibles.join(', ') || 'aucune'}.`,
    `- Nombre de préfixes retenus : ${d.resultat.entrees.length}.`,
    '',
  ];
  return lignes.join('\n');
}

// ------------------------------------------------------------
// Ligne de commande
// ------------------------------------------------------------

const AIDE = `Calibrage des suggestions d'OPCO par code NAF (spécification, section 5.5).

Usage : node scripts/calibrer-suggestions-naf.mjs --cache <dossier hors du dépôt> [options]

  --cache <dossier>       réponses gardées (reprise d'une exécution interrompue) ; obligatoire, hors du dépôt
  --graine <entier>       graine du tirage (${GRAINE_PAR_DEFAUT} par défaut) : même graine et même cache, même résultat
  --prefixes <liste>      préfixes candidats séparés par des virgules (par défaut : ceux de naf-suggestions.json et leurs
                          ancêtres, soit 179 préfixes et 138 cadres de tirage)
  --max-requetes <n>      plafond de requêtes réseau (${MAX_REQUETES_PAR_DEFAUT} par défaut ; le cache ne compte pas)
  --ressource <id>        ressource data.gouv.fr de la Table SIRET-OPCO (par défaut : la plus récente)
  --sortie <fichier>      JSON au format de naf-suggestions.json (par défaut : <cache>/suggestions-naf.json)
  --rapport <fichier>     rapport Markdown (par défaut : <cache>/rapport-calibrage.md)
  --help                  cette aide

Requêtes : de l'ordre de 6 500 pour la liste par défaut, 300 ms au moins entre deux (moins de 4 par seconde), soit une
heure et demie environ ; une cinquantaine par préfixe pour une liste courte. Hôtes : www.insee.fr, www.data.gouv.fr,
tabular-api.data.gouv.fr, recherche-entreprises.api.gouv.fr ; jamais api.francecompetences.fr.
À relancer à chaque mise à jour de la Table SIRET-OPCO sur data.gouv.fr. Le script n'écrit jamais dans le dépôt :
reporter à la main dans naf-suggestions.json les changements retenus, puis lancer les tests du cœur.`;

/**
 * @param {string[]} argv
 */
function lireOptions(argv) {
  const options = {
    aide: false,
    /** @type {string | null} */ cache: null,
    graine: GRAINE_PAR_DEFAUT,
    /** @type {string[] | null} */ prefixes: null,
    maxRequetes: MAX_REQUETES_PAR_DEFAUT,
    /** @type {string | null} */ ressource: null,
    /** @type {string | null} */ sortie: null,
    /** @type {string | null} */ rapport: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const nom = argv[i];
    const valeur = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new Error(`valeur manquante après ${nom}`);
      return v;
    };
    if (nom === '--help' || nom === '-h') options.aide = true;
    else if (nom === '--cache') options.cache = valeur();
    else if (nom === '--graine') options.graine = Number.parseInt(valeur(), 10);
    else if (nom === '--prefixes') options.prefixes = valeur().split(',').map((p) => p.trim().toUpperCase()).filter(Boolean);
    else if (nom === '--max-requetes') options.maxRequetes = Number.parseInt(valeur(), 10);
    else if (nom === '--ressource') options.ressource = valeur();
    else if (nom === '--sortie') options.sortie = valeur();
    else if (nom === '--rapport') options.rapport = valeur();
    else throw new Error(`option inconnue : ${nom}`);
  }
  if (!Number.isInteger(options.graine)) throw new Error('--graine attend un entier');
  if (!Number.isInteger(options.maxRequetes) || options.maxRequetes < 0) throw new Error('--max-requetes attend un entier positif');
  for (const p of options.prefixes ?? []) {
    if (!/^\d{2}(\.\d|\.\d{2}|\.\d{2}[A-Z])?$/.test(p)) throw new Error(`préfixe NAF mal formé : ${p}`);
  }
  return options;
}

/**
 * @param {string[]} argv
 * @returns {Promise<number>} code de sortie
 */
async function principal(argv) {
  const options = lireOptions(argv);
  if (options.aide) {
    console.log(AIDE);
    return 0;
  }
  if (!options.cache) throw new Error('--cache <dossier hors du dépôt> est obligatoire (voir --help)');
  const cache = resolve(options.cache);
  const sortie = resolve(options.sortie ?? join(cache, 'suggestions-naf.json'));
  const rapport = resolve(options.rapport ?? join(cache, 'rapport-calibrage.md'));
  for (const [nom, chemin] of [['--cache', cache], ['--sortie', sortie], ['--rapport', rapport]]) {
    if (estDansLeDepot(chemin)) throw new Error(`${nom} doit désigner un emplacement hors du dépôt : ${chemin}`);
  }

  const client = creerClient({ cache, maxRequetes: options.maxRequetes, intervalleMs: INTERVALLE_MS });
  const nomenclature = await lireNomenclature(client);
  const ressource = await choisirRessource(client, options.ressource);
  /** @type {{ prefixe: string, opco: string, part: number | null, effectif_etablissements?: number | null }[]} */
  const actuelles = JSON.parse(readFileSync(TABLE_ACTUELLE, 'utf8'));
  const candidats =
    options.prefixes ??
    [...new Set(actuelles.flatMap((e) => prefixesDe(e.prefixe)))].filter((p) => nomenclature.sousClasses.some((s) => s.startsWith(p)));
  const cadres = cadresDeTirage(candidats, nomenclature.sousClasses);
  console.log(`${candidats.length} préfixes candidats, ${cadres.length} cadres de tirage ; ressource ${ressource.titre} du ${ressource.miseAJour}.`);

  /** @type {Observation[]} */
  const observations = [];
  const exclus = { public: 0, sansSiege: 0, horsCadre: 0, absent: 0, opcoNul: 0, /** @type {string[]} */ opcoInconnu: [] };
  /** @type {string | null} */
  let interrompu = null;
  let cadresTires = 0;
  for (const cadre of cadres) {
    try {
      const r = await tirerCadre({ client, ressource: ressource.id, graine: options.graine }, cadre);
      observations.push(...r.observations);
      exclus.public += r.exclus.public;
      exclus.sansSiege += r.exclus.sansSiege;
      exclus.horsCadre += r.exclus.horsCadre;
      exclus.absent += r.exclus.absent;
      exclus.opcoNul += r.exclus.opcoNul;
      exclus.opcoInconnu.push(...r.exclus.opcoInconnu);
      cadresTires++;
      const { reseau } = client.compteurs();
      console.log(`${cadre.cadre} : ${r.observations.length} employeurs (${r.parStrate.map((s) => `${s.strate} ${s.comptes}`).join(', ')}) ; ${reseau} requêtes réseau`);
    } catch (erreur) {
      if (!(erreur instanceof PlafondDeRequetes)) throw erreur;
      interrompu = `${erreur.message} pendant le cadre ${cadre.cadre}`;
      break;
    }
  }

  const resultat = agregerSuggestions(observations, { prefixes: candidats });
  const entrees = resultat.entrees.map((e) => ({ ...e, libelle: nomenclature.libelles.get(e.prefixe) ?? '', source: SOURCE_TABLE_SIRET_OPCO }));
  // Liste de préfixes donnée : la comparaison porte sur les seules entrées actuelles qui en font partie.
  const comparaison = comparerAvecTable(
    resultat.entrees,
    options.prefixes ? actuelles.filter((e) => candidats.includes(e.prefixe)) : actuelles,
  );
  mkdirSync(dirname(sortie), { recursive: true });
  mkdirSync(dirname(rapport), { recursive: true });
  writeFileSync(sortie, `${JSON.stringify(entrees, null, 2)}\n`);
  writeFileSync(
    rapport,
    rapportMarkdown({
      date: new Date().toISOString().slice(0, 10),
      graine: options.graine,
      ressource,
      requetes: client.compteurs(),
      interrompu,
      cadresTires,
      cadresTotal: cadres.length,
      perimetre: options.prefixes ? `préfixes demandés seulement (${candidats.join(', ')})` : 'table entière',
      exclus,
      observations: observations.length,
      resultat,
      comparaison,
      libelles: nomenclature.libelles,
    }),
  );
  const { reseau, depuisCache } = client.compteurs();
  console.log(
    `${resultat.entrees.length} préfixes retenus ; ${reseau} requêtes réseau, ${depuisCache} lues dans le cache.` +
      `${interrompu ? ` Tirage interrompu (${interrompu}).` : ''}\nJSON : ${sortie}\nRapport : ${rapport}`,
  );
  return 0;
}

const lance = process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (lance) {
  principal(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (erreur) => {
      console.error(`Erreur : ${erreur instanceof Error ? erreur.message : String(erreur)}`);
      process.exitCode = 1;
    },
  );
}
