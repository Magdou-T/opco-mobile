import type { Confidence, FundingResult } from '@opco/core';
import { AlertesOpco } from '@/components/ui/AlertesOpco';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import { de, formatEuro, texteDonnees, texteMoteur } from '@/lib/format';
import { dispositifAffiche, lignesDuDetail, sansMontantEstime } from '@/lib/resultats';
import type { RelaisPlanConventionnel } from '@/lib/resultats';
import { BadgeEstimation } from './BadgeEstimation';
import { TEXTE_SOUPLE } from './classes';
import { DetailParPoste } from './DetailParPoste';
import { DispositifsOpco } from './DispositifsOpco';

interface Props {
  result: FundingResult;
  /** Plan conventionnel de la branche en relais : il nomme le dispositif en tête de la carte (`dispositifAffiche`). */
  relais?: RelaisPlanConventionnel | null;
}

function getOverallConfidence(items: { confidence: Confidence }[]): Confidence {
  if (items.some((l) => l.confidence === 'depends_on_branche')) return 'depends_on_branche';
  if (items.some((l) => l.confidence === 'estimated')) return 'estimated';
  return 'exact';
}

/**
 * Détail de l'estimation de l'OPCO : carte du total de tous ses postes (le plan ne retient que ceux de la formation),
 * alertes de l'OPCO, détail par poste (`DetailParPoste`), plafond annuel, points d'attention, financements
 * complémentaires (`DispositifsOpco`), démarches, conditions et prochaines étapes.
 */
export function FundingBreakdown({ result, relais = null }: Props) {
  const { opcoName } = result;
  const visibleLines = lignesDuDetail(result);
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

  return (
    // Les textes des données citent parfois une adresse web entière : elle passe à la ligne plutôt que d'élargir la page.
    <div className="space-y-5 break-words">
      {/* Carte de résultat de l'OPCO : total de tous ses postes (le plan ne retient que ceux de la formation) */}
      <Card padding="lg">
        <p className="text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase">
          {result.pdcFerme ? 'Plan de développement des compétences' : 'Estimation de prise en charge'}
        </p>
        <p className="mt-1.5 font-display text-xl leading-snug font-bold text-texte">{opcoName}</p>
        <p className="mt-1 text-sm leading-snug text-texte-doux">{texteDonnees(dispositifAffiche(result, relais))}</p>
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

      {/* Détail par poste (sans objet quand le plan est fermé : aucun montant n'est estimé). */}
      {!result.pdcFerme && visibleLines.length > 0 && (
        <DetailParPoste result={result} lignes={visibleLines} montantConnu={montantConnu} />
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

      {/* Points d'attention (messages du moteur : texteMoteur, chaque nombre à point y est décimal) */}
      {result.warnings.length > 0 && (
        <Callout tone="avertissement" titre="Points d'attention">
          <ul className="space-y-1.5">
            {result.warnings.map((w, i) => (
              <li key={i} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-texte-doux" />
                <span className={TEXTE_SOUPLE}>{texteMoteur(w)}</span>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      {/* Dispositifs complémentaires */}
      {dispositifs.length > 0 && <DispositifsOpco dispositifs={dispositifs} opcoName={opcoName} />}

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
                <span className={cx('pt-0.5', TEXTE_SOUPLE)}>{texteDonnees(etape)}</span>
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
                <span className={TEXTE_SOUPLE}>{texteDonnees(c)}</span>
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
                  <span className={TEXTE_SOUPLE}>{texteDonnees(step.label)}</span>
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
