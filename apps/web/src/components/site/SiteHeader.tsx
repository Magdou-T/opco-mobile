import Link from 'next/link';
import { Logo } from '@/components/site/Logo';
import { HorsDuSimulateur, LiensNavigation, MenuMobile } from '@/components/site/NavigationClient';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

/**
 * En-tête collant, composant serveur : seuls la page active et le menu mobile s'exécutent dans le navigateur
 * (NavigationClient.tsx). Une seule ligne collante à toutes les largeurs (64 px, puis 72 px dès 1 024 px) :
 * - à partir de 1 280 px : logo, navigation et bouton principal sur cette ligne ;
 * - de 1 024 à 1 279 px : logo et bouton principal ; la navigation suit sur une seconde ligne qui défile avec la page ;
 * - sous 1 024 px : logo et bouton « Menu ».
 * Le bouton principal s'efface sur la page du simulateur. `--hauteur-entete` (globals.css) suit la ligne collante.
 */
export function SiteHeader() {
  return (
    <>
      <header className="entete-site sticky top-0 z-50 border-b border-filet bg-white print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[4.5rem] xl:max-w-7xl xl:gap-4">
          {/* La visibilité selon la largeur se règle sur des enveloppes : une classe d'affichage passée au composant
              entrerait en conflit avec son propre `inline-flex`. */}
          <Link href="/" className="-m-1.5 shrink-0 rounded-xl p-1.5">
            <span className="block lg:hidden">
              <Logo taille="compacte" />
            </span>
            <span className="hidden lg:block">
              <Logo />
            </span>
          </Link>

          <nav aria-label="Navigation principale" className="ml-auto hidden xl:block">
            <LiensNavigation variante="ligne" />
          </nav>

          <HorsDuSimulateur>
            <div className="hidden shrink-0 lg:block">
              <Button href="/simulateur" size="md">
                Estimer mon financement
              </Button>
            </div>
          </HorsDuSimulateur>

          <MenuMobile
            iconeOuvrir={<Icon name="menu" className="size-5" />}
            iconeFermer={<Icon name="fermer" className="size-5" />}
          >
            <LiensNavigation variante="menu" chevron={<Icon name="chevron" className="size-4 text-texte-discret" />} />
            <HorsDuSimulateur>
              <div className="mx-auto max-w-6xl border-t border-filet px-4 pt-4 pb-5 sm:px-6">
                <Button href="/simulateur" size="lg" fleche pleineLargeur>
                  Estimer mon financement
                </Button>
              </div>
            </HorsDuSimulateur>
          </MenuMobile>
        </div>
      </header>

      {/* De 1 024 à 1 279 px, la navigation tient sur une seconde ligne, hors de l'en-tête collant : elle défile avec la
          page et l'en-tête ne garde que 72 px en haut de l'écran. */}
      <nav aria-label="Navigation principale" className="hidden border-b border-filet/70 bg-white lg:block xl:hidden print:hidden">
        <LiensNavigation variante="seconde-ligne" />
      </nav>
    </>
  );
}
