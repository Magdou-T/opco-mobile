// ============================================================
// Synchronisation du dataset OPCO.
//
// Stratégie « jamais d'état cassé » :
// 1. Au premier lancement, l'app fonctionne sur EMBEDDED_OPCOS (embarqué).
// 2. syncDataset() télécharge <base>/manifest.json ; si la version publiée
//    est plus récente que la version active, télécharge <base>/latest.json,
//    vérifie le SHA-256 annoncé par le manifest, valide via validateDataset()
//    (schéma Zod + bornes de cohérence) puis stocke en AsyncStorage.
// 3. Toute erreur (réseau, hash, validation) laisse le cache courant intact.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import {
  EMBEDDED_OPCOS,
  validateDataset,
  DatasetManifestSchema,
  type Dataset,
  type DatasetManifest,
  type OpcoData,
} from '@opco/core';

// --- Constantes -------------------------------------------------------------

/**
 * Date de génération des données embarquées (generatedAt du dataset embarqué).
 * À mettre à jour quand packages/core/data est régénéré.
 */
export const EMBEDDED_DATASET_DATE = '2026-06-11';

/** Version logique du dataset embarqué (les datasets publiés commencent à > 1). */
export const EMBEDDED_DATASET_VERSION = 1;

/**
 * URL de base où sont publiés manifest.json + latest.json.
 * Configurable via app.json → expo.extra.datasetBaseUrl.
 * Pour tester en local : servir `opco-mobile/datasets/` (ex. `npx serve datasets`)
 * et pointer datasetBaseUrl sur http://<ip-machine>:3000.
 */
export const DATASET_BASE_URL: string =
  (Constants.expoConfig?.extra?.datasetBaseUrl as string | undefined) ??
  'https://example.invalid/opco-dataset';

const STORAGE_KEY_DATASET = '@opco/dataset';
const STORAGE_KEY_META = '@opco/dataset-meta';

// --- Types ------------------------------------------------------------------

export interface DatasetMeta {
  version: number;
  generatedAt: string;
  /** Date ISO de la dernière synchronisation réussie. */
  syncedAt: string;
}

export interface ActiveDataset {
  opcos: OpcoData[];
  /** 'cache' = dataset téléchargé et validé ; 'embedded' = données embarquées. */
  source: 'cache' | 'embedded';
  version: number;
  /** Date de génération du dataset actif (pour « Données à jour au … »). */
  generatedAt: string;
}

export type SyncStatus = 'updated' | 'up-to-date' | 'network-error' | 'invalid-data';

export interface SyncResult {
  status: SyncStatus;
  message: string;
  /** Version du dataset actif après la tentative de sync. */
  activeVersion: number;
}

// --- Lecture du cache -------------------------------------------------------

async function readCachedDataset(): Promise<Dataset | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_DATASET);
    if (!raw) return null;
    // Re-validation à chaque lecture : un cache corrompu est ignoré.
    return validateDataset(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Retourne le dataset actif : le cache téléchargé s'il existe et est valide,
 * sinon les données embarquées. Ne lève jamais.
 */
export async function getActiveOpcos(): Promise<ActiveDataset> {
  const cached = await readCachedDataset();
  if (cached) {
    return {
      // Le schéma Zod tolère des champs descriptifs plus larges (FreeTextSchema) ;
      // même cast que @opco/core pour ses données embarquées.
      opcos: cached.opcos as unknown as OpcoData[],
      source: 'cache',
      version: cached.version,
      generatedAt: cached.generatedAt,
    };
  }
  return {
    opcos: EMBEDDED_OPCOS,
    source: 'embedded',
    version: EMBEDDED_DATASET_VERSION,
    generatedAt: EMBEDDED_DATASET_DATE,
  };
}

// --- Synchronisation --------------------------------------------------------

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} sur ${url}`);
  }
  return res.json();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} sur ${url}`);
  }
  return res.text();
}

async function sha256Hex(text: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

/**
 * Vérifie s'il existe une mise à jour du dataset et l'installe si elle est
 * intègre (SHA-256) et valide (schéma + bornes). En cas d'échec, le dataset
 * actif (cache ou embarqué) reste inchangé.
 */
export async function syncDataset(baseUrl: string = DATASET_BASE_URL): Promise<SyncResult> {
  const active = await getActiveOpcos();
  const base = baseUrl.replace(/\/+$/, '');

  // 1. Manifest
  let manifest: DatasetManifest;
  try {
    const rawManifest = await fetchJson(`${base}/manifest.json`);
    manifest = DatasetManifestSchema.parse(rawManifest);
  } catch (err) {
    return {
      status: 'network-error',
      message:
        'Impossible de récupérer le manifest des mises à jour. ' +
        'Vérifiez votre connexion — les données actuelles restent utilisées.',
      activeVersion: active.version,
    };
  }

  // 2. Comparaison de versions
  if (manifest.version <= active.version) {
    return {
      status: 'up-to-date',
      message: `Vos données sont déjà à jour (version ${active.version}).`,
      activeVersion: active.version,
    };
  }

  // 3. Téléchargement du dataset complet
  let rawText: string;
  try {
    rawText = await fetchText(`${base}/latest.json`);
  } catch {
    return {
      status: 'network-error',
      message:
        'Le téléchargement du dataset a échoué. Les données actuelles restent utilisées.',
      activeVersion: active.version,
    };
  }

  // 4. Vérification d'intégrité (SHA-256 annoncé par le manifest)
  try {
    const digest = await sha256Hex(rawText);
    if (digest.toLowerCase() !== manifest.sha256.toLowerCase()) {
      return {
        status: 'invalid-data',
        message:
          'Le dataset téléchargé est corrompu (empreinte SHA-256 invalide). ' +
          'Mise à jour ignorée, les données actuelles restent utilisées.',
        activeVersion: active.version,
      };
    }
  } catch {
    return {
      status: 'invalid-data',
      message: "Impossible de vérifier l'intégrité du dataset. Mise à jour ignorée.",
      activeVersion: active.version,
    };
  }

  // 5. Validation structurelle (schéma Zod + bornes + nombre d'OPCO)
  let dataset: Dataset;
  try {
    dataset = validateDataset(JSON.parse(rawText));
  } catch (err) {
    return {
      status: 'invalid-data',
      message:
        'Le dataset téléchargé est invalide et a été rejeté. ' +
        'Les données actuelles restent utilisées.',
      activeVersion: active.version,
    };
  }

  // 6. Stockage atomique du nouveau dataset
  const meta: DatasetMeta = {
    version: dataset.version,
    generatedAt: dataset.generatedAt,
    syncedAt: new Date().toISOString(),
  };
  try {
    await AsyncStorage.multiSet([
      [STORAGE_KEY_DATASET, JSON.stringify(dataset)],
      [STORAGE_KEY_META, JSON.stringify(meta)],
    ]);
  } catch {
    return {
      status: 'invalid-data',
      message: "Échec de l'enregistrement local du dataset. Mise à jour ignorée.",
      activeVersion: active.version,
    };
  }

  return {
    status: 'updated',
    message: `Données mises à jour : version ${dataset.version} (générée le ${formatDateFr(
      dataset.generatedAt,
    )}).`,
    activeVersion: dataset.version,
  };
}

/** Supprime le dataset téléchargé (retour aux données embarquées). */
export async function clearCachedDataset(): Promise<void> {
  await AsyncStorage.multiRemove([STORAGE_KEY_DATASET, STORAGE_KEY_META]);
}

// --- Helpers ----------------------------------------------------------------

/** Formate une date (ISO ou YYYY-MM-DD) en JJ/MM/AAAA. */
export function formatDateFr(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
