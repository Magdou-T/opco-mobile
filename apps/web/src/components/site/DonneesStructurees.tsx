import { serialiser } from '@/lib/donnees-structurees';
import type { Graphe } from '@/lib/donnees-structurees';

/**
 * Balise JSON-LD d'une page (composant serveur, aucun code envoyé au navigateur). Une balise <script> native, comme le
 * recommande la documentation de Next.js : ce ne sont pas des instructions à exécuter mais une description de la page.
 */
export function DonneesStructurees({ graphe }: { graphe: Graphe }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialiser(graphe) }} />;
}
