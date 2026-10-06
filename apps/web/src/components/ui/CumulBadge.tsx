import type { DispositifComplementaire } from '@opco/core';
import { CUMUL_LABELS } from '@/lib/format';

type Cumul = DispositifComplementaire['cumul'];

const CUMUL_STYLES: Record<Cumul, string> = {
  hors_budget: 'text-valid bg-valid-soft',
  additif: 'text-cobalt bg-cobalt-soft',
  alternatif: 'text-ink-soft bg-paper-deep',
};

/** Tampon de la règle de cumul d'un dispositif avec l'enveloppe du plan de développement des compétences. */
export function CumulBadge({ cumul }: { cumul: Cumul }) {
  return <span className={`stamp ${CUMUL_STYLES[cumul]}`}>{CUMUL_LABELS[cumul]}</span>;
}
