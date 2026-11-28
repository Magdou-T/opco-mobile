import { COMPANY_SIZE_LABELS } from '@opco/core';
import type { PlafondTaille } from '@opco/core';
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge';
import { chiffresDeLaTaille } from '@/lib/fiche';
import { TexteDonnees } from './TexteDonnees';

/**
 * Plafonds par taille d'entreprise : une carte par tranche, chiffres clés d'abord (Montserrat, chiffres tabulaires ;
 * étiquette de fiabilité sur le plafond horaire quand elle n'est pas « exact »), puis la description, qui reste la
 * référence. Une adresse web longue dans la description passe à la ligne sans élargir la carte.
 * `titres` : les noms de tranche sont des titres h3 (section de la fiche) ou un simple texte (dans une branche).
 */
export function ListeTailles({
  plafonds,
  sigles,
  titres = true,
}: {
  plafonds: PlafondTaille[];
  sigles: Readonly<Record<string, string>> | undefined;
  titres?: boolean;
}) {
  const Titre = titres ? 'h3' : 'p';
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {plafonds.map((p) => {
        const chiffres = chiffresDeLaTaille(p);
        return (
          <li key={p.taille} className="min-w-0 rounded-carte border border-filet bg-white p-5 shadow-douce break-inside-avoid">
            <Titre className="font-display text-base leading-snug font-bold text-texte">{COMPANY_SIZE_LABELS[p.taille]}</Titre>
            {chiffres.length > 0 && (
              <dl className="mt-3 flex flex-wrap gap-x-7 gap-y-3">
                {chiffres.map((c) => (
                  <div key={c.libelle}>
                    <dt className="text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase">{c.libelle}</dt>
                    <dd className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="amount text-xl text-texte">{c.valeur}</span>
                      {c.confiance && c.confiance !== 'exact' && <ConfidenceBadge confidence={c.confiance} />}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {p.description && (
              <p className="mt-3 text-sm leading-relaxed text-texte-doux [overflow-wrap:anywhere]">
                <TexteDonnees texte={p.description} sigles={sigles} />
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
