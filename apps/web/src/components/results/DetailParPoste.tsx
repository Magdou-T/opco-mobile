'use client';

import { useState } from 'react';
import type { FundingLine, FundingResult } from '@opco/core';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { SourceBadge } from '@/components/ui/SourceBadge';
import { cx } from '@/lib/cx';
import { de, formatEuro, texteMoteur } from '@/lib/format';
import { INSECABLE } from '@/lib/insecable';
import { sansMontantEstime } from '@/lib/resultats';
import { BadgeEstimation } from './BadgeEstimation';
import { TEXTE_SOUPLE } from './classes';

/** En-tête de colonne : Inter 600 en petites majuscules, texte discret (5,35:1 sur blanc, 4,95:1 sur lin-soft). */
const EN_TETE = 'px-4 py-3 text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase sm:px-6';

/** Libellé de la règle d'une ligne sans montant estimé. */
function regleDeLigne(line: FundingLine, opcoName: string): string {
  return line.note ?? `Montant à confirmer auprès ${de(opcoName)}`;
}

/**
 * Tableau « Détail par poste » de l'estimation de l'OPCO (`lignes` : `lignesDuDetail`). Sous 640 px, les colonnes
 * « Demandé », « Reste » et « Source » passent dans la colonne du poste (le tableau tient en deux colonnes : à trois, il
 * débordait de sa carte de 42 px à 320 px et de 3 px à 375 px) ; la règle d'une ligne non chiffrée y est aussi, pour que
 * la colonne étroite « Financé » ne s'allonge pas sur huit lignes. À l'impression, chaque poste et le détail de son calcul
 * restent sur une même page (un `tbody` par poste) et l'en-tête et le pied ne se répètent pas d'une page à l'autre.
 */
