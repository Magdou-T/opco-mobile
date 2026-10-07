import type { Metadata } from 'next';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Page introuvable',
  description: "Cette adresse ne correspond à aucune page du site financementOPCO.",
};

/**
 * Page 404, dans le gabarit du site (en-tête et pied) : un message court et les trois pages utiles, le simulateur en
 * action principale. L'export statique la produit dans `out/404.html` (ErrorDocument de l'hébergement).
 */
export default function PageIntrouvable() {
  return (
    <main>
      <section aria-labelledby="titre-404" className="relative overflow-hidden">
        {/* Rail et jalons de la marque, le dernier jalon manquant (contour en tirets) : décor seul. */}
        <div aria-hidden="true" className="decor pointer-events-none absolute top-14 right-0 hidden w-[38%] md:block lg:top-20">
          <span className="absolute top-1/2 right-[-2rem] left-0 h-1.5 -translate-y-1/2 rounded-full bg-lin" />
          <span className="absolute top-1/2 left-0 h-1.5 w-[46%] -translate-y-1/2 rounded-full bg-turquoise" />
          {[12, 46].map((x) => (
            <span
              key={x}
              className="absolute top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[5px] border-white bg-turquoise"
              style={{ left: `${x}%` }}
            />
          ))}
          <span
            className="absolute top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-filet-fort bg-white"
            style={{ left: '80%' }}
          />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-20 sm:px-6 md:pt-20 md:pb-28">
          <p className="surtitre">Erreur 404</p>
          <h1 id="titre-404" className="mt-5 max-w-3xl text-affiche font-bold text-texte">
            Cette page <span className="mark">n&apos;existe pas</span>
          </h1>
          <p className="mt-6 max-w-xl text-chapeau text-texte-doux">
            L&apos;adresse est peut-être mal saisie, ou la page a changé de place.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button href="/simulateur/" size="lg" fleche pleineLargeur="mobile">
              Estimer mon financement
            </Button>
            <Button href="/opco/" variant="secondary" size="lg" pleineLargeur="mobile">
              Voir les 11 OPCO
            </Button>
            <Button href="/" variant="ghost" icone="retour">
              Retour à l&apos;accueil
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
