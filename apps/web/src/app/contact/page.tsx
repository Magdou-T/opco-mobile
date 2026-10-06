import type { Metadata } from 'next';
import { ContactForm } from '@/components/site/ContactForm';

export const metadata: Metadata = {
  title: 'Nous contacter',
  description:
    'Une question sur le financement de votre formation, un projet à monter avec votre OPCO ? Écrivez à SFG Développement : réponse sous 48 h ouvrées.',
};

export default function ContactPage() {
  return (
    <main>
      <header className="border-b border-ink">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-16">
          <p className="marginalia mb-3">Contact · SFG Développement</p>
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            Parlons de votre
            <br />
            projet de <span className="mark">formation</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
            Un doute sur votre OPCO, un dossier de prise en charge à monter, un besoin de
            formation pour vos équipes : décrivez votre situation, un conseiller SFG
            Développement vous répond sous 48 h ouvrées.
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-4xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-[1fr_260px]">
        <ContactForm />

        <aside className="space-y-4">
          <div className="rounded border border-rule bg-white p-5">
            <div className="marginalia mb-2">Par email</div>
            <a
              href="mailto:contact@sfgdeveloppement.fr"
              className="break-all text-sm font-semibold text-cobalt hover:underline"
            >
              contact@sfgdeveloppement.fr
            </a>
          </div>
          <div className="rounded border border-rule bg-white p-5">
            <div className="marginalia mb-2">Ce que nous faisons</div>
            <p className="text-sm leading-relaxed text-ink-soft">
              SFG Développement accompagne les entreprises dans leurs projets de formation :
              bureautique et TOSA, langues, intelligence artificielle, santé et sécurité au
              travail, soft skills et certifications.
            </p>
          </div>
          <div className="rounded border border-marker bg-marker-soft p-5">
            <div className="marginalia mb-2 !text-valid">Bon à savoir</div>
            <p className="text-sm leading-relaxed text-ink-soft">
              Joignez le récapitulatif imprimable du simulateur à votre message : il contient
              toutes les informations utiles pour étudier votre prise en charge.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
