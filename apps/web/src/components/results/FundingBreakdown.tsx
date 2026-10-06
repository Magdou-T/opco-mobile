'use client';

import { Fragment, useState } from 'react';
import type { Confidence, DispositifEligible, FundingLine, FundingResult } from '@opco/core';
import { AlertesOpco } from '@/components/ui/AlertesOpco';
import { CumulBadge } from '@/components/ui/CumulBadge';
import { SourceBadge } from '@/components/ui/SourceBadge';
import { formatEuro } from '@/lib/format';

interface Props {
  result: FundingResult;
}

function getOverallConfidence(items: { confidence: Confidence }[]): Confidence {
  if (items.some((l) => l.confidence === 'depends_on_branche')) return 'depends_on_branche';
  if (items.some((l) => l.confidence === 'estimated')) return 'estimated';
  return 'exact';
}

/**
 * Ligne dont le moteur ne chiffre rien : l'OPCO ne publie pas de barème pour ce poste (confiance « selon branche »
 * et 0 € financé). Elle s'affiche avec sa règle seule, jamais avec « 0 € » : un montant nul n'est montré que
 * s'il est publié comme tel.
 */
function sansMontantEstime(line: FundingLine): boolean {
  return line.confidence === 'depends_on_branche' && line.fundedAmount === 0;
}

/** Libellé de la règle d'une ligne sans montant estimé. */
function regleDeLigne(line: FundingLine, opcoName: string): string {
  return line.note ?? `Montant à confirmer auprès de ${opcoName}`;
}

