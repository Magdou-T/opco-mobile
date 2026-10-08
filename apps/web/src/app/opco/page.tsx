import type { Metadata } from 'next';
import Link from 'next/link';
import { EMBEDDED_OPCOS } from '@opco/core';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Etiquette } from '@/components/ui/Etiquette';
import { Icon } from '@/components/ui/Icon';
import { extrait } from '@/lib/extrait';
import { trierParNom } from '@/lib/fiche';
import { dateFr, typo } from '@/lib/format';
import { PAGES, metadonnees } from '@/lib/metadonnees';

export const metadata: Metadata = metadonnees(PAGES.opco);

/** Ligne de secteurs d'une carte : extrait de 110 caractères au plus (`lib/extrait.ts`), typographie française. */
const secteurs = (texte: string): string => typo(extrait(texte, 110));

/** Les OPCO dans l'ordre alphabétique (article élidé ignoré : L'Opcommerce se range à O). */
const OPCOS = trierParNom(EMBEDDED_OPCOS);

export default function OpcoIndexPage() {
  return (
    <main>
      <header className="border-b border-filet/70">
        <div className="mx-auto max-w-6xl px-4 pt-10 pb-12 sm:px-6 md:pt-14 md:pb-16">
          <p className="surtitre">Le répertoire · critères 2026</p>
          <h1 className="mt-5 max-w-4xl text-affiche font-bold text-texte">
            Les {OPCOS.length} <span className="mark">opérateurs</span> de compétences
          </h1>
          <p className="mt-5 max-w-2xl text-chapeau text-texte-doux">
            Chaque entreprise relève d&apos;un seul OPCO, déterminé par sa convention collective (code IDCC). Chaque fiche
            rassemble les barèmes publiés, leur source officielle et les dispositifs complémentaires&nbsp;: certains
            s&apos;ajoutent à votre budget, d&apos;autres ont leur propre enveloppe ou remplacent le plan de développement
            des compétences.
          </p>
          <div className="mt-8">
            <Button href="/simulateur/" size="lg" fleche pleineLargeur="mobile">
              Estimer mon financement
            </Button>
          </div>
        </div>
      </header>

      <section aria-labelledby="titre-fiches" className="bg-lin-soft">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
          <h2 id="titre-fiches" className="sr-only">
            Fiches des {OPCOS.length} OPCO, par ordre alphabétique
          </h2>
          {/* La liste ne compte que les OPCO ; `contents` range ses cartes dans la grille, à côté de la tuile qui la
              suit (12 cases : 2, 3 ou 4 colonnes pleines). */}
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            <ul role="list" className="contents">
              {OPCOS.map((o) => (
                <Card as="li" key={o.slug} interactive padding="none" className="group flex min-w-0 flex-col">
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="pr-8 text-lg leading-snug font-bold tracking-[-0.01em] text-texte">
                      <Link href={`/opco/${o.slug}/`} className="lien-etendu">
                        {o.name}
                      </Link>
                    </h3>
                    {o.nom_complet && <p className="mt-1 text-sm leading-snug font-medium text-texte-doux">{typo(o.nom_complet)}</p>}
                    <p className="mt-3 text-sm leading-relaxed text-texte-discret">{secteurs(o.secteurs)}</p>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-5">
                      {o.derniere_verification && (
                        <Etiquette tone="turquoise">Vérifié le {dateFr(o.derniere_verification)}</Etiquette>
                      )}
                      <span aria-hidden="true" className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-deep">
                        Voir la fiche
                        <Icon name="fleche" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </ul>
            <Card tone="teintee" interactive padding="none" className="group flex flex-col">
              <div className="flex flex-1 flex-col p-5">
                <p className="pr-8 font-display text-lg leading-snug font-bold tracking-[-0.01em] text-texte">
                  <Link href="/simulateur/" className="lien-etendu">
                    Vous ne connaissez pas votre OPCO
                  </Link>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-texte-doux">
                  Le simulateur l&apos;identifie à partir du nom ou du SIREN de votre entreprise, via la base officielle
                  des conventions collectives.
                </p>
                <span aria-hidden="true" className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-orange-deep">
                  Identifier mon OPCO
                  <Icon name="fleche" className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
