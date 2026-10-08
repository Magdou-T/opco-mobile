// ============================================================
// Cibles des mutations contrôlées du dry-run (src/run.ts).
//
// Module sans effet de bord à l'import, à part de run.ts (qui lance le pipeline dès qu'il est chargé) : le choix des
// cibles est ainsi testé (tests/pipeline.test.ts).
// ============================================================

import type { OpcoData } from '@opco/core';

export interface CiblesDryRun {
  hausse: string | null;
  doublement: string | null;
}

/**
 * Premier OPCO dont cout_horaire_inter est renseigné (hausse de 12 %) et premier dont budget_annuel_max l'est
 * (doublement), dans l'ordre des données ; null quand aucun OPCO n'a de valeur.
 */
export function choisirCiblesDryRun(opcos: OpcoData[]): CiblesDryRun {
  return {
    hausse: opcos.find((o) => o.cout_horaire_inter.value != null)?.slug ?? null,
    doublement: opcos.find((o) => o.budget_annuel_max.value != null)?.slug ?? null,
  };
}
