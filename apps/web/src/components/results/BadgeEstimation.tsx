import type { Confidence } from '@opco/core';
import { cx } from '@/lib/cx';
import { de } from '@/lib/format';

/**
 * Mention d'un montant de l'OPCO qui n'est pas exact (une ligne « exact » n'en porte aucune) : pilule à point de couleur
 * qui peut passer à la ligne (texte rouge sur rouge doux 5,62:1 ; texte doux sur lin-soft 7,68:1).
 */
export function BadgeEstimation({ confidence, opcoName }: { confidence: Confidence; opcoName: string }) {
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
