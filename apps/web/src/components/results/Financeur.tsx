import type { Financeur } from '@opco/core';
import { cx } from '@/lib/cx';
import { familleCouleur } from '@/lib/resultats';
import type { FamilleCouleur } from '@/lib/resultats';

/**
 * Couleur de chaque famille de financeurs (DESIGN.md, section 15), charte financementopco : segment de la barre empilée
 * et carré de légende des lignes du plan. Sept teintes distinctes de la palette : bleu de Prusse (OPCO), surligneur
 * (CPF), bleu clair (Région), ardoise (État et France Travail), filet foncé (fonds des non-salariés), encre (Europe),
 * filet (autres). Chaque segment porte un bord encre à 45 % (BORD_SEGMENT) : les teintes claires restent visibles sur
 * la feuille. `encre` reste la couleur d'un texte posé dessus (contraste AA : blanc sur prusse 10,71:1, sur ardoise
 * 7,46:1, sur encre 16,23:1 ; encre sur surligneur 11,93:1, sur bleu clair 10,07:1, sur filet foncé 8,09:1, sur filet
 * 10,25:1).
 */
export const COULEURS_FAMILLE: Record<FamilleCouleur, { fond: string; encre: string }> = {
  opco: { fond: 'bg-prusse', encre: 'text-white' },
  faf: { fond: 'bg-filet-fonce', encre: 'text-texte' },
  cpf: { fond: 'bg-surligneur', encre: 'text-texte' },
  region: { fond: 'bg-bleu-clair', encre: 'text-texte' },
  etat: { fond: 'bg-ardoise', encre: 'text-white' },
  europe: { fond: 'bg-encre', encre: 'text-white' },
  autre: { fond: 'bg-filet', encre: 'text-texte' },
};


/**
 * Bord d'un segment ou d'une pastille de légende : encre à 45 % sur la couleur de la famille, pour que les teintes claires
 * restent visibles sur la feuille (WCAG 1.4.11) : bord du surligneur 3,66:1, du filet 4,03:1, du bleu clair 4,07:1, contre
 * 1,36:1, 1,58:1 et 1,50:1 sans lui. À 35 %, le bord du surligneur tombait à 2,85:1.
 */
export const BORD_SEGMENT = 'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--encre)_45%,transparent)]';

/**
 * Reste à charge : la feuille dans un cadre encre en pointillés (le vocabulaire « selon branche » du kit), jamais une
 * couleur de financeur ni un aplat ; aucun dégradé (charte financementopco).
 */
export const SEGMENT_RESTE = 'border border-dashed border-encre bg-white';

/** Garde les couleurs de la barre et des pastilles à l'impression (fonds omis par défaut par les navigateurs). */
export const COULEURS_IMPRIMEES = '[print-color-adjust:exact] [-webkit-print-color-adjust:exact]';

/**
 * Repère d'un financeur dans les lignes du plan : un carré de la couleur de sa famille (clé de la barre empilée), sans
 * icône (charte financementopco : aucune icône décorative dans une pastille). Décoratif : le nom du financeur est
 * toujours écrit à côté. La boîte garde la largeur de l'ancienne pastille (40 ou 32 px) : le fil du plan reste aligné.
 */
export function PastilleFinanceur({
  financeur,
  taille = 'normale',
  className,
}: {
  financeur: Financeur;
  /** normale : boîte de 40 px (lignes du plan) ; petite : 32 px (en-têtes de groupe, lignes secondaires). */
  taille?: 'normale' | 'petite';
  className?: string;
}) {
  const { fond } = COULEURS_FAMILLE[familleCouleur(financeur)];
  return (
    <span
      aria-hidden="true"
      className={cx('grid shrink-0 place-items-center', taille === 'normale' ? 'size-10' : 'size-8', className)}
    >
      <span className={cx(taille === 'normale' ? 'size-3.5' : 'size-3', fond, BORD_SEGMENT, COULEURS_IMPRIMEES)} />
    </span>
  );
}
