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

/** Un montant que la mutation peut changer : renseigné et positif (ni la hausse de 12 % ni le doublement ne changent 0). */
const modifiable = (valeur: number | null | undefined): boolean => (valeur ?? 0) > 0;

/**
 * Premier OPCO dont cout_horaire_inter est modifiable (hausse de 12 %) et premier dont budget_annuel_max l'est
 * (doublement), dans l'ordre des données ; null quand aucun OPCO n'a de valeur. Un montant à 0 ne compte pas : la
 * mutation ne le changerait pas et le dry-run ne traverserait plus le garde-fou de variation.
 */
export function choisirCiblesDryRun(opcos: OpcoData[]): CiblesDryRun {
  return {
    hausse: opcos.find((o) => modifiable(o.cout_horaire_inter.value))?.slug ?? null,
    doublement: opcos.find((o) => modifiable(o.budget_annuel_max.value))?.slug ?? null,
  };
}
