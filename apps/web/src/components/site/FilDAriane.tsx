import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import type { Etape } from '@/lib/donnees-structurees';

/**
 * Fil d'Ariane visible (le même que celui des fiches d'OPCO) : l'accueil, les étapes intermédiaires, puis la page,
 * marquée `aria-current`. Les données structurées décrivent le même chemin (`noeudFilDAriane`).
 */
export function FilDAriane({ page, intermediaires = [] }: { page: string; intermediaires?: readonly Etape[] }) {
  const etapes: Etape[] = [{ nom: 'Accueil', chemin: '/' }, ...intermediaires];
  return (
    <nav aria-label="Fil d'Ariane" className="text-sm print:hidden">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-texte-doux">
        {etapes.map((e) => (
          <li key={e.chemin} className="flex items-center gap-x-2">
            <Link href={e.chemin} className="lien">
              {e.nom}
            </Link>
            <Icon name="chevron" className="size-3.5 text-texte-discret" strokeWidth={2} />
          </li>
        ))}
        <li aria-current="page" className="font-medium text-texte">
          {page}
        </li>
      </ol>
    </nav>
  );
}
