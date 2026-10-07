import type { PortailRegional } from '@opco/core';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { typo } from '@/lib/format';
import { enRegion } from '@/lib/resultats';

/**
 * Portails officiels de la région de l'entreprise (« pour aller plus loin ») : les aides locales et l'offre de formation
 * que le catalogue ne recense pas. Chaque lien s'ouvre dans un nouvel onglet, annoncé aux lecteurs d'écran.
 */
export function PortailsRegionaux({ portail }: { portail: PortailRegional }) {
  return (
    <section aria-labelledby="titre-portails" className="apparition">
      <Card tone="teintee" padding="lg" className="break-inside-avoid">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="grid size-11 shrink-0 place-items-center rounded-2xl bg-turquoise-soft text-turquoise-deep"
          >
            <Icon name="repere" className="size-[22px]" />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 id="titre-portails" className="text-xl leading-tight font-bold tracking-[-0.02em] text-texte sm:text-2xl">
              Pour aller plus loin {enRegion(portail.nom_region)}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-texte-doux">
              Aides locales (département, commune, intercommunalité) et offre de formation&nbsp;: consultez ces portails
              officiels.
            </p>
          </div>
        </div>
        <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
          {portail.liens.map((l) => (
            <li key={l.url}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex min-h-12 items-center gap-3 rounded-2xl border border-filet bg-white px-4 py-3 text-sm leading-snug font-medium text-texte transition-[border-color,box-shadow] hover:border-orange/45 hover:shadow-douce"
              >
                <Icon name="lien-externe" className="size-[18px] shrink-0 text-orange-deep" />
                <span className="min-w-0">{typo(l.titre)}</span>
                <span className="sr-only"> (nouvel onglet)</span>
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
