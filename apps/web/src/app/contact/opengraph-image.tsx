import { imageDePartage, TAILLE_IMAGE, TYPE_IMAGE } from '@/lib/image-de-partage';
import { PAGES } from '@/lib/metadonnees';

// Image de partage de la page : son titre, sur le gabarit commun (lib/image-de-partage.tsx).
export const alt = PAGES.contact.titre;
export const size = TAILLE_IMAGE;
export const contentType = TYPE_IMAGE;
// Export statique : l'image est produite une fois, au build.
export const dynamic = 'force-static';

export default function Image() {
  return imageDePartage({
    surtitre: 'Contact · réponse sous 48 h ouvrées',
    titre: PAGES.contact.titre,
  });
}
