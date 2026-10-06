import type { OpcoData } from '@/lib/types';

import afdasData from './afdas.json';
import atlasData from './atlas.json';
import aktoData from './akto.json';
import opcoMobilitesData from './opco-mobilites.json';
import opcommerceData from './opcommerce.json';
import opco2iData from './opco2i.json';
import constructysData from './constructys.json';
import opcoEpData from './opco-ep.json';
import ocapiatData from './ocapiat.json';
import opcoSanteData from './opco-sante.json';
import uniformationData from './uniformation.json';

// Cast all imports to OpcoData (JSON imports are typed loosely)
export const ALL_OPCOS: OpcoData[] = [
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

// Map slug → OpcoData for quick lookup
export const OPCO_BY_SLUG: Record<string, OpcoData> = Object.fromEntries(
  ALL_OPCOS.map((o) => [o.slug, o]),
);

// List of OPCO names + slugs for dropdowns
export const OPCO_LIST = ALL_OPCOS.map((o) => ({
  slug: o.slug,
  name: o.name,
  secteurs: o.secteurs,
}));

export function getOpcoBySlug(slug: string): OpcoData | undefined {
  return OPCO_BY_SLUG[slug];
}
