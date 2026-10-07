// ============================================================
// Contrôle des liens sources (OPCO, aides, portails, table IDCC, suggestions NAF).
// Usage : node --import tsx src/check-sources.ts   (ou : npm run check-sources)
// Écrit backend/out/liens.json et backend/out/liens.md. Aucune clé d'API requise.
//
// Règles de conduite :
//   - une simple requête GET par adresse (le corps de la réponse est annulé dès les en-têtes) ;
//   - au plus deux requêtes simultanées vers un même site, six au total ;
//   - jamais d'appel à api.francecompetences.fr : les tables et l'API de France compétences ne sont réutilisables
//     qu'avec une licence (art. R. 6123-35 du code du travail). Ces adresses, et toute redirection qui y mène,
//     sont signalées « ignorées » sans être contactées. Une page web ordinaire du même organisme est vérifiée normalement.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMBEDDED_AIDES, EMBEDDED_IDCC, EMBEDDED_NAF, EMBEDDED_OPCOS, EMBEDDED_PORTAILS } from '@opco/core';
import type { Aide, IdccTable, OpcoData, PortailRegional, SuggestionNaf } from '@opco/core';

/**
 * ok : réponse 2xx ou 3xx ;
 * a_verifier : refus anti-robots (401, 403, 429, 503), connexion coupée par le serveur ou réponse hors protocole HTTP ;
 * casse : toute autre erreur (404, 5xx, nom d'hôte inconnu, délai dépassé, certificat refusé) ;
 * ignore : adresse non contactée (licence France compétences).
 */
export type EtatLien = 'ok' | 'a_verifier' | 'casse' | 'ignore';

export interface ResultatLien {
  url: string;
  statut: number | null;
  etat: EtatLien;
  /** Erreur réseau (statut null) : nom d'hôte inconnu, certificat, délai dépassé… */
  erreur?: string;
  /** Adresse non contactée : raison. */
  motif?: string;
  /** Adresse atteinte après redirection(s), quand elle diffère de `url`. */
  urlFinale?: string;
  /** Où la donnée est utilisée (au plus quelques usages sont repris dans le rapport Markdown). */
  utilisePar: string[];
}

export interface OptionsVerification {
  /** Requêtes simultanées au total (défaut 6). */
  concurrence?: number;
  /** Requêtes simultanées vers un même site (défaut 2). */
  parHote?: number;
  fetchImpl?: typeof fetch;
  /** Délai maximal d'une tentative, redirections comprises (défaut 20 s). */
  timeoutMs?: number;
  /** Nombre d'essais par adresse : une erreur réseau ou une réponse 5xx est retentée (défaut 2). */
  tentatives?: number;
  /** Pause avant un nouvel essai (défaut 1,5 s). */
  pauseMs?: number;
}

// --- Collecte ---------------------------------------------------------------

