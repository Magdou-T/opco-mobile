import { COMPANY_SIZE_LABELS } from '@opco/core';
import type { DispositifComplementaire } from '@opco/core';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { CumulBadge } from '@/components/ui/CumulBadge';
import { Icon } from '@/components/ui/Icon';
import { SourceBadge } from '@/components/ui/SourceBadge';
import { etapesDeDemarche, montantDuDispositif } from '@/lib/fiche';
import { CUMUL_EXPLICATIONS, typo } from '@/lib/format';
import { ListeIdcc } from './ListeIdcc';
import { TexteDonnees } from './TexteDonnees';

type Sigles = Readonly<Record<string, string>> | undefined;

/**
 * Carte d'un dispositif complémentaire : nom et règle de cumul (étiquette), montant s'il est publié, description, public,
 * tailles et conventions collectives concernées, conditions (liste à coches), démarche (étapes numérotées, ou une
 * phrase), précision, fiabilité et source.
 */
export function CarteDispositif({ d, sigles }: { d: DispositifComplementaire; sigles: Sigles }) {
  const montant = montantDuDispositif(d);
  const etapes = etapesDeDemarche(d.demarches);
  const idcc = d.idcc ?? [];
  const idTitre = `dispositif-${d.id}`;
  const aDesCriteres = !!d.publics || !!d.tailles_eligibles || idcc.length > 0;
  return (
    <article
      aria-labelledby={idTitre}
      className="rounded-carte border border-filet bg-white p-5 shadow-douce break-inside-avoid [overflow-wrap:anywhere] sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h3 id={idTitre} className="min-w-0 flex-1 text-lg leading-snug font-bold text-texte">
          <TexteDonnees texte={d.nom} sigles={sigles} />
        </h3>
        <CumulBadge cumul={d.cumul} />
      </div>
      {montant && <p className="mt-2 font-display text-lg leading-snug font-semibold text-turquoise-deep">{montant}</p>}
      <p className="mt-3 text-sm leading-relaxed text-texte-doux">
        <TexteDonnees texte={d.description} sigles={sigles} />
      </p>

      {aDesCriteres && (
        <dl className="mt-4 grid gap-x-4 gap-y-1.5 text-sm leading-relaxed sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
          {d.publics && (
            <>
              <dt className="font-semibold text-texte">Public visé</dt>
              <dd className="text-texte-doux">
                <TexteDonnees texte={d.publics} sigles={sigles} />
              </dd>
            </>
          )}
          {d.tailles_eligibles && (
            <>
              <dt className="font-semibold text-texte">Entreprises concernées</dt>
              <dd className="text-texte-doux">{d.tailles_eligibles.map((t) => COMPANY_SIZE_LABELS[t]).join(', ')}</dd>
            </>
          )}
          {idcc.length > 0 && (
            <>
              <dt className="font-semibold text-texte">Réservé aux conventions collectives</dt>
              <dd className="text-texte-doux">
                <ListeIdcc codes={idcc} />
              </dd>
            </>
          )}
        </dl>
      )}

      {d.conditions.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-texte">Conditions</p>
          <ul className="mt-2 space-y-1.5">
            {d.conditions.map((c, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-texte-doux">
                <Icon name="coche" className="mt-0.5 size-4 shrink-0 text-turquoise-deep" strokeWidth={2} />
                <span className="min-w-0">
                  <TexteDonnees texte={c} sigles={sigles} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {etapes.length > 1 ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-texte">Démarche</p>
          <ol className="mt-2 space-y-2">
            {etapes.map((e, i) => (
              <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-texte-doux">
                <span
                  aria-hidden="true"
                  className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-turquoise font-display text-xs font-bold text-texte"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 pt-0.5">
                  <TexteDonnees texte={e} sigles={sigles} />
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        etapes.length === 1 && (
          <p className="mt-4 text-sm leading-relaxed text-texte-doux">
            <span className="font-semibold text-texte">Démarche&nbsp;:</span> <TexteDonnees texte={etapes[0]} sigles={sigles} />
          </p>
        )
      )}

      {d.note && (
        <p className="mt-4 text-xs leading-relaxed text-texte-discret">
          <TexteDonnees texte={d.note} sigles={sigles} />
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-filet pt-4">
        <ConfidenceBadge confidence={d.confidence} />
        <SourceBadge url={d.source_url} />
      </div>
    </article>
  );
}

/** Légende des règles de cumul présentes parmi les dispositifs de la fiche (étiquette, puis ce qu'elle veut dire). */
export function LegendeCumul({ cumuls }: { cumuls: DispositifComplementaire['cumul'][] }) {
  if (cumuls.length === 0) return null;
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cumuls.map((cumul) => (
        <div key={cumul} className="rounded-2xl border border-filet bg-lin-soft p-4">
          <dt>
            <CumulBadge cumul={cumul} />
          </dt>
          <dd className="mt-2 text-sm leading-relaxed text-texte-doux">{typo(CUMUL_EXPLICATIONS[cumul])}</dd>
        </div>
      ))}
    </dl>
  );
}
