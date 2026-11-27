import type { Metadata } from 'next';
import { DonneesStructurees } from '@/components/site/DonneesStructurees';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { WizardContainer } from '@/components/wizard/WizardContainer';
import { ID_EDITEUR, adresseAbsolue, grapheDePage } from '@/lib/donnees-structurees';
import { PAGES, metadonnees } from '@/lib/metadonnees';

export const metadata: Metadata = metadonnees(PAGES.simulateur);

/** Le simulateur décrit comme une application web gratuite (Schema.org WebApplication). */
const GRAPHE = grapheDePage({
  chemin: PAGES.simulateur.chemin,
  titre: PAGES.simulateur.titre,
  description: PAGES.simulateur.description,
  nomCourt: 'Simulateur',
  autres: [
    {
      '@type': 'WebApplication',
      '@id': `${adresseAbsolue(PAGES.simulateur.chemin)}#application`,
      name: 'Simulateur de financement de formation financementopco',
      url: adresseAbsolue(PAGES.simulateur.chemin),
      description: PAGES.simulateur.description,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Tout navigateur web récent',
      browserRequirements: 'JavaScript activé',
      inLanguage: 'fr-FR',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      publisher: { '@id': ID_EDITEUR },
      featureList: [
        "Identification de l'OPCO à partir du nom ou du SIREN de l'entreprise",
        "Application des barèmes 2026 de l'OPCO au projet de formation",
        "Recherche des aides du CPF, de la Région, de France Travail, de Transitions Pro, de l'Agefiph et du FSE+",
        'Plan de financement imprimable, chaque aide avec sa source officielle',
      ],
    },
  ],
});

export default function SimulateurPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
      <DonneesStructurees graphe={GRAPHE} />
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