/** Une valeur qui est tout entière une adresse web. */
const URL_ENTIERE = /^https?:\/\/\S+$/;
/** Une adresse web écrite dans une phrase (notes, conditions) : elle s'arrête à un espace, une parenthèse ou un guillemet. */
const URL_DANS_TEXTE = /https?:\/\/[^\s<>"'«»)\]]+/g;
const PONCTUATION_FINALE = /[.,;:!?]+$/;

function urlsDeChaine(texte: string): string[] {
  const brut = texte.trim();
  if (URL_ENTIERE.test(brut)) return [brut];
  return (brut.match(URL_DANS_TEXTE) ?? []).map((u) => u.replace(PONCTUATION_FINALE, '')).filter((u) => /^https?:\/\/[^/\s]/.test(u));
}

/** Repère d'un élément de tableau dans un chemin : son identifiant (aide, variante, dispositif), son slug, sa taille ou sa région, sinon son rang. */
function repere(element: unknown, rang: number): string {
  if (element !== null && typeof element === 'object') {
    const { id, slug, taille, region } = element as Record<string, unknown>;
    for (const cle of [id, slug, taille, region]) {
      if (typeof cle === 'string' && cle) return cle;
    }
  }
  return String(rang);
}

/** Parcourt toute la valeur : chaque chaîne qui est une adresse web, ou qui en contient, est déclarée avec son chemin. */
function parcourir(valeur: unknown, chemin: string, declarer: (url: string, usage: string) => void): void {
  if (typeof valeur === 'string') {
    // `.source_url` est omis du chemin : « opco:akto.cout_horaire_inter » désigne la source de ce champ.
    const usage = chemin.replace(/\.source_url$/, '');
    for (const url of urlsDeChaine(valeur)) declarer(url, usage);
  } else if (Array.isArray(valeur)) {
    valeur.forEach((element, rang) => parcourir(element, `${chemin}[${repere(element, rang)}]`, declarer));
  } else if (valeur !== null && typeof valeur === 'object') {
    for (const [cle, v] of Object.entries(valeur)) parcourir(v, `${chemin}.${cle}`, declarer);
  }
}

/**
 * Toutes les adresses web des données (sources des montants, des variantes, des alertes, des dispositifs, des aides,
 * liens des portails, sources de la table IDCC et des suggestions NAF), sans doublon, avec leurs usages.
 * Le parcours est générique : une nouvelle clé d'adresse ajoutée aux données est contrôlée sans modifier ce code.
 */
export function collecterUrls(d: {
  opcos: OpcoData[];
  aides: Aide[];
  portails: PortailRegional[];
  idcc: IdccTable;
  naf?: SuggestionNaf[];
}): Map<string, string[]> {
  const urls = new Map<string, string[]>();
  const declarer = (url: string, usage: string) => {
    const usages = urls.get(url) ?? [];
    if (!usages.includes(usage)) usages.push(usage);
    urls.set(url, usages);
  };
  for (const o of d.opcos) parcourir(o, `opco:${o.slug}`, declarer);
  for (const a of d.aides) parcourir(a, `aide:${a.id}`, declarer);
  for (const p of d.portails) parcourir(p, `portail:${p.region}`, declarer);
  for (const [code, entree] of Object.entries(d.idcc)) parcourir(entree, `idcc:${code}`, declarer);
  for (const n of d.naf ?? []) parcourir(n, `naf:${n.prefixe}`, declarer);
  return urls;
}

// --- Classement -------------------------------------------------------------

/** 401/403/429/503 : protections anti-robots ou limitation, à vérifier à la main. */
export function classerStatut(statut: number | null): Exclude<EtatLien, 'ignore'> {
  if (statut == null) return 'casse';
  if (statut >= 200 && statut < 400) return 'ok';
  if (statut === 401 || statut === 403 || statut === 429 || statut === 503) return 'a_verifier';
  return 'casse';
}

/** Hôtes qu'aucune requête ne doit atteindre, avec la raison affichée dans le rapport. */
const HOTES_IGNORES: Record<string, string> = {
  'api.francecompetences.fr': 'licence France compétences (art. R. 6123-35 du code du travail)',
};

/**
 * Raison pour laquelle une adresse ne doit jamais être contactée, ou null.
 * L'API de France compétences (api.francecompetences.fr) donne accès aux tables de correspondance entre branches,
 * établissements (SIRET) et OPCO : leur réutilisation exige une licence (art. R. 6123-35 du code du travail).
 * Les pages web ordinaires de l'organisme, dont l'outil officiel « Quel est mon OPCO », ne sont pas concernées.
 */
export function motifIgnore(url: string): string | null {
  try {
    return HOTES_IGNORES[new URL(url).hostname.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

// --- Vérification -----------------------------------------------------------

const MAX_REDIRECTIONS = 10;

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function hoteDe(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }
}

/**
 * Le serveur a été joint mais l'échange échoue : connexion coupée (ECONNRESET, typique d'un pare-feu applicatif ou
 * d'une protection anti-robots) ou réponse qui n'est pas du HTTP valide (HTTPParserError, qu'un navigateur tolère).
 * Le lien n'est pas pour autant cassé : il est classé « à vérifier ». Un nom d'hôte inconnu, un délai de connexion
 * dépassé ou un certificat refusé restent des liens cassés.
 */
function serveurJointMaisInexploitable(err: unknown): boolean {
  const cause = ((err ?? {}) as { cause?: { name?: string; code?: string } }).cause;
  return cause?.code === 'ECONNRESET' || cause?.name === 'HTTPParserError' || (cause?.code?.startsWith('HPE_') ?? false);
}

function decrireErreur(err: unknown, timeoutMs: number): string {
  const e = (err ?? {}) as { name?: string; message?: string; cause?: { code?: string; message?: string } };
  if (e.name === 'AbortError') return `délai dépassé (${timeoutMs} ms)`;
  const base = e.message || String(err);
  const cause = e.cause?.code ?? e.cause?.message;
  return cause ? `${base} (${cause})` : base;
}

interface Tentative {
  statut: number | null;
  erreur?: string;
  motif?: string;
  urlFinale?: string;
  /** Serveur joint dont l'échange échoue (connexion coupée, réponse hors protocole) : lien à vérifier, pas cassé. */
  protege?: true;
}

/**
 * Une tentative : GET, redirections suivies une à une (chaque étape est filtrée par motifIgnore, pour ne jamais
 * contacter un hôte interdit), corps annulé dès les en-têtes.
 */
async function tenter(url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<Tentative> {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), timeoutMs);
  try {
    let courante = url;
    for (let saut = 0; saut <= MAX_REDIRECTIONS; saut++) {
      const interdit = saut > 0 ? motifIgnore(courante) : null;
      if (interdit) return { statut: null, motif: `redirection vers ${courante} : ${interdit}` };
      const res = await fetchImpl(courante, {
        method: 'GET',
        redirect: 'manual',
        signal: controleur.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; financement-opco-verification-liens/1.0)',
          Accept: 'text/html,application/pdf;q=0.9,*/*;q=0.8',
        },
      });
      try {
        await res.body?.cancel();
      } catch {
        // corps déjà consommé ou absent
      }
      const suite = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (!suite) return { statut: res.status, urlFinale: courante !== url ? courante : undefined };
      courante = new URL(suite, courante).href;
    }
    return { statut: null, erreur: `plus de ${MAX_REDIRECTIONS} redirections` };
  } catch (err) {
    return { statut: null, erreur: decrireErreur(err, timeoutMs), protege: serveurJointMaisInexploitable(err) || undefined };
  } finally {
    clearTimeout(minuteur);
  }
}

