// ============================================================
// Tableau des conventions collectives et de leur OPCO (page « Quel est mon OPCO ? »), calculé au build à partir de la
// table embarquée de @opco/core et de la même fonction que le simulateur (`resoudreOpco`) : le tableau et le simulateur
// donnent toujours la même réponse pour un même IDCC. Module serveur : il importe la table des 956 conventions.
// ============================================================

import { CODES_ECHAPPATOIRES, EMBEDDED_IDCC, EMBEDDED_OPCOS, resoudreOpco } from '@opco/core';
import type { CertitudeOpco } from '@opco/core';

export interface OpcoCite {
  slug: string;
  nom: string;
}

export interface LigneConvention {
  idcc: string;
  titre: string;
  /** OPCO possibles : un seul en général, deux pour une convention partagée selon l'activité, aucun si inconnu. */
  opcos: OpcoCite[];
  certitude: CertitudeOpco;
  /** Convention fusionnée : IDCC de la convention qui la remplace. */
  remplaceePar?: string;
}

const NOMS = new Map(EMBEDDED_OPCOS.map((o) => [o.slug, o.name]));

/** Toutes les conventions de la table, par code croissant, sans les codes « échappatoires » de la DSN. */
export function lignesDesConventions(): LigneConvention[] {
  return Object.values(EMBEDDED_IDCC)
    .filter((e) => !(e.idcc in CODES_ECHAPPATOIRES) && e.statut !== 'echappatoire')
    .sort((a, b) => a.idcc.localeCompare(b.idcc))
    .map((e) => {
      const resolution = resoudreOpco({ idccs: [e.idcc] }, EMBEDDED_IDCC);
      const opcos = resolution.candidats
        .map((c) => ({ slug: c.opcoSlug, nom: NOMS.get(c.opcoSlug) ?? c.opcoSlug }))
        .filter((o, i, liste) => liste.findIndex((x) => x.slug === o.slug) === i);
      return {
        idcc: e.idcc,
        titre: e.titre,
        opcos,
        certitude: resolution.certitude,
        ...(e.statut === 'fusionne' && e.idcc_cible ? { remplaceePar: e.idcc_cible } : {}),
      };
    });
}

/** Nombre de conventions du tableau rattachées à chaque OPCO (une convention partagée compte pour ses deux OPCO). */
export function conventionsParOpco(lignes: readonly LigneConvention[]): Map<string, number> {
  const comptes = new Map<string, number>();
  for (const l of lignes) for (const o of l.opcos) comptes.set(o.slug, (comptes.get(o.slug) ?? 0) + 1);
  return comptes;
}
