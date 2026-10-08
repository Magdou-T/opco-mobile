import type { DispositifComplementaire } from '@opco/core';
import { CUMUL_LABELS } from '@/lib/format';

type Cumul = DispositifComplementaire['cumul'];

/**
 * Couleur de chaque règle de cumul (classe `.stamp`) : turquoise foncé sur turquoise doux (5,65:1), orange foncé sur
 * orange doux (4,63:1), texte doux sur lin-soft (7,68:1).
 */
const CUMUL_STYLES: Record<Cumul, string> = {
  hors_budget: 'text-turquoise-deep bg-turquoise-soft',
  additif: 'text-orange-deep bg-orange-soft',
  alternatif: 'text-texte-doux bg-lin-soft',
};

/** Étiquette de la règle de cumul d'un dispositif avec l'enveloppe du plan de développement des compétences. */
export function CumulBadge({ cumul }: { cumul: Cumul }) {
  return <span className={`stamp ${CUMUL_STYLES[cumul]}`}>{CUMUL_LABELS[cumul]}</span>;
}
