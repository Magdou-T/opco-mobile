'use client';

import { Fragment, useState } from 'react';
import type { DispositifEligible } from '@opco/core';
import { Card } from '@/components/ui/Card';
import { CumulBadge } from '@/components/ui/CumulBadge';
import { Icon } from '@/components/ui/Icon';
import { SourceBadge } from '@/components/ui/SourceBadge';
import { cx } from '@/lib/cx';
import { de, formatEuro, texteDonnees } from '@/lib/format';
import { replierIdcc } from '@/lib/resultats';
import { BadgeEstimation } from './BadgeEstimation';
import { TEXTE_SOUPLE } from './classes';

/** Dispositif dont un montant est calculable pour cette formation (un montant nul n'est pas un montant publié). */
function montantDuDispositif(d: DispositifEligible): number | null {
  return d.montantEstime != null && d.montantEstime > 0 ? d.montantEstime : null;
}

/**
 * Texte des données dont les listes de plus de 6 codes de convention collective sont repliées (« 12 conventions
 * collectives », dépliable) ; dates et typographie à la française hors extraits cités.
 */
function TexteAvecConventions({ texte }: { texte: string }) {
  return (
    <>
      {replierIdcc(texte).map((m, i) =>
        m.genre === 'texte' ? <Fragment key={i}>{texteDonnees(m.valeur)}</Fragment> : <ListeIdcc key={i} codes={m.codes} />,
      )}
    </>
  );
}

function ListeIdcc({ codes }: { codes: string[] }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={ouvert}
        onClick={() => setOuvert((v) => !v)}
        className="inline font-semibold text-orange-deep underline decoration-1 underline-offset-2 print:hidden"
      >
        {codes.length}&nbsp;conventions collectives
      </button>
      {/* À l'impression, la liste reprend sa forme d'origine (« IDCC 0112, … »), sans le bouton. */}
      <span className={cx(ouvert ? 'inline' : 'hidden', 'print:inline')}>
        <span className="print:hidden">&nbsp;: </span>IDCC {codes.join(', ')}
      </span>
    </>
  );
}

/**
 * Financements complémentaires de l'OPCO (dispositifs accessibles à l'entreprise) : étiquette de cumul avec le plan de
 * développement des compétences, montant seulement s'il est calculable pour la formation, conditions (listes de
 * conventions collectives repliées), démarche et source.
 */
export function DispositifsOpco({ dispositifs, opcoName }: { dispositifs: DispositifEligible[]; opcoName: string }) {
  return (
    <Card as="section" aria-labelledby="titre-dispositifs-opco" padding="md">
      <h3 id="titre-dispositifs-opco" className="text-lg leading-snug font-bold text-texte">
        Financements complémentaires {de(opcoName)}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-texte-doux">
        Dispositifs {de(opcoName)}{' '}accessibles à votre entreprise. L&apos;étiquette dit comment chacun se combine
        avec le plan de développement des compétences&nbsp;; un montant n&apos;est donné que s&apos;il est calculable
        pour votre formation.
      </p>
      <ul className="mt-5 space-y-3">
        {dispositifs.map((d) => {
          const montant = montantDuDispositif(d);
          return (
            <li key={d.id} className="rounded-2xl border border-filet bg-lin-soft/50 p-4 break-inside-avoid sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="leading-snug font-semibold text-texte">{texteDonnees(d.nom)}</h4>
                <CumulBadge cumul={d.cumul} />
              </div>
              {montant != null && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="amount text-lg text-turquoise-deep">{formatEuro(montant)}</span>
                  <span className="text-xs text-texte-discret">estimé pour votre formation</span>
                  <BadgeEstimation confidence={d.confidence} opcoName={opcoName} />
                </div>
              )}
              <p className="mt-2 text-sm leading-relaxed text-texte-doux">{texteDonnees(d.description)}</p>
              {d.publics && (
                <p className="mt-1 text-xs leading-relaxed text-texte-discret">
                  Public visé&nbsp;: {texteDonnees(d.publics)}
                </p>
              )}
              {d.conditions.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {d.conditions.map((c, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs leading-relaxed text-texte-doux">
                      <Icon name="coche" className="mt-px size-3.5 shrink-0 text-turquoise-deep" strokeWidth={2} />
                      <span className={TEXTE_SOUPLE}>
                        <TexteAvecConventions texte={c} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {d.demarches && (
                <p className="mt-2 text-sm leading-relaxed text-texte-doux">
                  <span className="font-semibold text-texte">Démarche&nbsp;:</span> {texteDonnees(d.demarches)}
                </p>
              )}
              {d.note && <p className="mt-2 text-xs leading-relaxed text-texte-discret">{texteDonnees(d.note)}</p>}
              <div className="mt-3 print:hidden">
                <SourceBadge url={d.sourceUrl} />
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
