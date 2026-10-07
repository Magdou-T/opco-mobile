import { Fragment } from 'react';
import type { CoutHoraireSeuil, ModeSeuils } from '@opco/core';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { Icon } from '@/components/ui/Icon';
import { SourceBadge } from '@/components/ui/SourceBadge';
import { cx } from '@/lib/cx';
import { legendeDuBareme, libelleValeurAbsente, tranchesDegressives } from '@/lib/fiche';
import type { Affichage, LigneBareme, PrecisionDuPoste } from '@/lib/fiche';
import { TexteDonnees } from './TexteDonnees';

/** En-tête de colonne : Inter 600 en petites majuscules, texte discret (4,95:1 sur lin-soft). */
const EN_TETE = 'px-4 py-3 text-left text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase';

type Sigles = Readonly<Record<string, string>> | undefined;

/** Montant d'une ligne, ou le libellé de son absence (le renvoi cite ce qui est visible dans cette présentation). */
function Montant({ ligne, affichage }: { ligne: LigneBareme; affichage: Affichage }) {
  if (ligne.montant) {
    return (
      <span className={cx('amount block leading-tight text-texte', affichage === 'cartes' ? 'text-2xl' : 'text-xl')}>
        {ligne.montant}
      </span>
    );
  }
  return (
    <span className="block text-sm leading-snug font-medium text-texte-discret">
      {libelleValeurAbsente(ligne.absente ?? 'sans_montant_fixe', affichage)}
    </span>
  );
}

/**
 * Précision d'un poste : la règle en une phrase, puis la note complète à la demande (« Voir la précision ») quand elle
 * en dit davantage. Une adresse web longue passe à la ligne sans élargir la colonne ni la carte.
 */
function Precision({ precision, poste, sigles }: { precision: PrecisionDuPoste; poste: string; sigles: Sigles }) {
  return (
    <div className="[overflow-wrap:anywhere]">
      <p className="text-sm leading-relaxed text-texte-doux">
        <TexteDonnees texte={precision.resume} sigles={sigles} />
      </p>
      {precision.complete && (
        <details className="group/precision mt-1">
          <summary className="-ml-1 inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-orange-deep underline-offset-4 hover:underline md:min-h-9 print:hidden [&::-webkit-details-marker]:hidden">
            <Icon
              name="chevron"
              className="size-4 shrink-0 transition-transform duration-200 group-open/precision:rotate-90"
              strokeWidth={2}
            />
            <span className="group-open/precision:hidden">Voir la précision</span>
            <span className="hidden group-open/precision:inline">Masquer la précision</span>
            {/* Les liens « Voir la précision » se suivent : le poste les distingue pour les lecteurs d'écran. */}
            <span className="sr-only"> : {poste}</span>
          </summary>
          <p className="mt-1 mb-1 text-sm leading-relaxed text-texte-discret">
            <TexteDonnees texte={precision.complete} sigles={sigles} />
          </p>
        </details>
      )}
    </div>
  );
}

/**
 * Barème poste par poste, en deux présentations rendues par le serveur :
 * - à partir de 768 px, un tableau (en-tête collant sous l'en-tête du site, poste en titre de ligne, montant en gros et
 *   sa fiabilité, précision, source) ;
 * - en dessous, une carte par poste (aucun défilement horizontal) : poste et fiabilité, montant, règle en une phrase,
 *   précision complète à la demande, source.
 */
