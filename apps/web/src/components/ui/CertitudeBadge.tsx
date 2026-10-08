import type { CertitudeOpco } from '@opco/core';
import { Etiquette } from '@/components/ui/Etiquette';
import type { EtiquetteTone } from '@/components/ui/Etiquette';

/**
 * Libellé et ton de chaque niveau de certitude de l'identification de l'OPCO, en `Etiquette` (DESIGN.md) :
 * confirmé et fiable en turquoise foncé (5,65:1 sur turquoise doux), à confirmer en or à texte foncé (15,92:1),
 * non identifié en neutre (7,68:1). Le texte porte le sens, la couleur ne fait que l'appuyer.
 */
const CERTITUDES: Record<CertitudeOpco, { label: string; tone: EtiquetteTone }> = {
  confirme: { label: 'Confirmé par la source officielle', tone: 'turquoise' },
  fiable: { label: 'Identifié via la convention collective', tone: 'turquoise' },
  a_confirmer: { label: 'À confirmer', tone: 'or' },
  inconnu: { label: 'Non identifié', tone: 'neutre' },
};

/** Étiquette du niveau de certitude de l'OPCO identifié. */
export function CertitudeBadge({ certitude }: { certitude: CertitudeOpco }) {
  const { label, tone } = CERTITUDES[certitude];
  return <Etiquette tone={tone}>{label}</Etiquette>;
}
