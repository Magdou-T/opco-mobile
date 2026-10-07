'use client';

import { useState } from 'react';
import type { AideEvaluee } from '@opco/core';
import { Button } from '@/components/ui/Button';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { Etiquette } from '@/components/ui/Etiquette';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import { dateFr, formatEuro, texteDonnees, typo } from '@/lib/format';
import { montantAffiche, nommerAides, sourcesDeLAide } from '@/lib/resultats';
import type { MontantAffiche } from '@/lib/resultats';

/**
 * Carte d'une aide éligible ou à vérifier (une aide non éligible n'a jamais de carte ni de montant) : statut écrit dans
 * une étiquette (Éligible en turquoise foncé, À vérifier en or à texte foncé), montant du moteur, règle de calcul,
 * description, points à confirmer, règle de cumul, détail dépliable (conditions, démarches, lien vers la demande, pages
 * officielles citées), puis fiabilité, date de vérification et un lien par site source en pied. À l'impression, le
 * détail est toujours visible.
 */
export function AideCard({ aide, nomParId }: { aide: AideEvaluee; nomParId: ReadonlyMap<string, string> }) {
  const [ouvert, setOuvert] = useState(false);
  const montant = montantAffiche(aide);
  const { pages, sites } = sourcesDeLAide(aide.sources);
  // Texte du catalogue : identifiants d'aides remplacés par leur nom, dates et typographie à la française.
  const texte = (s: string) => texteDonnees(nommerAides(s, nomParId));
  const eligible = aide.statut === 'eligible';
  const idTitre = `titre-aide-${aide.id}`;
  const idDetail = `detail-aide-${aide.id}`;
  const aUnDetail = aide.conditions.length > 0 || aide.demarches.length > 0 || aide.urlDemarche != null;
  const cumul = !aide.cumulable || aide.noteCumul ? (aide.noteCumul ?? 'Non cumulable avec les autres financements.') : null;

  return (
    <Card
      as="article"
      id={`aide-${aide.id}`}
      aria-labelledby={idTitre}
      padding="none"
      className="overflow-hidden break-words break-inside-avoid"
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <Etiquette tone={eligible ? 'turquoise' : 'or'}>{eligible ? 'Éligible' : 'À vérifier'}</Etiquette>
            <h4 id={idTitre} className="mt-3 text-lg leading-snug font-semibold text-texte">
              {typo(aide.nom)}
            </h4>
            <p className="mt-1 text-sm leading-snug text-texte-doux">{typo(aide.financeurNom)}</p>
          </div>
          {montant && <MontantDeLAide montant={montant} />}
        </div>

        {aide.libelleMontant && (
          <p className="mt-4 text-sm leading-relaxed font-medium text-texte">{texte(aide.libelleMontant)}</p>
        )}
        {aide.description && <p className="mt-2 text-sm leading-relaxed text-texte-doux">{texte(aide.description)}</p>}

        {aide.statut === 'a_verifier' && aide.raisons.length > 0 && (
          <Callout tone="avertissement" titre="Points à confirmer" className="mt-4">
            <ul className="space-y-1">
              {aide.raisons.map((r, i) => (
                <li key={i} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-texte-doux" />
                  <span>{texteDonnees(r)}</span>
                </li>
              ))}
            </ul>
          </Callout>
        )}

        {cumul && (
          <p className="mt-4 flex items-start gap-2.5 text-sm leading-relaxed text-texte-doux">
            <Icon name="virage" className="mt-0.5 size-4 shrink-0 text-turquoise-deep" />
            <span>
              <span className="font-semibold text-texte">Cumul&nbsp;:</span> {texte(cumul)}
            </span>
          </p>
        )}

        {aUnDetail && (
          <>
            <button
              type="button"
              aria-expanded={ouvert}
              aria-controls={idDetail}
              onClick={() => setOuvert((v) => !v)}
              className="mt-4 -ml-1 inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-semibold text-orange-deep underline-offset-4 hover:underline lg:min-h-9 print:hidden"
            >
              <Icon
                name="chevron"
                className={cx('size-4 shrink-0 transition-transform duration-200', ouvert && 'rotate-90')}
                strokeWidth={2}
              />
              {ouvert ? 'Masquer le détail' : 'Conditions et démarches'}
            </button>
            <div id={idDetail} className={cx('mt-4 space-y-5 border-t border-filet pt-5', !ouvert && 'hidden print:block')}>
              {aide.conditions.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-texte">Conditions</p>
                  <ul className="mt-2 space-y-1.5">
                    {aide.conditions.map((c, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-texte-doux">
                        <Icon name="coche" className="mt-0.5 size-4 shrink-0 text-turquoise-deep" strokeWidth={2} />
                        <span>{texte(c)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {aide.demarches.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-texte">Démarches</p>
                  <ol className="mt-2 space-y-2">
                    {aide.demarches.map((d, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-texte-doux">
                        <span
                          aria-hidden="true"
                          className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-turquoise font-display text-xs font-bold text-texte"
                        >
                          {i + 1}
                        </span>
                        <span className="pt-0.5">{texte(d)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {aide.urlDemarche && (
                <div className="print:hidden">
                  <Button href={aide.urlDemarche} variant="secondary" icone="lien-externe">
                    Faire la demande
                  </Button>
                </div>
              )}
              {pages.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-texte">Pages officielles citées</p>
                  <ul className="mt-2 space-y-1.5">
                    {pages.map((p) => (
                      <li key={p.url} className="flex items-start gap-2.5 text-sm leading-snug">
                        <Icon name="lien-externe" className="mt-0.5 size-4 shrink-0 text-orange-deep" />
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="lien">
                          {typo(p.titre)}
                          <span className="sr-only"> (nouvel onglet)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-filet bg-lin-soft px-5 py-3.5 text-xs text-texte-discret sm:px-6">
        <ConfidenceBadge confidence={aide.confidence} />
        <span>Vérifié le {dateFr(aide.derniereVerification)}</span>
        {sites.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{sites.length > 1 ? 'Sources' : 'Source'}&nbsp;:</span>
            <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {sites.map((s) => (
                <li key={s.site}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={s.titre}
                    className="lien inline-flex items-center gap-1"
                  >
                    {s.site}
                    <Icon name="lien-externe" className="size-3 shrink-0" />
                    <span className="sr-only"> ({s.titre}, nouvel onglet)</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </footer>
    </Card>
  );
}

function MontantDeLAide({ montant }: { montant: MontantAffiche }) {
  if (montant.genre === 'jusqua') {
    return (
      <p className="shrink-0 sm:text-right">
        <span className="block text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase">jusqu&apos;à</span>
        <span className="amount mt-0.5 block text-2xl text-texte sm:text-[1.75rem]">{formatEuro(montant.montant)}</span>
      </p>
    );
  }
  return (
    <p className="shrink-0 text-sm leading-snug font-semibold text-texte-doux sm:max-w-[11rem] sm:text-right">
      {montant.genre === 'selon_dossier' ? 'Montant selon dossier' : 'Aucun montant estimé pour ce profil'}
    </p>
  );
}
