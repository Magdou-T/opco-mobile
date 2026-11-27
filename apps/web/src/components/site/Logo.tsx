import { cx } from '@/lib/cx';

/**
 * Logo financementopco (kit d'identité de novembre 2026, piste « l'attestation ») : feuille, sceau jaune et nom, texte
 * vectorisé. Fichiers `public/logo-horizontal.svg` (fond clair) et `public/logo-horizontal-fond-sombre.svg` (fond encre :
 * rubans et « opco » en bleu clair). Jamais recoloré, déformé ni ombré ; zone de protection d'au moins la largeur du sceau
 * autour du logo ; 140 px de large au minimum (le logo compact en fait 182). La hauteur est fixée, la largeur suit le
 * rapport du fichier (523 x 103).
 *
 * Un simple <img> aux dimensions explicites : l'export statique ne transforme pas les images (images.unoptimized), et
 * next/image ajouterait son code client à chaque page pour rien.
 */
export interface LogoProps {
  /** Fond sur lequel le logo est posé. */
  fond?: 'clair' | 'sombre';
  /** Taille : compacte (en-tête sous 1 024 px, 36 px de haut) ou normale (44 px). */
  taille?: 'compacte' | 'normale';
  className?: string;
}

export function Logo({ fond = 'clair', taille = 'normale', className }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- export statique sans optimisation d'image (voir ci-dessus)
    <img
      src={fond === 'sombre' ? '/logo-horizontal-fond-sombre.svg' : '/logo-horizontal.svg'}
      alt="financementopco"
      width={523}
      height={103}
      decoding="async"
      className={cx('block w-auto', taille === 'compacte' ? 'h-9' : 'h-11', className)}
    />
  );
}
