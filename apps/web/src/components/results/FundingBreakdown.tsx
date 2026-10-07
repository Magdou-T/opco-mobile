'use client';

import { Fragment, useState } from 'react';
import type { Confidence, DispositifEligible, FundingLine, FundingResult } from '@opco/core';
import { AlertesOpco } from '@/components/ui/AlertesOpco';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { CumulBadge } from '@/components/ui/CumulBadge';
import { Icon } from '@/components/ui/Icon';
import { SourceBadge } from '@/components/ui/SourceBadge';
import { cx } from '@/lib/cx';
import { de, formatEuro, texteDonnees } from '@/lib/format';
import { replierIdcc } from '@/lib/resultats';

interface Props {
  result: FundingResult;
}

/** En-tête de colonne : Inter 600 en petites majuscules, texte discret (5,35:1 sur blanc, 4,95:1 sur lin-soft). */
const EN_TETE = 'px-4 py-3 text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase sm:px-6';

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
  return line.note ?? `Montant à confirmer auprès ${de(opcoName)}`;
}

/**
 * Mention d'un montant qui n'est pas exact (une ligne « exact » n'en porte aucune) : pilule à point de couleur qui peut
 * passer à la ligne (texte rouge sur rouge doux 5,62:1 ; texte doux sur lin-soft 7,68:1).
 */