/** Une erreur réseau ou une réponse 5xx est souvent passagère : elle est retentée avant d'être déclarée (sauf un serveur protégé, qui coupe à chaque fois). */
const estPassager = (r: Tentative) => r.motif == null && !r.protege && (r.statut === null || r.statut >= 500);

async function verifierUrl(url: string, fetchImpl: typeof fetch, timeoutMs: number, tentatives: number, pauseMs: number): Promise<Tentative> {
  let r = await tenter(url, fetchImpl, timeoutMs);
  for (let essai = 1; essai < tentatives && estPassager(r); essai++) {
    await pause(pauseMs);
    r = await tenter(url, fetchImpl, timeoutMs);
  }
  return r;
}

export async function verifierUrls(urls: Map<string, string[]>, opts: OptionsVerification = {}): Promise<ResultatLien[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const tentatives = Math.max(1, opts.tentatives ?? 2);
  const pauseMs = opts.pauseMs ?? 1_500;
  const parHote = Math.max(1, opts.parHote ?? 2);
  const concurrence = Math.max(1, opts.concurrence ?? 6);

  const entrees = [...urls.entries()];
  const hotes = entrees.map(([url]) => hoteDe(url));
  const resultats: ResultatLien[] = new Array(entrees.length);
  const file: number[] = [];
  entrees.forEach(([url, usages], i) => {
    const motif = motifIgnore(url);
    if (motif) resultats[i] = { url, statut: null, etat: 'ignore', motif, utilisePar: usages };
    else file.push(i);
  });

  const enCours = new Map<string, number>();
  const travailleur = async () => {
    while (file.length > 0) {
      // Première adresse en attente dont le site n'est pas déjà sollicité au maximum.
      const position = file.findIndex((i) => (enCours.get(hotes[i]) ?? 0) < parHote);
      if (position === -1) {
        await pause(10);
        continue;
      }
      const [i] = file.splice(position, 1);
      const [url, usages] = entrees[i];
      enCours.set(hotes[i], (enCours.get(hotes[i]) ?? 0) + 1);
      try {
        const r = await verifierUrl(url, fetchImpl, timeoutMs, tentatives, pauseMs);
        resultats[i] = r.motif
          ? { url, statut: null, etat: 'ignore', motif: r.motif, utilisePar: usages }
          : { url, statut: r.statut, etat: r.protege ? 'a_verifier' : classerStatut(r.statut), erreur: r.erreur, urlFinale: r.urlFinale, utilisePar: usages };
      } finally {
        enCours.set(hotes[i], (enCours.get(hotes[i]) ?? 1) - 1);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrence }, travailleur));
  return resultats;
}

