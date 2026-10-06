import { ALERTE_OPCO_LABELS } from '@opco/core';
import type { AlerteOpco } from '@opco/core';
import { dateFr } from '@/lib/format';

interface AlertesOpcoProps {
  alertes: AlerteOpco[];
  /** Nom court de l'OPCO qui publie les alertes. */
  opcoName: string;
  /** Niveau du titre selon l'endroit où l'encadré s'insère dans la page. */
  headingLevel?: 2 | 3;
}

/**
 * Encadré des alertes publiées par un OPCO (fonds épuisés, critères modifiés...) :
 * type, branche, extrait de la source entre guillemets, lien vers la source et date de vérification.
 * Partagé par les fiches OPCO et l'écran de résultats.
 */
export function AlertesOpco({ alertes, opcoName, headingLevel = 3 }: AlertesOpcoProps) {
  if (alertes.length === 0) return null;
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <section className="rounded border border-alert/40 bg-alert-soft p-5">
      <Heading className="font-display font-bold text-alert">Alertes publiées par {opcoName}</Heading>
      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
        Informations reprises des pages officielles de l&apos;OPCO. Elles peuvent changer à tout moment :
        vérifiez la source avant de déposer une demande.
      </p>
      <ul className="mt-4 space-y-4">
        {alertes.map((a, i) => (
          <li key={`${a.type}-${a.branche}-${i}`} className="border-t border-alert/20 pt-3 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="stamp text-alert">{ALERTE_OPCO_LABELS[a.type] ?? a.type}</span>
              <span className="text-sm font-semibold text-ink">{a.branche}</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              «&nbsp;{a.extrait}&nbsp;»
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
              <a
                href={a.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-cobalt underline hover:text-navy"
              >
                Voir la source ↗
              </a>
              <span>vérifié le {dateFr(a.verifie_le)}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