export function DetailParPoste({
  result,
  lignes,
  montantConnu,
}: {
  result: FundingResult;
  lignes: FundingLine[];
  /** Un montant est connu (total chiffré ou ligne chiffrée) : sinon les totaux restent « - ». */
  montantConnu: boolean;
}) {
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());
  const { opcoName } = result;

  const toggleLine = (index: number) => {
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-filet px-5 py-4 sm:px-6">
        <h3 className="text-lg leading-snug font-bold text-texte">Détail par poste</h3>
        {lignes.some((l) => l.details?.length) && (
          <p className="text-xs text-texte-discret print:hidden">Ouvrez une ligne pour le calcul complet</p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          {/* À l'impression, l'en-tête et le pied ne se répètent pas en haut et en bas de chaque page (Chrome répète un
              thead et un tfoot : « Total » était imprimé deux fois) : ce sont alors des groupes de lignes ordinaires. */}
          <thead className="bg-lin-soft print:table-row-group">
            <tr>
              <th scope="col" className={cx(EN_TETE, 'text-left')}>
                Poste
              </th>
              <th scope="col" className={cx(EN_TETE, 'hidden text-right sm:table-cell')}>
                Demandé
              </th>
              <th scope="col" className={cx(EN_TETE, 'text-right')}>
                Financé
              </th>
              <th scope="col" className={cx(EN_TETE, 'hidden text-right sm:table-cell')}>
                Reste
              </th>
              <th scope="col" className={cx(EN_TETE, 'hidden text-center sm:table-cell print:hidden')}>
                Source
              </th>
            </tr>
          </thead>
          {/* Un corps de tableau par poste : à l'impression, un poste et le détail de son calcul ne se séparent jamais
              d'une page à l'autre. */}
          {lignes.map((line, i) => {
            const detaillee = !!line.details?.length;
            const ouverte = expandedLines.has(i);
            const sansMontant = sansMontantEstime(line);
            const idDetail = `detail-poste-${line.poste}-${i}`;
            return (
              <tbody
                key={`${line.poste}-${i}`}
                className={cx('divide-y divide-filet print:break-inside-avoid', i > 0 && 'border-t border-filet')}
              >
                <tr
                  data-poste={line.poste}
                  className={cx(
                    'align-top transition-[background-color] hover:bg-vert-clair-soft/50',
                    detaillee && 'cursor-pointer',
                  )}
                  onClick={() => detaillee && toggleLine(i)}
                >
                  <td className="px-4 py-4 sm:px-6">
                    <div className="flex items-start gap-1.5 font-semibold text-texte">
                      {detaillee && (
                        <button
                          type="button"
                          aria-expanded={ouverte}
                          aria-controls={idDetail}
                          aria-label={`Calcul détaillé${INSECABLE}: ${line.label}`}
                          className="-my-1 -ml-1.5 grid size-7 shrink-0 place-items-center rounded-full text-texte-discret hover:text-orange-deep print:hidden"
                        >
                          <Icon
                            name="chevron"
                            className={cx('size-4 transition-transform duration-200', ouverte && 'rotate-90')}
                            strokeWidth={2}
                          />
                        </button>
                      )}
                      <span className={TEXTE_SOUPLE}>{line.label}</span>
                    </div>
                    {/* Une adresse dans une note ne doit pas fixer la largeur de la colonne. Notes et détail du calcul
                        sont écrits par le moteur : texteMoteur (« 17.875 €/h » devient « 17,88 €/h »). */}
                    <div className={cx('space-y-1.5 [overflow-wrap:anywhere]', detaillee && 'sm:pl-6')}>
                      {!sansMontant && line.note && (
                        <p className="mt-1 text-xs leading-relaxed text-texte-discret">{texteMoteur(line.note)}</p>
                      )}
                      {sansMontant && (
                        <p className="mt-1 text-xs leading-relaxed text-texte-doux">
                          {texteMoteur(regleDeLigne(line, opcoName))}
                        </p>
                      )}
                      {line.confidence !== 'exact' && (
                        <div>
                          <BadgeEstimation confidence={line.confidence} opcoName={opcoName} />
                        </div>
                      )}
                      <p className="text-xs text-texte-discret sm:hidden">
                        Demandé&nbsp;: {line.requestedAmount > 0 ? formatEuro(line.requestedAmount) : '-'}
                      </p>
                      <p className="text-xs text-texte-discret sm:hidden">
                        Reste&nbsp;: {!sansMontant && line.remainder > 0 ? formatEuro(line.remainder) : '-'}
                      </p>
                      <div className="sm:hidden print:hidden" onClick={(e) => e.stopPropagation()}>
                        <SourceBadge url={line.sourceUrl} />
                      </div>
                    </div>
                  </td>
                  <td className="amount hidden px-4 py-4 text-right text-texte-doux sm:table-cell sm:px-6">
                    {line.requestedAmount > 0 ? formatEuro(line.requestedAmount) : '-'}
                  </td>
                  <td className="px-4 py-4 text-right whitespace-nowrap sm:px-6">
                    {sansMontant ? (
                      <span className="text-xs text-texte-doux">à confirmer</span>
                    ) : (
                      <span className="amount text-turquoise-deep">{formatEuro(line.fundedAmount)}</span>
                    )}
                  </td>
                  <td className="amount hidden px-4 py-4 text-right whitespace-nowrap text-texte-doux sm:table-cell sm:px-6">
                    {/* Ligne non chiffrée : jamais son coût complet présenté comme un reste. */}
                    {!sansMontant && line.remainder > 0 ? formatEuro(line.remainder) : '-'}
                  </td>
                  <td
                    className="hidden px-4 py-4 text-center sm:table-cell sm:px-6 print:hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SourceBadge url={line.sourceUrl} />
                  </td>
                </tr>
                {/* Le détail du calcul reste dans la page, replié : l'impression le montre toujours. */}
                {detaillee && (
                  <tr id={idDetail} className={ouverte ? undefined : 'hidden print:table-row'}>
                    <td colSpan={5} className="bg-lin-soft/60 px-4 py-4 [overflow-wrap:anywhere] sm:px-6">
                      <p className="text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase">
                        Détail du calcul
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {line.details?.map((detail, j) => (
                          <li key={j} className="flex items-start gap-2.5 text-xs leading-relaxed text-texte-doux">
                            <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-turquoise" />
                            <span>{texteMoteur(detail)}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
          <tfoot className="border-t border-filet bg-lin-soft font-semibold text-texte print:table-row-group">
            <tr>
              <td className="px-4 py-4 sm:px-6">
                Total
                <span className="mt-0.5 block text-xs font-normal text-texte-discret sm:hidden">
                  Reste&nbsp;: {montantConnu && result.totalRemainder > 0 ? formatEuro(result.totalRemainder) : '-'}
                </span>
              </td>
              <td className="amount hidden px-4 py-4 text-right sm:table-cell sm:px-6">
                {formatEuro(result.totalRequested)}
              </td>
              <td className="amount px-4 py-4 text-right whitespace-nowrap text-turquoise-deep sm:px-6">
                {montantConnu ? formatEuro(result.totalFunded) : '-'}
              </td>
              <td className="amount hidden px-4 py-4 text-right whitespace-nowrap sm:table-cell sm:px-6">
                {montantConnu && result.totalRemainder > 0 ? formatEuro(result.totalRemainder) : '-'}
              </td>
              <td className="hidden sm:table-cell print:hidden"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