/** Badge d'un montant qui n'est pas exact : une ligne « exact » n'en porte aucun. */
function BadgeEstimation({ confidence, opcoName }: { confidence: Confidence; opcoName: string }) {
  if (confidence === 'exact') return null;
  const estimated = confidence === 'estimated';
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-left text-[0.7rem] font-medium leading-snug ${
        estimated ? 'border-alert/40 bg-alert-soft text-alert' : 'border-rule bg-paper-deep text-ink-soft'
      }`}
    >
      {estimated ? `estimation à confirmer auprès de ${opcoName}` : 'dépend de votre accord de branche'}
    </span>
  );
}

/** Dispositif dont un montant est calculable pour cette formation (un montant nul n'est pas un montant publié). */
function montantDuDispositif(d: DispositifEligible): number | null {
  return d.montantEstime != null && d.montantEstime > 0 ? d.montantEstime : null;
}

export function FundingBreakdown({ result }: Props) {
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());

  const { opcoName } = result;
  const visibleLines = result.lines.filter(
    (l) => l.requestedAmount > 0 || l.fundedAmount > 0 || sansMontantEstime(l),
  );
  const lignesChiffrees = visibleLines.filter((l) => !sansMontantEstime(l));
  const lignesFinancees = result.lines.filter((l) => l.fundedAmount > 0);
  // Un montant est connu dès qu'une ligne est chiffrée ; sinon le total affiché serait un « 0 € » inventé.
  const montantConnu = result.totalFunded > 0 || lignesChiffrees.length > 0;
  const overallConfidence = getOverallConfidence(lignesFinancees.length > 0 ? lignesFinancees : lignesChiffrees);

  const dispositifs = result.dispositifsComplementaires;
  const dispositifsChiffres = dispositifs.filter((d) => d.cumul !== 'alternatif' && montantDuDispositif(d) != null);
  const enveloppeMaxAffichee = result.enveloppeMaxPotentielle > result.totalFunded;
  const enveloppeConfidence = getOverallConfidence([...lignesFinancees, ...dispositifsChiffres]);
  // Un plafond de 0 € (enveloppe épuisée) est expliqué par les points d'attention : pas de bloc « plafond appliqué de 0 € ».
  const plafondAnnuel =
    result.budgetCapApplied && result.budgetCapAmount != null && result.budgetCapAmount > 0
      ? result.budgetCapAmount
      : null;

  // Le schéma des données admet un objet ou null pour ce champ libre (le moteur le recopie tel quel) : on n'affiche qu'un texte.
  const delaiValidation: unknown = result.delaiValidation;
  const delaiAffiche = typeof delaiValidation === 'string' ? delaiValidation : '';

  // Le moteur n'ajoute le lien de contact que si l'OPCO publie une adresse e-mail ; ici aussi, seulement dans ce cas.
  const prochainesEtapes = result.nextSteps.filter(
    (s) => !s.url.startsWith('mailto:') || result.opcoEmail.trim() !== '',
  );

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
    <div className="space-y-6 print:space-y-4">
      {/* Carte de résultat principale */}
      {/* `isolate` : le surligneur du montant (.mark::before, z-index -1) doit passer devant le fond sombre de la carte. */}
      <div className="isolate rounded border border-ink bg-navy p-6 text-paper shadow-[6px_6px_0_0_var(--marker)] md:p-8 print:shadow-none">
        <div className="marginalia !text-paper/60">
          {result.pdcFerme ? 'Plan de développement des compétences' : 'Estimation de prise en charge'}
        </div>
        <div className="mt-1 font-display text-lg font-bold">{opcoName}</div>
        <div className="mt-0.5 text-xs text-paper/70">{result.dispositifPrincipal}</div>
        {result.brancheAppliquee && (
          <div className="mt-0.5 text-xs text-paper/70">
            Barème de branche appliqué : {result.brancheAppliquee}
          </div>
        )}

        {result.pdcFerme ? (
          <div className="mt-5">
            <div className="font-display text-2xl font-bold md:text-3xl">
              Aucune prise en charge estimée sur ce dispositif
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-paper/80">
              Votre entreprise compte 50 salariés ou plus : le plan de développement des compétences
              mutualisé ne lui est pas ouvert, et {opcoName}{' '}ne publie aucune enveloppe conventionnelle ou
              volontaire pour votre taille d&apos;entreprise. Le simulateur n&apos;affiche donc aucun montant
              pris en charge ; les pistes et les démarches ci-dessous sont celles qui s&apos;appliquent à
              votre situation.
            </p>
          </div>
        ) : montantConnu ? (
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="amount text-4xl font-semibold tracking-tight md:text-5xl">
              <span className="mark text-ink">{formatEuro(result.totalFunded)}</span>
            </div>
            <BadgeEstimation confidence={overallConfidence} opcoName={opcoName} />
          </div>
        ) : (
          <div className="mt-5">
            <div className="font-display text-2xl font-bold md:text-3xl">Montant à confirmer</div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-paper/80">
              Les barèmes publiés par {opcoName}{' '}ne permettent pas de chiffrer cette prise en charge : elle
              dépend de votre accord de branche. Le détail ci-dessous indique la règle de chaque poste ;
              contactez votre conseiller {opcoName}{' '}pour la confirmer.
            </p>
            <div className="mt-3">
              <BadgeEstimation confidence="depends_on_branche" opcoName={opcoName} />
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-paper/75">
          {plafondAnnuel != null && (
            <span>
              Plafond annuel appliqué : <span className="amount">{formatEuro(plafondAnnuel)}</span>
            </span>
          )}
          {!result.pdcFerme && montantConnu && result.totalRemainder > 0 && (
            <span>
              Reste à charge estimé :{' '}
              <span className="amount font-semibold text-paper">{formatEuro(result.totalRemainder)}</span>
            </span>
          )}
          {enveloppeMaxAffichee && (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                Enveloppe maximale potentielle, avec les dispositifs complémentaires chiffrables :{' '}
                <span className="amount font-semibold text-paper">{formatEuro(result.enveloppeMaxPotentielle)}</span>
              </span>
              <BadgeEstimation confidence={enveloppeConfidence} opcoName={opcoName} />
            </span>
          )}
        </div>
      </div>

      {/* Alertes publiées par l'OPCO pour l'entreprise */}
      <AlertesOpco alertes={result.alertes} opcoName={opcoName} />

      {/* Détail par poste (sans objet quand le plan est fermé : aucun montant n'est estimé) */}
      {!result.pdcFerme && visibleLines.length > 0 && (
        <div className="overflow-hidden rounded border border-ink bg-white">
          <div className="flex items-center justify-between border-b border-ink px-6 py-4">
            <h3 className="font-display font-bold">Détail du financement</h3>
            <span className="text-xs text-ink-faint print:hidden">Cliquez sur une ligne pour le calcul complet</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper-deep">
                <tr>
                  <th scope="col" className="marginalia px-4 py-3 text-left md:px-6">Poste</th>
                  <th scope="col" className="marginalia px-4 py-3 text-right md:px-6">Demandé</th>
                  <th scope="col" className="marginalia px-4 py-3 text-right md:px-6">Financé</th>
                  <th scope="col" className="marginalia px-4 py-3 text-right md:px-6">Reste</th>
                  <th scope="col" className="marginalia px-4 py-3 text-center md:px-6 print:hidden">Preuve</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {visibleLines.map((line, i) => {
                  const detaillee = !!line.details?.length;
                  const ouverte = expandedLines.has(i);
                  const sansMontant = sansMontantEstime(line);
                  return (
                    <Fragment key={`${line.poste}-${i}`}>
                      <tr
                        data-poste={line.poste}
                        className={`align-top transition-colors hover:bg-marker-soft/40 ${detaillee ? 'cursor-pointer' : ''}`}
                        onClick={() => detaillee && toggleLine(i)}
                      >
                        <td className="px-4 py-4 md:px-6">
                          <div className="flex items-center gap-1.5 font-medium text-ink">
                            {detaillee && (
                              <button
                                type="button"
                                aria-expanded={ouverte}
                                aria-label={`Calcul détaillé : ${line.label}`}
                                className="-m-1 flex-shrink-0 p-1 text-ink-faint print:hidden"
                              >
                                <svg
                                  className={`h-3.5 w-3.5 transition-transform ${ouverte ? 'rotate-90' : ''}`}
                                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            )}
                            {line.label}
                          </div>
                          {!sansMontant && line.note && (
                            <div className={`mt-0.5 text-xs text-ink-faint ${detaillee ? 'ml-5' : ''}`}>{line.note}</div>
                          )}
                        </td>
                        <td className="amount px-4 py-4 text-right text-ink-soft md:px-6">
                          {line.requestedAmount > 0 ? formatEuro(line.requestedAmount) : '-'}
                        </td>
                        <td className="px-4 py-4 text-right md:px-6">
                          {sansMontant ? (
                            <div className="flex flex-col items-end gap-1.5">
                              <span className="max-w-[18rem] text-xs leading-snug text-ink-soft">
                                {regleDeLigne(line, opcoName)}
                              </span>
                              <BadgeEstimation confidence={line.confidence} opcoName={opcoName} />
                            </div>
                          ) : (
                            <div className="flex flex-row-reverse flex-wrap items-center gap-x-2 gap-y-1.5">
                              <span className="amount font-semibold text-valid">{formatEuro(line.fundedAmount)}</span>
                              <BadgeEstimation confidence={line.confidence} opcoName={opcoName} />
                            </div>
                          )}
                        </td>
                        <td className="amount px-4 py-4 text-right text-ink-soft md:px-6">
                          {line.remainder > 0 ? formatEuro(line.remainder) : '-'}
                        </td>
                        <td className="px-4 py-4 text-center md:px-6 print:hidden" onClick={(e) => e.stopPropagation()}>
                          <SourceBadge url={line.sourceUrl} />
                        </td>
                      </tr>
                      {ouverte && detaillee && (
                        <tr>
                          <td colSpan={5} className="border-t border-rule bg-paper px-4 py-3 md:px-6">
                            <div className="marginalia mb-1.5">Détail du calcul</div>
                            <ul className="space-y-1">
                              {line.details?.map((detail, j) => (
                                <li key={j} className="flex items-start gap-2 text-xs text-ink-soft">
                                  <span className="mt-0.5 flex-shrink-0 text-ink-faint">›</span>
                                  {detail}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-ink bg-paper-deep font-semibold">
                <tr>
                  <td className="px-4 py-4 md:px-6">Total</td>
                  <td className="amount px-4 py-4 text-right md:px-6">{formatEuro(result.totalRequested)}</td>
                  <td className="amount px-4 py-4 text-right text-valid md:px-6">
                    {montantConnu ? formatEuro(result.totalFunded) : '-'}
                  </td>
                  <td className="amount px-4 py-4 text-right md:px-6">
                    {montantConnu && result.totalRemainder > 0 ? formatEuro(result.totalRemainder) : '-'}
                  </td>
                  <td className="print:hidden"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Plafond budgétaire */}
      {plafondAnnuel != null && (
        <div className="rounded border border-cobalt/40 bg-cobalt-soft p-5">
          <h3 className="mb-2 flex items-center gap-2 font-display font-bold text-navy">
            Plafond budgétaire annuel appliqué
          </h3>
          <p className="text-sm leading-relaxed text-navy/80">
            Le financement calculé dépasse le plafond annuel de{' '}
            <strong className="amount">{formatEuro(plafondAnnuel)}</strong>{' '}fixé par {opcoName}.
            L&apos;estimation a été ramenée à ce plafond. En pratique, l&apos;OPCO finance les postes dans
            la limite de cette enveloppe : le montant retenu par poste peut différer de la répartition affichée.
          </p>
        </div>
      )}

      {/* Points d'attention (messages du moteur, affichés tels quels) */}
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

      {/* Dispositifs complémentaires */}
      {dispositifs.length > 0 && (
        <section className="rounded border border-rule bg-white p-5">
          <h3 className="font-display font-bold">Financements complémentaires</h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-faint">
            Dispositifs de {opcoName}{' '}accessibles à votre entreprise. Le tampon indique comment chacun se
            combine avec le plan de développement des compétences ; un montant n&apos;est donné que s&apos;il
            est calculable pour votre formation.
          </p>
          <ul className="mt-4 space-y-4">
            {dispositifs.map((d) => {
              const montant = montantDuDispositif(d);
              return (
                <li key={d.id} className="rounded border border-rule bg-paper p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h4 className="font-semibold text-ink">{d.nom}</h4>
                    <CumulBadge cumul={d.cumul} />
                  </div>
                  {montant != null && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="amount font-semibold text-valid">{formatEuro(montant)}</span>
                      <span className="text-xs text-ink-faint">estimé pour votre formation</span>
                      <BadgeEstimation confidence={d.confidence} opcoName={opcoName} />
                    </div>
                  )}
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{d.description}</p>
                  {d.publics && <p className="mt-1 text-xs text-ink-faint">Public visé : {d.publics}</p>}
                  {d.conditions.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {d.conditions.map((c, j) => (
                        <li key={j} className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
                          <span className="mt-0.5 text-cobalt">•</span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  )}
                  {d.demarches && (
                    <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                      <strong className="font-semibold text-ink">Démarche :</strong> {d.demarches}
                    </p>
                  )}
                  {d.note && <p className="mt-2 text-xs leading-relaxed text-ink-faint">{d.note}</p>}
                  <div className="mt-3 print:hidden">
                    <SourceBadge url={d.sourceUrl} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Démarches (celles du moteur : adaptées quand le plan est fermé) */}
      {result.demarches.length > 0 && (
        <section className="rounded border border-rule bg-white p-5">
          <h3 className="mb-3 font-display font-bold">Démarches à suivre</h3>
          <ol className="space-y-2">
            {result.demarches.map((etape, i) => (
              <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-ink-soft">
                <span className="amount mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-ink text-xs font-semibold text-ink">
                  {i + 1}
                </span>
                {etape}
              </li>
            ))}
          </ol>
        </section>
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
          {prochainesEtapes.map((step, i) => {
            const externe = /^https?:/.test(step.url);
            return (
              <a
                key={i}
                href={step.url}
                {...(externe ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="flex items-center gap-3 rounded border border-rule p-3 transition-colors hover:border-cobalt hover:bg-cobalt-soft"
              >
                <svg className="h-5 w-5 flex-shrink-0 text-cobalt" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span className="text-sm">{step.label}</span>
              </a>
            );
          })}
          {delaiAffiche && (
            <div className="rounded border border-rule bg-paper p-3">
              <div className="marginalia mb-1">Délai de validation</div>
              <div className="text-sm font-medium">{delaiAffiche}</div>
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
        publiés par les OPCO. Seul votre OPCO ({opcoName}) peut confirmer le montant exact
        après étude de votre dossier.
      </div>
    </div>
  );
}
