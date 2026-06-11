// ============================================================
// PUBLISH — écrit le dataset versionné au format EXACT du seed
// (datasets/v1.json, latest.json, manifest.json) :
//
//   v<N>.json / latest.json = { version, generatedAt(ISO), opcos: [...] }
//   manifest.json           = { version, generatedAt, sha256, opcoCount, changelog }
//
// Le sha256 correspond au contenu d'OCTETS EXACT de latest.json
// (relu depuis le disque après écriture — c'est ce que l'app vérifie).
//
// En dry-run, outDir = datasets/_drafts pour ne JAMAIS écraser le seed.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { DatasetManifestSchema } from '@opco/core';
import type { OpcoData } from '@opco/core';
import type { PublishResult } from './types';
import { sha256Hex } from './util';

export interface PublishOptions {
  /** Dossier contenant le manifest courant (référence de version) : datasets/. */
  datasetsDir: string;
  /** Dossier de sortie. Défaut = datasetsDir. Dry-run : datasets/_drafts. */
  outDir?: string;
  /** Lignes de changelog lisibles pour le manifest. */
  changelog: string[];
  /** Horodatage injectable (tests). */
  generatedAt?: string;
}

/** Lit la version courante depuis datasets/manifest.json (0 si absent). */
export function readCurrentVersion(datasetsDir: string): number {
  const manifestPath = path.join(datasetsDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return 0;
  const parsed = DatasetManifestSchema.safeParse(JSON.parse(fs.readFileSync(manifestPath, 'utf-8')));
  return parsed.success ? parsed.data.version : 0;
}

export function publishDataset(opcos: OpcoData[], opts: PublishOptions): PublishResult {
  const outDir = opts.outDir ?? opts.datasetsDir;
  fs.mkdirSync(outDir, { recursive: true });

  const version = readCurrentVersion(opts.datasetsDir) + 1;
  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  // Format EXACT du seed : JSON.stringify(dataset, null, 2), utf-8.
  const dataset = { version, generatedAt, opcos };
  const datasetJson = JSON.stringify(dataset, null, 2);

  const versionedPath = path.join(outDir, `v${version}.json`);
  const latestPath = path.join(outDir, 'latest.json');
  fs.writeFileSync(versionedPath, datasetJson, 'utf-8');
  fs.writeFileSync(latestPath, datasetJson, 'utf-8');

  // sha256 du contenu d'octets EXACT de latest.json, relu depuis le disque.
  const latestBytes = fs.readFileSync(latestPath);
  const sha256 = sha256Hex(latestBytes);

  const manifest = {
    version,
    generatedAt,
    sha256,
    opcoCount: opcos.length,
    changelog: opts.changelog.length > 0 ? opts.changelog : ['Aucun changement détecté lors de cette vérification'],
  };
  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  return {
    version,
    generatedAt,
    sha256,
    opcoCount: opcos.length,
    files: { versioned: versionedPath, latest: latestPath, manifest: manifestPath },
  };
}

/** Re-vérifie après coup que manifest.sha256 == sha256(latest.json sur disque). */
export function verifyPublishedSha(outDir: string): { ok: boolean; expected: string; actual: string } {
  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf-8'));
  const actual = sha256Hex(fs.readFileSync(path.join(outDir, 'latest.json')));
  return { ok: manifest.sha256 === actual, expected: manifest.sha256, actual };
}
