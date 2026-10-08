import type { Confidence } from '@opco/core';
import { INSECABLE } from '@/lib/insecable';

interface ConfidenceBadgeProps {
  confidence: Confidence;
}

/**
 * Étiquette de fiabilité d'un montant (classe `.stamp` : pilule, point et bord dans la couleur du texte). Exact en
 * turquoise foncé sur turquoise doux (5,65:1), Estimé en rouge sur rouge doux (5,62:1), Selon branche en texte doux sur
 * lin-soft (7,68:1). Le texte porte le sens ; l'infobulle le précise.
 */
const CONFIDENCE_CONFIG: Record<Confidence, { label: string; className: string; title: string }> = {
  exact: {
    label: 'Exact',
    className: 'text-turquoise-deep bg-turquoise-soft',
    title: 'Montant publié tel quel par le financeur, la source est jointe',
  },
  estimated: {
    label: 'Estimé',
    className: 'text-rouge bg-rouge-soft',
    title: 'Montant reconstitué à partir de documents officiels partiels',
  },
  depends_on_branche: {
    label: 'Selon branche',
    className: 'text-texte-doux bg-lin-soft',
    title: `Pas de barème unique publié${INSECABLE}: le montant dépend de votre branche ou de votre dossier`,
  },
};

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const config = CONFIDENCE_CONFIG[confidence];
  return (
    <span className={`stamp ${config.className}`} title={config.title}>
      {config.label}
    </span>
  );
}
