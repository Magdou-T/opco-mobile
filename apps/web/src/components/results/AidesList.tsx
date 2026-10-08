'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { AideEvaluee } from '@opco/core';
import { Callout } from '@/components/ui/Callout';
import { Icon } from '@/components/ui/Icon';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { cx } from '@/lib/cx';
import { texteDonnees, typo } from '@/lib/format';
import { ID_SECTION_AIDES } from '@/lib/encadres-resultats';
import { aidesNonEligiblesAffichees, groupesAidesVisibles } from '@/lib/resultats';
import type { GroupeAides } from '@/lib/resultats';
import { AideCard } from './AideCard';
import { TEXTE_SOUPLE } from './classes';
import { PastilleFinanceur } from './Financeur';

/**
 * Toutes les aides et tous les financements identifiés (éligibles et à vérifier), groupés par financeur dans l'ordre de
 * la liste évaluée ; les aides non éligibles, repliées et sans montant ; jamais celles d'un autre projet, public, région
 * ou type de formation.
 */
export function AidesList({ aides, avecPortail }: { aides: readonly AideEvaluee[]; avecPortail: boolean }) {
  const groupes = groupesAidesVisibles(aides);
  const total = groupes.reduce((n, g) => n + g.aides.length, 0);
  const nonEligibles = aidesNonEligiblesAffichees(aides);
  // Toutes les aides évaluées (le catalogue entier) : nom de l'aide que cite un texte par son identifiant.
  const nomParId = new Map(aides.map((a) => [a.id, a.nom]));

  return (
    // La section est la cible du lien « N aides à vérifier » du bandeau (encadreSansFinancement).
    <section id={ID_SECTION_AIDES} aria-labelledby="titre-aides" className="space-y-8">
      <SectionTitle
        as="h2"
        taille="sous-section"
        id="titre-aides"
        surtitre="Par financeur"
        titre={`Aides et financements identifiés (${total})`}
        chapeau={
          <>
            «&nbsp;À vérifier&nbsp;»&nbsp;: une information manque ou le financeur doit confirmer&nbsp;; ces aides ne sont
            pas comptées dans le plan.
          </>
        }
      />
      {total === 0 ? (
        <Callout tone="info">
          Aucune autre aide identifiée pour cette situation
          {avecPortail ? <>&nbsp;: consultez les portails de votre région ci-dessous.</> : '.'}
        </Callout>
      ) : (
        groupes.map((g, i) => (
          <GroupeDuFinanceur key={g.financeur} groupe={g} nomParId={nomParId} style={delai(i * 60)} />
        ))
      )}
      {nonEligibles.length > 0 && <AidesNonEligibles aides={nonEligibles} />}
    </section>
  );
}

const delai = (ms: number) => ({ '--delai': `${Math.min(ms, 360)}ms` }) as CSSProperties;

function GroupeDuFinanceur({
  groupe,
  nomParId,
  style,
}: {
  groupe: GroupeAides;
  nomParId: ReadonlyMap<string, string>;
  style: CSSProperties;
}) {
  const id = `groupe-${groupe.financeur}`;
  const nombre = groupe.aides.length;
  return (
    <section aria-labelledby={id} className="apparition" style={style}>
      <div className="flex items-center gap-3 border-b border-filet pb-3">
        <PastilleFinanceur financeur={groupe.financeur} taille="petite" />
        <h3 id={id} className="min-w-0 text-lg leading-snug font-bold text-texte">
          {typo(groupe.titre)}
        </h3>
        <span className="ml-auto shrink-0 text-sm font-medium text-texte-discret">
          {nombre}&nbsp;{nombre > 1 ? 'aides' : 'aide'}
        </span>
      </div>
      <ul className="mt-4 space-y-4">
        {groupe.aides.map((a) => (
          <li key={a.id}>
            <AideCard aide={a} nomParId={nomParId} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Aides non éligibles pour cette situation : repliées, nom, financeur et raisons, sans aucun montant. */
function AidesNonEligibles({ aides }: { aides: AideEvaluee[] }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="rounded-carte border border-filet/60 bg-lin-soft p-4 sm:p-5">
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls="aides-non-eligibles"
        onClick={() => setOuvert((v) => !v)}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-xl text-left font-semibold text-texte transition-[color] hover:text-orange-deep"
      >
        <Icon
          name="chevron"
          className={cx('size-4 shrink-0 transition-transform duration-200 print:hidden', ouvert && 'rotate-90')}
          strokeWidth={2}
        />
        Aides non éligibles pour cette situation ({aides.length})
      </button>
      <ul
        id="aides-non-eligibles"
        className={cx('mt-3 space-y-4 border-t border-filet pt-4', !ouvert && 'hidden print:block')}
      >
        {aides.map((a) => (
          <li key={a.id} className="break-inside-avoid">
            <p className="leading-snug font-semibold text-texte">{typo(a.nom)}</p>
            <p className="mt-0.5 text-sm text-texte-discret">{typo(a.financeurNom)}</p>
            <ul className="mt-1.5 space-y-0.5">
              {a.raisons.map((r, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-texte-doux">
                  <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-filet-fort" />
                  <span className={TEXTE_SOUPLE}>{texteDonnees(r)}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