function BadgeEstimation({ confidence, opcoName }: { confidence: Confidence; opcoName: string }) {
  if (confidence === 'exact') return null;
  const estimated = confidence === 'estimated';
  return (
    <span
      className={cx(
        'inline-flex items-start gap-1.5 rounded-2xl border py-0.5 pr-2.5 pl-2 text-xs leading-5 font-semibold',
        estimated ? 'border-rouge/25 bg-rouge-soft text-rouge' : 'border-filet bg-lin-soft text-texte-doux',
      )}
    >
      <span aria-hidden="true" className="mt-[0.4rem] size-[7px] shrink-0 rounded-full bg-current" />
      {estimated ? `estimation à confirmer auprès ${de(opcoName)}` : 'dépend de votre accord de branche'}
    </span>
  );
}

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
  // Un plafond de 0 € (enveloppe épuisée) est expliqué par les points d'attention : pas de bloc « plafond appliqué de 0 € ».
  const plafondAnnuel =
    result.budgetCapApplied && result.budgetCapAmount != null && result.budgetCapAmount > 0
      ? result.budgetCapAmount
      : null;

  // Le moteur ramène le délai publié à un texte (chaîne vide quand les données en donnent un objet détaillé ou rien).
  const delaiAffiche = result.delaiValidation.trim();

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
    // Les textes des données citent parfois une adresse web entière : elle passe à la ligne plutôt que d'élargir la page.
    <div className="space-y-5 break-words">
      {/* Carte de résultat de l'OPCO : total de tous ses postes (le plan ne retient que ceux de la formation) */}
      <Card padding="lg">
        <p className="text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase">
          {result.pdcFerme ? 'Plan de développement des compétences' : 'Estimation de prise en charge'}
        </p>
        <p className="mt-1.5 font-display text-xl leading-snug font-bold text-texte">{opcoName}</p>
        <p className="mt-1 text-sm leading-snug text-texte-doux">{texteDonnees(result.dispositifPrincipal)}</p>
        {result.brancheAppliquee && (
          <p className="mt-0.5 text-sm leading-snug text-texte-doux">
            Barème de branche appliqué&nbsp;: {texteDonnees(result.brancheAppliquee)}
          </p>
        )}

        {result.pdcFerme ? (
          <Callout tone="avertissement" titre="Aucune prise en charge estimée sur ce dispositif" className="mt-5">
            Votre entreprise compte 50 salariés ou plus&nbsp;: les fonds mutualisés du plan de développement des
            compétences ne lui sont pas ouverts, et{' '}
            {result.brancheAppliquee ? (
              <>le barème de la branche «&nbsp;{result.brancheAppliquee}&nbsp;»</>
            ) : (
              <>le barème général {de(opcoName)}</>
            )}{' '}
            ne prévoit pas d&apos;enveloppe conventionnelle ou volontaire pour votre taille d&apos;entreprise.
            {!result.brancheAppliquee && (
              <>
                {' '}
                Si votre branche publie une enveloppe pour votre taille, sélectionnez-la à l&apos;étape Entreprise.
              </>
            )}{' '}
            Les pistes et les démarches ci-dessous sont celles qui s&apos;appliquent à votre situation.
          </Callout>
        ) : montantConnu ? (
          <div className="mt-5">
            <p className="text-sm font-semibold text-texte-doux">Total estimé, tous postes</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="amount text-3xl leading-tight text-turquoise-deep sm:text-4xl">{formatEuro(result.totalFunded)}</p>
              <BadgeEstimation confidence={overallConfidence} opcoName={opcoName} />
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <p className="font-display text-2xl font-bold text-texte">Montant à confirmer</p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-texte-doux">
              Les barèmes publiés par {opcoName}{' '}ne permettent pas de chiffrer cette prise en charge&nbsp;: elle
              dépend de votre accord de branche. Le détail ci-dessous indique la règle de chaque poste&nbsp;;
              contactez votre conseiller {opcoName}{' '}pour la confirmer.
            </p>
            <div className="mt-3">
              <BadgeEstimation confidence="depends_on_branche" opcoName={opcoName} />
            </div>
          </div>
        )}

        {(plafondAnnuel != null || (!result.pdcFerme && montantConnu && result.totalRemainder > 0)) && (
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-sm text-texte-doux">
            {plafondAnnuel != null && (
              <div className="flex gap-1.5">
                <dt>Plafond annuel appliqué&nbsp;:</dt>
                <dd className="amount text-texte">{formatEuro(plafondAnnuel)}</dd>
              </div>
            )}
            {!result.pdcFerme && montantConnu && result.totalRemainder > 0 && (
              <div className="flex gap-1.5">
                <dt>Reste à charge sur ces postes&nbsp;:</dt>
                <dd className="amount text-orange-deep">{formatEuro(result.totalRemainder)}</dd>
              </div>
            )}
          </dl>
        )}
      </Card>

      {/* Alertes publiées par l'OPCO pour l'entreprise */}
      <AlertesOpco alertes={result.alertes} opcoName={opcoName} id="alertes-opco" />

      {/* Détail par poste (sans objet quand le plan est fermé : aucun montant n'est estimé). Sous 640 px, les colonnes
          « Demandé » et « Source » passent dans la colonne du poste ; la règle d'une ligne non chiffrée y est aussi, pour
          que la colonne étroite « Financé » ne s'allonge pas sur huit lignes. */}
      {!result.pdcFerme && visibleLines.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-filet px-5 py-4 sm:px-6">
            <h3 className="text-lg leading-snug font-bold text-texte">Détail par poste</h3>
            {visibleLines.some((l) => l.details?.length) && (
              <p className="text-xs text-texte-discret print:hidden">Ouvrez une ligne pour le calcul complet</p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-lin-soft">
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
                  <th scope="col" className={cx(EN_TETE, 'text-right')}>
                    Reste
                  </th>
                  <th scope="col" className={cx(EN_TETE, 'hidden text-center sm:table-cell print:hidden')}>
                    Source
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-filet">
                {visibleLines.map((line, i) => {
                  const detaillee = !!line.details?.length;
                  const ouverte = expandedLines.has(i);
                  const sansMontant = sansMontantEstime(line);
                  return (
                    <Fragment key={`${line.poste}-${i}`}>
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
                                aria-label={`Calcul détaillé : ${line.label}`}
                                className="-my-1 -ml-1.5 grid size-7 shrink-0 place-items-center rounded-full text-texte-discret hover:text-orange-deep print:hidden"
                              >
                                <Icon
                                  name="chevron"
                                  className={cx('size-4 transition-transform duration-200', ouverte && 'rotate-90')}
                                  strokeWidth={2}
                                />
                              </button>
                            )}
                            <span>{line.label}</span>
                          </div>
                          {/* Une adresse dans une note ne doit pas fixer la largeur de la colonne. */}
                          <div className={cx('space-y-1.5 [overflow-wrap:anywhere]', detaillee && 'sm:pl-6')}>
                            {!sansMontant && line.note && (
                              <p className="mt-1 text-xs leading-relaxed text-texte-discret">{texteDonnees(line.note)}</p>
                            )}
                            {sansMontant && (
                              <p className="mt-1 text-xs leading-relaxed text-texte-doux">
                                {texteDonnees(regleDeLigne(line, opcoName))}
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
                        <td className="amount px-4 py-4 text-right whitespace-nowrap text-texte-doux sm:px-6">
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
                      {ouverte && detaillee && (
                        <tr>
                          <td colSpan={5} className="bg-lin-soft/60 px-4 py-4 [overflow-wrap:anywhere] sm:px-6">
                            <p className="text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase">
                              Détail du calcul
                            </p>
                            <ul className="mt-2 space-y-1.5">
                              {line.details?.map((detail, j) => (
                                <li key={j} className="flex items-start gap-2.5 text-xs leading-relaxed text-texte-doux">
                                  <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-turquoise" />
                                  <span>{texteDonnees(detail)}</span>
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
              <tfoot className="border-t border-filet bg-lin-soft font-semibold text-texte">
                <tr>
                  <td className="px-4 py-4 sm:px-6">Total</td>
                  <td className="amount hidden px-4 py-4 text-right sm:table-cell sm:px-6">
                    {formatEuro(result.totalRequested)}
                  </td>
                  <td className="amount px-4 py-4 text-right whitespace-nowrap text-turquoise-deep sm:px-6">
                    {montantConnu ? formatEuro(result.totalFunded) : '-'}
                  </td>
                  <td className="amount px-4 py-4 text-right whitespace-nowrap sm:px-6">
                    {montantConnu && result.totalRemainder > 0 ? formatEuro(result.totalRemainder) : '-'}
                  </td>
                  <td className="hidden sm:table-cell print:hidden"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Plafond budgétaire */}
      {plafondAnnuel != null && (
        <Callout tone="info" titre="Plafond budgétaire annuel appliqué">
          Le financement calculé dépasse le plafond annuel de{' '}
          <span className="amount text-texte">{formatEuro(plafondAnnuel)}</span>{' '}fixé par {opcoName}. L&apos;estimation
          a été ramenée à ce plafond. En pratique, l&apos;OPCO finance les postes dans la limite de cette enveloppe&nbsp;:
          le montant retenu par poste peut différer de la répartition affichée.
        </Callout>
      )}

      {/* Points d'attention (messages du moteur) */}
      {result.warnings.length > 0 && (
        <Callout tone="avertissement" titre="Points d'attention">
          <ul className="space-y-1.5">
            {result.warnings.map((w, i) => (
              <li key={i} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-texte-doux" />
                <span>{texteDonnees(w)}</span>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      {/* Dispositifs complémentaires */}
      {dispositifs.length > 0 && (
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
                          <span>
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
      )}

      {/* Démarches (celles du moteur : adaptées quand le plan est fermé) */}
      {result.demarches.length > 0 && (
        <Card as="section" aria-labelledby="titre-demarches-opco" padding="md" className="break-inside-avoid">
          <h3 id="titre-demarches-opco" className="text-lg leading-snug font-bold text-texte">
            Démarches à suivre
          </h3>
          <ol className="mt-4 space-y-2.5">
            {result.demarches.map((etape, i) => (
              <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-texte-doux">
                <span
                  aria-hidden="true"
                  className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-turquoise font-display text-xs font-bold text-texte"
                >
                  {i + 1}
                </span>
                <span className="pt-0.5">{texteDonnees(etape)}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* Conditions */}
      {result.conditions.length > 0 && (
        <Card as="section" aria-labelledby="titre-conditions-opco" padding="md" className="break-inside-avoid">
          <h3 id="titre-conditions-opco" className="text-lg leading-snug font-bold text-texte">
            Conditions d&apos;éligibilité
          </h3>
          <ul className="mt-4 space-y-2">
            {result.conditions.map((c, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-texte-doux">
                <Icon name="coche" className="mt-0.5 size-4 shrink-0 text-turquoise-deep" strokeWidth={2} />
                <span>{texteDonnees(c)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Prochaines étapes */}
      {(prochainesEtapes.length > 0 || delaiAffiche || result.modePaiement) && (
        <Card as="section" aria-labelledby="titre-etapes-opco" padding="md" className="break-inside-avoid">
          <h3 id="titre-etapes-opco" className="text-lg leading-snug font-bold text-texte">
            Prochaines étapes
          </h3>
          <div className="mt-4 grid items-start gap-3 md:grid-cols-3">
            {prochainesEtapes.map((step, i) => {
              const externe = /^https?:/.test(step.url);
              return (
                <a
                  key={i}
                  href={step.url}
                  {...(externe ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="flex min-h-12 items-center gap-3 rounded-2xl border border-filet p-3 text-sm font-medium text-texte transition-[border-color,background-color] hover:border-orange/45 hover:bg-orange-soft"
                >
                  <Icon
                    name={step.url.startsWith('mailto:') ? 'courriel' : 'lien-externe'}
                    className="size-5 shrink-0 text-orange-deep"
                  />
                  <span>{texteDonnees(step.label)}</span>
                  {externe && <span className="sr-only"> (nouvel onglet)</span>}
                </a>
              );
            })}
            {delaiAffiche && (
              <div className="rounded-2xl bg-lin-soft p-3">
                <p className="text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase">Délai de validation</p>
                <p className="mt-1 text-sm font-medium text-texte">{texteDonnees(delaiAffiche)}</p>
              </div>
            )}
            {result.modePaiement && (
              <div className="rounded-2xl bg-lin-soft p-3">
                <p className="text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase">Mode de paiement</p>
                <p className="mt-1 text-sm font-medium text-texte">{texteDonnees(result.modePaiement)}</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
