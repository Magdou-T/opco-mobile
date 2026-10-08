import type { Metadata } from 'next';
import { ContactForm } from '@/components/site/ContactForm';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { Etiquette } from '@/components/ui/Etiquette';
import { Icon } from '@/components/ui/Icon';
import { CONTACT_EMAIL } from '@/lib/contact';
import { DOMAINES_DE_FORMATION } from '@/lib/domaines';
import { PAGES, metadonnees } from '@/lib/metadonnees';

export const metadata: Metadata = metadonnees(PAGES.contact);

export default function ContactPage() {
  return (
    <main>
      <header className="border-b border-filet/70">
        <div className="mx-auto max-w-6xl px-4 pt-10 pb-12 sm:px-6 md:pt-14 md:pb-16">
          <p className="surtitre">Contact · SFG Développement</p>
          <h1 className="mt-5 max-w-4xl text-affiche font-bold text-texte">
            Parlons de votre
            <br />
            projet de <span className="mark">formation</span>
          </h1>
          <p className="mt-6 max-w-2xl text-chapeau text-texte-doux">
            Un doute sur votre OPCO, un dossier de prise en charge à monter, un besoin de formation pour vos
            équipes&nbsp;: décrivez votre situation, un conseiller SFG Développement vous répond sous 48&nbsp;h ouvrées.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 md:py-14 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
        <Card padding="lg" className="min-w-0">
          <ContactForm />
        </Card>

        <aside aria-label="SFG Développement" className="min-w-0 space-y-4">
          <Card tone="teintee" padding="md">
            {/* eslint-disable-next-line @next/next/no-img-element -- export statique sans optimisation d'image (voir Logo.tsx) */}
            <img src="/logo-sfg.png" alt="SFG Développement" width={426} height={224} className="block h-12 w-auto" />
            <p className="mt-5 text-sm leading-relaxed text-texte-doux">
              SFG Développement accompagne les entreprises dans leurs projets de formation&nbsp;:
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {DOMAINES_DE_FORMATION.map((d) => (
                <Etiquette key={d.label} as="li" tone={d.tone}>
                  {d.label}
                </Etiquette>
              ))}
            </ul>
            <div className="mt-6 border-t border-filet pt-4">
              <p className="text-xs font-semibold tracking-[0.12em] text-texte-discret uppercase">Par e-mail</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="lien mt-1.5 inline-flex min-h-11 max-w-full items-center gap-2 text-sm break-words lg:min-h-0"
              >
                <Icon name="courriel" className="size-[18px] shrink-0" />
                {CONTACT_EMAIL}
              </a>
            </div>
          </Card>
          <Callout tone="confirmation" titre="Bon à savoir">
            Joignez le récapitulatif imprimable du simulateur à votre message&nbsp;: il contient toutes les informations
            utiles pour étudier votre prise en charge.
          </Callout>
        </aside>
      </div>
    </main>
  );
}
