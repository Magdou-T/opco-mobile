import { imageDePartage, TAILLE_IMAGE, TYPE_IMAGE } from '@/lib/image-de-partage';
import { PAGES } from '@/lib/metadonnees';

// Image de partage de la page : son titre, sur le gabarit commun (lib/image-de-partage.tsx).
export const alt = PAGES.mentions.titre;
export const size = TAILLE_IMAGE;
export const contentType = TYPE_IMAGE;
// Export statique : l'image est produite une fois, au build.
export const dynamic = 'force-static';

export default function Image() {
  return imageDePartage({
    surtitre: 'Éditeur, hébergeur, données personnelles',
    titre: PAGES.mentions.titre,
  });
}
