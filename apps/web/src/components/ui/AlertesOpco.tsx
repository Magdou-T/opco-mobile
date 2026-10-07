import { ALERTE_OPCO_LABELS } from '@opco/core';
import type { AlerteOpco } from '@opco/core';
import { dateFr, texteFr } from '@/lib/format';
import { Icon } from './Icon';

interface AlertesOpcoProps {
  alertes: AlerteOpco[];
  /** Nom court de l'OPCO qui publie les alertes. */
  opcoName: string;
  /** Niveau du titre selon l'endroit où l'encadré s'insère dans la page. */
  headingLevel?: 2 | 3;
  /** Ancre de l'encadré (l'écran de résultats y renvoie depuis son bandeau de synthèse). */
  id?: string;
}

/**
 * Encadré des alertes publiées par un OPCO (fonds épuisés, critères modifiés...) :
 * type, branche, extrait de la source entre guillemets, lien vers la source et date de vérification.
 * Partagé par les fiches OPCO et l'écran de résultats. L'extrait reste mot pour mot ; les autres textes de données
 * (branche) passent par `texteFr` pour afficher leurs dates au format JJ/MM/AAAA.
 * Couleurs : titre et étiquette rouges sur rouge doux (5,62:1), texte doux (7,28:1), lien orange foncé (4,54:1).
 */
export function AlertesOpco({ alertes, opcoName, headingLevel = 3, id }: AlertesOpcoProps) {
  if (alertes.length === 0) return null;
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <section id={id} className="rounded-2xl border border-rouge/25 bg-rouge-soft p-5 break-words break-inside-avoid sm:p-6">
      <Heading className="font-display text-lg leading-snug font-bold text-rouge">Alertes publiées par {opcoName}</Heading>
      <p className="mt-1 text-sm leading-relaxed text-texte-doux">
        Informations reprises des pages officielles de l&apos;OPCO. Elles peuvent changer à tout moment&nbsp;:
        vérifiez la source avant de déposer une demande.
      </p>
      <ul className="mt-4 space-y-4">
        {alertes.map((a, i) => (
          <li key={`${a.type}-${a.branche}-${i}`} className="border-t border-rouge/20 pt-3 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="stamp text-rouge">{ALERTE_OPCO_LABELS[a.type] ?? a.type}</span>
              <span className="text-sm font-semibold text-texte">{texteFr(a.branche)}</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-texte-doux">
              «&nbsp;{a.extrait}&nbsp;»
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texte-doux">
              <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="lien inline-flex items-center gap-1">
                Voir la source
                <Icon name="lien-externe" className="size-3.5" />
                <span className="sr-only"> (nouvel onglet)</span>
              </a>
              <span>vérifié le {dateFr(a.verifie_le)}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
