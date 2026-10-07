import type { Financeur } from '@opco/core';
import { Icon } from '@/components/ui/Icon';
import type { IconName } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import { familleCouleur } from '@/lib/resultats';
import type { FamilleCouleur } from '@/lib/resultats';

/**
 * Couleur de chaque famille de financeurs (DESIGN.md, section 15) : fond de la pastille, du segment de la barre empilée
 * et de la pastille de légende ; `encre` est la couleur de l'icône posée dessus. Les couples icône / fond dépassent 3:1
 * (icône) : #1A1A1A sur turquoise 5,68:1, sur or 9,48:1, sur vert clair 10,37:1, sur orange 4,59:1 ; blanc sur
 * turquoise foncé 6,26:1, sur nuit 19,14:1, sur filet fort 3,54:1.
 */
export const COULEURS_FAMILLE: Record<FamilleCouleur, { fond: string; encre: string }> = {
  opco: { fond: 'bg-turquoise', encre: 'text-texte' },
  faf: { fond: 'bg-turquoise-deep', encre: 'text-white' },
  cpf: { fond: 'bg-or', encre: 'text-texte' },
  region: { fond: 'bg-vert-clair', encre: 'text-texte' },
  etat: { fond: 'bg-orange', encre: 'text-texte' },
  europe: { fond: 'bg-nuit', encre: 'text-white' },
  autre: { fond: 'bg-filet-fort', encre: 'text-white' },
};

/** Icône de chaque financeur, reprise des familles de l'accueil (« Ce que le simulateur recherche »). */
export const ICONE_FINANCEUR: Record<Financeur, IconName> = {
  opco: 'batiment',
  branche: 'batiment',
  faf: 'mallette',
  cpf: 'euro',
  region: 'repere',
  departement: 'repere',
  etat: 'document',
  france_travail: 'document',
  europe: 'globe',
  transitions_pro: 'fleche',
  agefiph: 'personne',
  fiscal: 'calculatrice',
  autre: 'info',
};

/**
 * Bord d'un segment ou d'une pastille de légende : encre à 35 % sur la couleur de la famille, pour que les teintes claires
 * (or, vert clair) restent visibles sur blanc (bord à 3,71:1 et 3,41:1 contre 1,84:1 et 1,68:1 sans lui).
 */
export const BORD_SEGMENT = 'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--encre)_35%,transparent)]';

/**
 * Reste à charge : rayures orange foncé de 2 px sur blanc (5,16:1 contre le blanc qui les sépare et qui entoure la
 * barre ; l'orange doux d'avant, à 1,12:1, ne se voyait pas), bord orange foncé plein, comme le chiffre « Reste à
 * charge » ; jamais une couleur de financeur ni un aplat (l'orange plein est celui de l'État et de France Travail).
 */
export const SEGMENT_RESTE =
  'bg-[repeating-linear-gradient(135deg,var(--orange-deep)_0_2px,var(--papier)_2px_6px)] shadow-[inset_0_0_0_1px_var(--orange-deep)]';

/** Garde les couleurs de la barre et des pastilles à l'impression (fonds omis par défaut par les navigateurs). */
export const COULEURS_IMPRIMEES = '[print-color-adjust:exact] [-webkit-print-color-adjust:exact]';

/**
 * Pastille ronde d'un financeur : couleur de sa famille et icône. Décorative : le nom du financeur est toujours écrit à
 * côté. Cerclée de blanc, elle se détache du fil qui relie les lignes du plan.
 */
export function PastilleFinanceur({
  financeur,
  taille = 'normale',
  className,
}: {
  financeur: Financeur;
  /** normale : 40 px (lignes du plan) ; petite : 32 px (en-têtes de groupe, lignes secondaires). */
  taille?: 'normale' | 'petite';
  className?: string;
}) {
  const { fond, encre } = COULEURS_FAMILLE[familleCouleur(financeur)];
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid shrink-0 place-items-center rounded-full ring-4 ring-white',
        taille === 'normale' ? 'size-10' : 'size-8',
        fond,
        encre,
        COULEURS_IMPRIMEES,
        className,
      )}
    >
      <Icon name={ICONE_FINANCEUR[financeur]} className={taille === 'normale' ? 'size-5' : 'size-4'} />
    </span>
  );
}
