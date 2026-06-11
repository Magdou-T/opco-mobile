// ============================================================
// Dataset OPCO embarqué (fallback hors-ligne / source de secours)
// Agrège les 11 fichiers JSON sourcés en structures prêtes à l'emploi.
// ============================================================

import type { OpcoData } from './types';

import afdasData from '../data/opcos/afdas.json';
import atlasData from '../data/opcos/atlas.json';
import aktoData from '../data/opcos/akto.json';
import opcoMobilitesData from '../data/opcos/opco-mobilites.json';
import opcommerceData from '../data/opcos/opcommerce.json';
import opco2iData from '../data/opcos/opco2i.json';
import constructysData from '../data/opcos/constructys.json';
import opcoEpData from '../data/opcos/opco-ep.json';
import ocapiatData from '../data/opcos/ocapiat.json';
import opcoSanteData from '../data/opcos/opco-sante.json';
import uniformationData from '../data/opcos/uniformation.json';

/** Dataset embarqué : les 11 OPCO. Sert de secours si la sync réseau échoue. */
export const EMBEDDED_OPCOS: OpcoData[] = [
  afdasData as unknown as OpcoData,
  atlasData as unknown as OpcoData,
  aktoData as unknown as OpcoData,
  opcoMobilitesData as unknown as OpcoData,
  opcommerceData as unknown as OpcoData,
  opco2iData as unknown as OpcoData,
  constructysData as unknown as OpcoData,
  opcoEpData as unknown as OpcoData,
  ocapiatData as unknown as OpcoData,
  opcoSanteData as unknown as OpcoData,
  uniformationData as unknown as OpcoData,
];

/** Construit un index slug → OpcoData à partir de n'importe quelle liste. */
export function indexBySlug(opcos: OpcoData[]): Record<string, OpcoData> {
  return Object.fromEntries(opcos.map((o) => [o.slug, o]));
}

/** Liste compacte pour les menus déroulants. */
export function toOpcoList(
  opcos: OpcoData[],
): { slug: string; name: string; secteurs: string }[] {
  return opcos.map((o) => ({ slug: o.slug, name: o.name, secteurs: o.secteurs }));
}

// Helpers prêts à l'emploi sur le dataset embarqué
export const EMBEDDED_OPCO_BY_SLUG = indexBySlug(EMBEDDED_OPCOS);
export const EMBEDDED_OPCO_LIST = toOpcoList(EMBEDDED_OPCOS);

export function getEmbeddedOpcoBySlug(slug: string): OpcoData | undefined {
  return EMBEDDED_OPCO_BY_SLUG[slug];
}
