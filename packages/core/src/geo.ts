// ============================================================
// Référentiel géographique INSEE (code officiel géographique) :
// 18 régions et 101 départements, pour cibler les aides régionales.
// ============================================================

import type { CodeRegion } from './types';

export const REGIONS: Record<CodeRegion, string> = {
  '84': 'Auvergne-Rhône-Alpes',
  '27': 'Bourgogne-Franche-Comté',
  '53': 'Bretagne',
  '24': 'Centre-Val de Loire',
  '94': 'Corse',
  '44': 'Grand Est',
  '32': 'Hauts-de-France',
  '11': 'Île-de-France',
  '28': 'Normandie',
  '75': 'Nouvelle-Aquitaine',
  '76': 'Occitanie',
  '52': 'Pays de la Loire',
  '93': "Provence-Alpes-Côte d'Azur",
  '01': 'Guadeloupe',
  '02': 'Martinique',
  '03': 'Guyane',
  '04': 'La Réunion',
  '06': 'Mayotte',
};

/** Ordre des sélecteurs : métropole puis outre-mer, alphabétique (liste figée, indépendante d'Intl). */
const ORDRE_REGIONS: CodeRegion[] = [
  '84', '27', '53', '24', '94', '44', '32', '11', '28', '75', '76', '52', '93',
  '01', '03', '04', '02', '06',
];

export const REGIONS_TRIEES: { code: CodeRegion; nom: string }[] = ORDRE_REGIONS.map((code) => ({
  code,
  nom: REGIONS[code],
}));

/** Département → région (COG). Corse : 2A / 2B ; outre-mer : 971 à 976. */
export const DEPARTEMENT_REGION: Record<string, CodeRegion> = {
  '01': '84', '02': '32', '03': '84', '04': '93', '05': '93', '06': '93', '07': '84', '08': '44', '09': '76',
  '10': '44', '11': '76', '12': '76', '13': '93', '14': '28', '15': '84', '16': '75', '17': '75', '18': '24',
  '19': '75', '2A': '94', '2B': '94', '21': '27', '22': '53', '23': '75', '24': '75', '25': '27', '26': '84',
  '27': '28', '28': '24', '29': '53', '30': '76', '31': '76', '32': '76', '33': '75', '34': '76', '35': '53',
  '36': '24', '37': '24', '38': '84', '39': '27', '40': '75', '41': '24', '42': '84', '43': '84', '44': '52',
  '45': '24', '46': '76', '47': '75', '48': '76', '49': '52', '50': '28', '51': '44', '52': '44', '53': '52',
  '54': '44', '55': '44', '56': '53', '57': '44', '58': '27', '59': '32', '60': '32', '61': '28', '62': '32',
  '63': '84', '64': '75', '65': '76', '66': '76', '67': '44', '68': '44', '69': '84', '70': '27', '71': '27',
  '72': '52', '73': '84', '74': '84', '75': '11', '76': '28', '77': '11', '78': '11', '79': '75', '80': '32',
  '81': '76', '82': '76', '83': '93', '84': '93', '85': '52', '86': '75', '87': '75', '88': '44', '89': '27',
  '90': '27', '91': '11', '92': '11', '93': '11', '94': '11', '95': '11',
  '971': '01', '972': '02', '973': '03', '974': '04', '976': '06',
};

export function estCodeRegion(code: string | null | undefined): code is CodeRegion {
  return code != null && Object.prototype.hasOwnProperty.call(REGIONS, code);
}

export function regionDuDepartement(departement: string | null | undefined): CodeRegion | null {
  if (!departement) return null;
  return DEPARTEMENT_REGION[departement.trim().toUpperCase()] ?? null;
}

/** Département d'un code postal français (null : format invalide, Monaco, collectivités hors région). */
export function departementDuCodePostal(codePostal: string | null | undefined): string | null {
  const cp = (codePostal ?? '').trim();
  if (!/^\d{5}$/.test(cp)) return null;
  if (cp.startsWith('97')) {
    const dep = cp.slice(0, 3);
    return dep in DEPARTEMENT_REGION ? dep : null;
  }
  if (cp.startsWith('20')) return Number(cp) < 20200 ? '2A' : '2B';
  const dep = cp.slice(0, 2);
  return dep in DEPARTEMENT_REGION ? dep : null;
}
