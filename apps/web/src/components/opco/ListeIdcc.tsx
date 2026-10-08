import { Icon } from '@/components/ui/Icon';
import { idccRepliees } from '@/lib/fiche';

/**
 * Codes de convention collective (IDCC) d'une branche ou d'un dispositif : cités tels quels jusqu'à 6, repliés au-delà
 * (`idccRepliees` : « 76 conventions collectives », dépliable ; ouverts à l'impression).
 */
export function ListeIdcc({ codes }: { codes: readonly string[] }) {
  if (codes.length === 0) return null;
  if (!idccRepliees(codes)) return <>IDCC {codes.join(', ')}</>;
  return (
    <details className="group/idcc">
      <summary className="-ml-1 inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full px-1 font-semibold text-orange-deep underline-offset-4 hover:underline md:min-h-9 [&::-webkit-details-marker]:hidden">
        <Icon name="chevron" className="size-4 shrink-0 transition-transform duration-200 group-open/idcc:rotate-90" strokeWidth={2} />
        {codes.length}&nbsp;conventions collectives
      </summary>
      <p className="mt-1 [overflow-wrap:anywhere]">IDCC {codes.join(', ')}</p>
    </details>
  );
}