export function Bareme({ lignes, legende, sigles }: { lignes: LigneBareme[]; legende: string; sigles: Sigles }) {
  return (
    <>
      <div className="hidden md:block">
        <div className="overflow-clip rounded-carte border border-filet bg-white shadow-douce">
          {/* Les liens et blocs du corps du tableau s'arrêtent sous son en-tête collant (48 px) quand le focus les ramène
              à l'écran par le haut : `scroll-padding-top` ne compte que l'en-tête du site. */}
          <table className="w-full table-fixed border-collapse text-sm [&_tbody_:is(a,summary)]:scroll-mt-12">
            <caption className="sr-only">{legende}</caption>
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[20%]" />
              <col />
              <col className="w-28" />
            </colgroup>
            <thead>
              <tr>
                {['Poste', 'Montant', 'Précision', 'Source'].map((t) => (
                  <th
                    key={t}
                    scope="col"
                    className={cx(EN_TETE, 'sticky top-(--hauteur-entete) z-10 bg-lin-soft shadow-[inset_0_-1px_0_var(--filet)]')}
                  >
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-filet">
              {lignes.map((l) => (
                <tr key={l.cle} className="align-top">
                  <th scope="row" className="px-4 py-4 text-left leading-snug font-semibold text-texte">
                    {l.libelle}
                  </th>
                  <td className="px-4 py-4">
                    <Montant ligne={l} affichage="tableau" />
                    <div className="mt-2">
                      <ConfidenceBadge confidence={l.confiance} />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {l.precision && <Precision precision={l.precision} poste={l.libelle} sigles={sigles} />}
                  </td>
                  <td className="px-4 py-4">{l.source && <SourceBadge url={l.source} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ul aria-label={legende} className="space-y-3 md:hidden">
        {lignes.map((l) => (
          <li key={l.cle} className="rounded-carte border border-filet bg-white p-4 shadow-douce break-inside-avoid">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <p className="min-w-0 flex-1 leading-snug font-semibold text-texte">{l.libelle}</p>
              <ConfidenceBadge confidence={l.confiance} />
            </div>
            <div className="mt-2">
              <Montant ligne={l} affichage="cartes" />
            </div>
            {l.precision && (
              <div className="mt-2">
                <Precision precision={l.precision} poste={l.libelle} sigles={sigles} />
              </div>
            )}
            {l.source && (
              <div className="mt-3">
                <SourceBadge url={l.source} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Légende des libellés de montant absent, seulement ceux qui sont affichés, une par présentation : le renvoi à la
 * précision cite la colonne « Précision » au-dessus du tableau et le texte « ci-dessous » au-dessus des cartes.
 */
export function LegendeBareme({ lignes }: { lignes: LigneBareme[] }) {
  return (
    <>
      {(['cartes', 'tableau'] as const).map((affichage) => {
        const entrees = legendeDuBareme(lignes, affichage);
        if (entrees.length === 0) return null;
        return (
          <dl
            key={affichage}
            className={cx(
              'gap-x-4 gap-y-2 rounded-2xl border border-filet bg-lin-soft p-4 text-sm leading-relaxed sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]',
              affichage === 'cartes' ? 'grid md:hidden' : 'hidden md:grid',
            )}
          >
            {entrees.map((e) => (
              <Fragment key={e.genre}>
                <dt className="font-semibold text-texte">«&nbsp;{e.libelle}&nbsp;»</dt>
                <dd className="text-texte-doux">{e.explication}</dd>
              </Fragment>
            ))}
          </dl>
        );
      })}
    </>
  );
}

/** Barème dégressif selon la durée de la formation (Uniformation, par exemple). */
export function BaremeDegressif({
  seuils,
  mode,
  certifiant,
}: {
  seuils: CoutHoraireSeuil[];
  mode: ModeSeuils | undefined;
  certifiant: boolean | undefined;
}) {
  return (
    <div className="rounded-2xl border border-vert-clair bg-vert-clair-soft p-4 sm:p-5">
      <p className="font-semibold text-texte">Barème dégressif selon la durée</p>
      <p className="mt-1 text-sm leading-relaxed text-texte-doux">
        {mode === 'selon_duree_totale'
          ? "Un seul taux s'applique à toute la formation, choisi selon sa durée totale"
          : "Chaque tranche d'heures est financée à son propre taux"}
        {certifiant && <>&nbsp;; ce barème ne vaut que pour les formations certifiantes</>}.
      </p>
      <ul className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
        {tranchesDegressives(seuils, mode).map((t) => (
          <li key={t.libelle} className="text-sm text-texte-doux">
            {t.libelle}&nbsp;: <span className="amount text-lg text-texte">{t.valeur}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
