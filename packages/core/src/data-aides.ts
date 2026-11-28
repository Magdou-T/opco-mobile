// ============================================================
// Catalogue d'aides embarqué (fallback hors-ligne / source de secours).
// Module à part de data.ts : c'est le plus lourd des jeux de données embarqués (environ 135 Ko gzip dans un bundle
// navigateur) et seul le calcul des aides en a besoin. data.ts le réexporte, donc l'API publique ne change pas ; un
// composant qui n'importe que les barèmes des OPCO ou la table IDCC n'embarque pas ce catalogue, tant que le paquet
// reste « sideEffects: false » (package.json) et que ce module ne contient que des constantes.
//   - le catalogue d'aides, nationales puis régionales (data/aides) ;
//   - les portails régionaux officiels (data/aides).
// ============================================================

import aidesNationalesData from '../data/aides/nationales.json';
import aidesRegionalesData from '../data/aides/regions.json';
import portailsData from '../data/aides/portails.json';
import type { Aide, FichierAides, FichierPortails, PortailRegional } from './aides/types';

/** Catalogue d'aides embarqué : nationales puis régionales. */
export const EMBEDDED_AIDES: Aide[] = [
  ...(aidesNationalesData as unknown as FichierAides).aides,
  ...(aidesRegionalesData as unknown as FichierAides).aides,
];

/** Portails officiels par région (« pour aller plus loin »). */
export const EMBEDDED_PORTAILS: PortailRegional[] = (portailsData as unknown as FichierPortails).portails;
