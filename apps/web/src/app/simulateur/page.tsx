import type { Metadata } from 'next';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { WizardContainer } from '@/components/wizard/WizardContainer';
import { PAGES, metadonnees } from '@/lib/metadonnees';

export const metadata: Metadata = metadonnees(PAGES.simulateur);

export default function SimulateurPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
      <SectionTitle
        as="h1"
        surtitre="Simulateur · 6 étapes · environ 5&nbsp;minutes"
        titre="Trouvez tous les financements de votre formation"
        chapeau="Répondez aux questions&nbsp;: le site identifie votre OPCO, recherche toutes les aides et tous les financements mobilisables et estime votre reste à charge. Chaque aide est accompagnée de sa source officielle et de son niveau de fiabilité&nbsp;; les estimations sont signalées."
        className="mb-8 sm:mb-10 print:hidden"
      />
      <WizardContainer />
    </main>
  );
}