// --- Rapport ----------------------------------------------------------------

const cellule = (texte: string) => texte.replace(/\|/g, '\\|');

/** Trois premiers usages, puis le nombre des autres : une adresse peut servir à des centaines d'entrées de la table IDCC. */
function usages(r: ResultatLien): string {
  const reste = r.utilisePar.length - 3;
  const premiers = r.utilisePar.slice(0, 3).join(', ');
  return reste > 0 ? `${premiers} (+${reste})` : premiers;
}

const accorder = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

function tableau(entetes: string[], lignes: string[][]): string[] {
  if (lignes.length === 0) return ['Aucun.', ''];
  return [
    `| ${entetes.join(' | ')} |`,
    `|${entetes.map(() => '---').join('|')}|`,
    ...lignes.map((l) => `| ${l.map(cellule).join(' | ')} |`),
    '',
  ];
}

export function rapportMarkdown(resultats: ResultatLien[], date: string): string {
  const parEtat = (etat: EtatLien) => resultats.filter((r) => r.etat === etat);
  const casses = parEtat('casse');
  const aVerifier = parEtat('a_verifier');
  const ignores = parEtat('ignore');
  const ok = parEtat('ok');
  const statutOuErreur = (r: ResultatLien) => String(r.statut ?? r.erreur ?? 'n/a');
  return [
    `# Contrôle des liens sources du ${date}`,
    '',
    `${accorder(resultats.length, 'lien')} : ${ok.length} OK, ${aVerifier.length} à vérifier, ${accorder(casses.length, 'cassé')}, ${accorder(ignores.length, 'ignoré')}.`,
    '',
    '## Liens cassés',
    '',
    ...tableau(['URL', 'Statut', 'Utilisé par'], casses.map((r) => [r.url, statutOuErreur(r), usages(r)])),
    '## À vérifier à la main (protection anti-robots ou limitation)',
    '',
    ...tableau(['URL', 'Statut', 'Utilisé par'], aVerifier.map((r) => [r.url, statutOuErreur(r), usages(r)])),
    '## Liens ignorés (licence France compétences)',
    '',
    "Ces adresses ne sont jamais contactées : les tables et l'API de France compétences ne sont réutilisables qu'avec une licence (art. R. 6123-35 du code du travail).",
    '',
    ...tableau(['URL', 'Motif', 'Utilisé par'], ignores.map((r) => [r.url, r.motif ?? 'n/a', usages(r)])),
  ].join('\n');
}

// --- Exécution --------------------------------------------------------------

async function principal(): Promise<void> {
  const urls = collecterUrls({ opcos: EMBEDDED_OPCOS, aides: EMBEDDED_AIDES, portails: EMBEDDED_PORTAILS, idcc: EMBEDDED_IDCC, naf: EMBEDDED_NAF });
  const sites = new Set([...urls.keys()].map(hoteDe)).size;
  console.log(`${urls.size} liens à vérifier sur ${sites} sites.`);
  const resultats = await verifierUrls(urls);
  const dossier = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'out');
  fs.mkdirSync(dossier, { recursive: true });
  const [annee, mois, jour] = new Date().toISOString().slice(0, 10).split('-');
  fs.writeFileSync(path.join(dossier, 'liens.json'), JSON.stringify(resultats, null, 2), 'utf-8');
  fs.writeFileSync(path.join(dossier, 'liens.md'), rapportMarkdown(resultats, `${jour}/${mois}/${annee}`), 'utf-8');
  const compte = (etat: EtatLien) => resultats.filter((r) => r.etat === etat).length;
  console.log(
    `${resultats.length} liens vérifiés : ${compte('ok')} OK, ${compte('a_verifier')} à vérifier, ${compte('casse')} cassé(s), ${compte('ignore')} ignoré(s). Rapport : ${path.join(dossier, 'liens.md')}`,
  );
  process.exitCode = compte('casse') > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void principal();
}
