import Image from 'next/image';

/**
 * Logo SFG Développement suivi du nom du service, « financementOPCO » en Montserrat (OPCO en orange), séparés par un
 * filet vertical. Le fichier du logo (public/logo-sfg.png, 426 x 224) n'est ni redessiné ni recoloré : ses couleurs
 * gardent un contraste suffisant sur l'encre (turquoise 5,55:1, orange 4,98:1), seule la typographie du nom passe en
 * clair sur fond sombre (`fond="sombre"`). La hauteur est fixée, la largeur suit le ratio : le logo ne se déforme pas.
 * Au survol du lien qui l'entoure, un reflet balaie le logo (masqué par le logo lui-même).
 */
export interface LogoProps {
  /** Fond sur lequel le logo est posé. */
  fond?: 'clair' | 'sombre';
  /** Taille : compacte (en-tête mobile) ou normale. */
  taille?: 'compacte' | 'normale';
  className?: string;
}

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const MASQUE = { maskImage: 'url(/logo-sfg.png)', WebkitMaskImage: 'url(/logo-sfg.png)' } as const;

export function Logo({ fond = 'clair', taille = 'normale', className }: LogoProps) {
  const sombre = fond === 'sombre';
  const compacte = taille === 'compacte';
  return (
    <span className={cx('inline-flex items-center', compacte ? 'gap-2.5' : 'gap-3', className)}>
      <span className="relative block shrink-0">
        <Image
          src="/logo-sfg.png"
          alt="SFG Développement"
          width={426}
          height={224}
          unoptimized
          loading="eager"
          className={cx('block w-auto', compacte ? 'h-8' : 'h-10')}
        />
        <span aria-hidden="true" className="logo-reflet" style={MASQUE} />
      </span>
      <span aria-hidden="true" className={cx('w-px self-stretch', sombre ? 'bg-white/25' : 'bg-filet')} />
      <span
        className={cx(
          'font-display leading-none font-bold tracking-[-0.02em]',
          compacte ? 'text-[0.9375rem]' : 'text-[1.0625rem]',
          sombre ? 'text-white' : 'text-texte',
        )}
      >
        financement<span className={sombre ? 'text-orange-clair' : 'text-orange-deep'}>OPCO</span>
      </span>
    </span>
  );
}
