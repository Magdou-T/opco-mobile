'use client';

import type { Confidence } from '@opco/core';

interface ConfidenceBadgeProps {
  confidence: Confidence;
}

const CONFIDENCE_CONFIG: Record<Confidence, { label: string; className: string; title: string }> = {
  exact: {
    label: 'Exact',
    className: 'text-valid bg-valid-soft',
    title: 'Montant publié tel quel par l’OPCO, la source est jointe',
  },
  estimated: {
    label: 'Estimé',
    className: 'text-alert bg-alert-soft',
    title: 'Montant reconstitué à partir de documents officiels partiels',
  },
  depends_on_branche: {
    label: 'Selon branche',
    className: 'text-ink-soft bg-paper-deep',
    title: 'Pas de barème national publié : dépend de votre convention collective',
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
