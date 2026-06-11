// ============================================================
// SCRAPE — récupération du texte lisible des pages financement OPCO.
//
// - Respecte robots.txt (User-agent: * et notre bot).
// - User-Agent identifiable : OPCO-Funding-Bot/1.0.
// - Throttle global entre requêtes réseau.
// - En dry-run : AUCUN accès réseau. Le contenu vient d'un cache local
//   (backend/cache/<slug>.txt) s'il existe, sinon d'un texte factice.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { sleep } from './util';
import type { OpcoSource, ScrapeResult, ScrapedPage } from './types';

export const USER_AGENT = 'OPCO-Funding-Bot/1.0 (+https://github.com/opco-mobile; veille tarifaire formation)';

export interface ScrapeOptions {
  /** true = aucun réseau, contenu simulé / cache local. */
  dryRun: boolean;
  /** Délai minimal entre deux requêtes réseau (défaut 2000 ms). */
  throttleMs?: number;
  /** Dossier de cache local pour le dry-run. */
  cacheDir?: string;
  fetchImpl?: typeof fetch;
}

// --- robots.txt -------------------------------------------------------------

const robotsCache = new Map<string, string[]>();

/**
 * Parse minimal de robots.txt : retourne la liste des préfixes Disallow
 * applicables à notre bot (sections `User-agent: *` et `User-agent: OPCO-Funding-Bot`).
 */
export function parseRobots(robotsTxt: string): string[] {
  const disallowed: string[] = [];
  let applies = false;
  for (const rawLine of robotsTxt.split('\n')) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const [keyRaw, ...rest] = line.split(':');
    const key = keyRaw.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      applies = value === '*' || value.toLowerCase().startsWith('opco-funding-bot');
    } else if (applies && key === 'disallow' && value) {
      disallowed.push(value);
    }
  }
  return disallowed;
}

async function isAllowedByRobots(url: string, fetchImpl: typeof fetch): Promise<boolean> {
  const { origin, pathname } = new URL(url);
  if (!robotsCache.has(origin)) {
    try {
      const res = await fetchImpl(`${origin}/robots.txt`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(10_000),
      });
      robotsCache.set(origin, res.ok ? parseRobots(await res.text()) : []);
    } catch {
      // robots.txt inaccessible : on considère autorisé (comportement standard).
      robotsCache.set(origin, []);
    }
  }
  const disallowed = robotsCache.get(origin) ?? [];
  return !disallowed.some((prefix) => pathname.startsWith(prefix));
}

// --- Extraction texte -------------------------------------------------------

/** HTML -> texte lisible (sans script/style/nav), espaces normalisés. */
export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, nav, footer, header, iframe, svg').remove();
  const text = $('body').text() || $.root().text();
  return text.replace(/[ \t\r]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}

// --- Throttle global --------------------------------------------------------

let lastRequestAt = 0;

async function throttle(throttleMs: number): Promise<void> {
  const wait = lastRequestAt + throttleMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

// --- API principale ---------------------------------------------------------

/**
 * Récupère le contenu texte des pages sources d'un OPCO.
 * En dry-run : aucun réseau (cache local ou texte factice).
 */
export async function scrapeOpco(
  slug: string,
  sources: OpcoSource,
  opts: ScrapeOptions,
): Promise<ScrapeResult> {
  if (opts.dryRun) {
    return scrapeDry(slug, sources, opts.cacheDir);
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  const throttleMs = opts.throttleMs ?? 2000;
  const pages: ScrapedPage[] = [];

  for (const url of sources.scrape_urls) {
    // Les PDF ne sont pas parsés par ce scraper minimal — on les saute proprement.
    if (url.toLowerCase().endsWith('.pdf')) {
      console.warn(`[scrape] ${slug}: PDF ignoré (non parsé) : ${url}`);
      continue;
    }
    if (!(await isAllowedByRobots(url, fetchImpl))) {
      console.warn(`[scrape] ${slug}: interdit par robots.txt : ${url}`);
      continue;
    }
    await throttle(throttleMs);
    try {
      const res = await fetchImpl(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        console.warn(`[scrape] ${slug}: HTTP ${res.status} sur ${url}`);
        continue;
      }
      pages.push({ url, text: htmlToText(await res.text()) });
    } catch (err) {
      console.warn(`[scrape] ${slug}: échec fetch ${url}: ${(err as Error).message}`);
    }
  }

  return { slug, pages, simulated: false };
}

function scrapeDry(slug: string, sources: OpcoSource, cacheDir?: string): ScrapeResult {
  if (cacheDir) {
    const cached = path.join(cacheDir, `${slug}.txt`);
    if (fs.existsSync(cached)) {
      return {
        slug,
        pages: [{ url: sources.url_finance_page, text: fs.readFileSync(cached, 'utf-8') }],
        simulated: true,
      };
    }
  }
  return {
    slug,
    pages: [
      {
        url: sources.url_finance_page,
        text: `[DRY-RUN] Contenu simulé pour ${sources.name} (${slug}). Aucune requête réseau effectuée.`,
      },
    ],
    simulated: true,
  };
}
