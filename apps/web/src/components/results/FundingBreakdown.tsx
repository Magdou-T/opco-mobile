'use client';

import { useState } from 'react';
import { FundingResult, Confidence } from '@/lib/types';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { SourceBadge } from '@/components/ui/SourceBadge';

interface Props {
  result: FundingResult;
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getOverallConfidence(lines: { confidence: Confidence }[]): Confidence {
  if (lines.some(l => l.confidence === 'depends_on_branche')) return 'depends_on_branche';
  if (lines.some(l => l.confidence === 'estimated')) return 'estimated';
  return 'exact';
}

export function FundingBreakdown({ result }: Props) {
  const visibleLines = result.lines.filter(l => l.requestedAmount > 0 || l.fundedAmount > 0);
  const overallConfidence = getOverallConfidence(visibleLines.length > 0 ? visibleLines : result.lines);
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());

  const toggleLine = (index: number) => {
    setExpandedLines(prev => {
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
    <div className="space-y-6 print:space-y-4">
      {/* Carte de résultat principale */}
      <div className="rounded border border-ink bg-navy p-6 text-paper shadow-[6px_6px_0_0_var(--marker)] md:p-8 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="marginalia !text-paper/60">Estimation de prise en charge</div>
            <div className="mt-1 font-display text-lg font-bold">{result.opcoName}</div>
            {result.brancheApplied && (
              <div className="mt-0.5 text-xs text-paper/70">
                Barème de branche appliqué : {result.brancheApplied}
              </div>
            )}
          </div>
          <ConfidenceBadge confidence={overallConfidence} />
        </div>
        <div className="amount mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
          <span className="mark text-ink">{formatEuro(result.totalFunded)}</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-paper/75">
          {result.budgetCapApplied && result.budgetCapAmount && (
            <span>Plafond annuel appliqué : <span className="amount">{formatEuro(result.budgetCapAmount)}</span></span>
          )}
          {result.totalRemainder > 0 && (
            <span>
              Reste à charge estimé :{' '}
              <span className="amount font-semibold text-paper">{formatEuro(result.totalRemainder)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Détail par poste */}
      <div className="overflow-hidden rounded border border-ink bg-white">
        <div className="flex items-center justify-between border-b border-ink px-6 py-4">
          <h3 className="font-display font-bold">Détail du financement</h3>
          <span className="text-xs text-ink-faint print:hidden">Cliquez sur une ligne pour le calcul complet</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-deep">
              <tr>
                <th className="marginalia px-6 py-3 text-left">Poste</th>
                <th className="marginalia px-6 py-3 text-right">Demandé</th>
                <th className="marginalia px-6 py-3 text-right">Financé</th>
                <th className="marginalia px-6 py-3 text-right">Reste</th>
                <th className="marginalia px-6 py-3 text-center">Fiabilité</th>
                <th className="marginalia px-6 py-3 text-center print:hidden">Preuve</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {visibleLines.map((line, i) => (
                <tr key={i} className="group">
                  <td colSpan={6} className="p-0">
                    <div
                      className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center transition-colors hover:bg-marker-soft/40 ${line.details?.length ? 'cursor-pointer' : ''}`}
                      onClick={() => line.details?.length && toggleLine(i)}
                    >
                      <div className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-medium text-ink">
                          {line.details?.length ? (
                            <svg
                              className={`h-3.5 w-3.5 flex-shrink-0 text-ink-faint transition-transform print:hidden ${expandedLines.has(i) ? 'rotate-90' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          ) : null}
                          {line.label}
                        </div>
                        {line.note && <div className="ml-5 mt-0.5 text-xs text-ink-faint">{line.note}</div>}
                      </div>
                      <div className="amount px-6 py-4 text-right text-ink-soft">{formatEuro(line.requestedAmount)}</div>
                      <div className="amount px-6 py-4 text-right font-semibold text-valid">{formatEuro(line.fundedAmount)}</div>
                      <div className="amount px-6 py-4 text-right text-ink-soft">
                        {line.remainder > 0 ? formatEuro(line.remainder) : '-'}
                      </div>
                      <div className="px-6 py-4 text-center">
                        <ConfidenceBadge confidence={line.confidence} />
                      </div>
                      <div className="px-6 py-4 text-center print:hidden" onClick={(e) => e.stopPropagation()}>
                        <SourceBadge url={line.sourceUrl} />
                      </div>
                    </div>
                    {expandedLines.has(i) && line.details && line.details.length > 0 && (
                      <div className="border-t border-rule bg-paper px-6 py-3">
                        <div className="marginalia mb-1.5">Détail du calcul</div>
                        <ul className="space-y-1">
                          {line.details.map((detail, j) => (
                            <li key={j} className="flex items-start gap-2 text-xs text-ink-soft">
                              <span className="mt-0.5 flex-shrink-0 text-ink-faint">›</span>
                              {detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-ink bg-paper-deep font-semibold">
              <tr>
                <td className="px-6 py-4">Total</td>
                <td className="amount px-6 py-4 text-right">{formatEuro(result.totalRequested)}</td>
                <td className="amount px-6 py-4 text-right text-valid">{formatEuro(result.totalFunded)}</td>
                <td className="amount px-6 py-4 text-right">
                  {result.totalRemainder > 0 ? formatEuro(result.totalRemainder) : '-'}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Plafond budgétaire */}
      {result.budgetCapApplied && result.budgetCapAmount && (
        <div className="rounded border border-cobalt/40 bg-cobalt-soft p-5">
          <h3 className="mb-2 flex items-center gap-2 font-display font-bold text-navy">
            Plafond budgétaire annuel appliqué
          </h3>
          <p className="text-sm leading-relaxed text-navy/80">
            Le financement calculé dépasse le plafond annuel de{' '}
            <strong className="amount">{formatEuro(result.budgetCapAmount)}</strong>{' '}fixé par {result.opcoName}.
            L&apos;estimation a été ramenée à ce plafond. En pratique, l&apos;OPCO finance les postes dans
            la limite de cette enveloppe : le montant retenu par poste peut différer de la répartition affichée.
          </p>
        </div>
      )}

      {/* Points d'attention */}
      {result.warnings.length > 0 && (
        <div className="rounded border border-alert/40 bg-alert-soft p-5">
          <h3 className="mb-3 font-display font-bold text-alert">Points d&apos;attention</h3>
          <ul className="space-y-2">
            {result.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-alert">
                <span className="mt-0.5">•</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Conditions */}
      {result.conditions.length > 0 && (
        <div className="rounded border border-rule bg-white p-5">
          <h3 className="mb-3 font-display font-bold">Conditions d&apos;éligibilité</h3>
          <ul className="space-y-2">
            {result.conditions.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-ink-soft">
                <span className="mt-0.5 text-cobalt">•</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Prochaines étapes */}
      <div className="rounded border border-rule bg-white p-5">
        <h3 className="mb-4 font-display font-bold">Prochaines étapes</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {result.nextSteps.map((step, i) => (
            <a
              key={i}
              href={step.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded border border-rule p-3 transition-colors hover:border-cobalt hover:bg-cobalt-soft"
            >
              <svg className="h-5 w-5 flex-shrink-0 text-cobalt" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span className="text-sm">{step.label}</span>
            </a>
          ))}
          {result.delaiValidation && (
            <div className="rounded border border-rule bg-paper p-3">
              <div className="marginalia mb-1">Délai de validation</div>
              <div className="text-sm font-medium">{result.delaiValidation}</div>
            </div>
          )}
          {result.modePaiement && (
            <div className="rounded border border-rule bg-paper p-3">
              <div className="marginalia mb-1">Mode de paiement</div>
              <div className="text-sm font-medium">{result.modePaiement}</div>
            </div>
          )}
        </div>
      </div>

      {/* Avertissement légal */}
      <div className="rounded border border-rule bg-paper-deep p-4 text-center text-xs leading-relaxed text-ink-soft">
        Ce calcul est une <strong>estimation indicative</strong>{' '}fondée sur les critères de financement 2026
        publiés par les OPCO. Seul votre OPCO ({result.opcoName}) peut confirmer le montant exact
        après étude de votre dossier.
      </div>
    </div>
  );
}
