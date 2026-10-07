import type { CertitudeOpco } from '@opco/core';

/**
 * Libellé et couleurs de chaque niveau de certitude de l'identification de l'OPCO. Les couples texte / fond respectent
 * le contraste AA (texte vert sur fond blanc ou fond vert plein, jamais sur le vert pâle).
 */
const CERTITUDES: Record<CertitudeOpco, { label: string; className: string }> = {
  confirme: { label: 'Confirmé par la source officielle', className: 'border-valid bg-valid text-white' },
  fiable: { label: 'Identifié via la convention collective', className: 'border-valid bg-white text-valid' },
  a_confirmer: { label: 'À confirmer', className: 'border-marker bg-marker text-ink' },
  inconnu: { label: 'Non identifié', className: 'border-rule bg-paper-deep text-ink-soft' },
};

/** Pastille du niveau de certitude de l'OPCO identifié (le texte porte le sens, la couleur ne fait que l'appuyer). */
export function CertitudeBadge({ certitude }: { certitude: CertitudeOpco }) {
  const { label, className } = CERTITUDES[certitude];
  return (
    <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold leading-tight ${className}`}>
      {label}
    </span>
  );
}
