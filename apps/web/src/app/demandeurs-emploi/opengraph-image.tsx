import { dateFr } from '@/lib/format';
import { imageDePartage, TAILLE_IMAGE, TYPE_IMAGE } from '@/lib/image-de-partage';
import { PAGES, REVUE_DES_GUIDES } from '@/lib/metadonnees';

// Image de partage de la page : son titre, sur le gabarit commun (lib/image-de-partage.tsx).
export const alt = PAGES.demandeursEmploi.titre;
export const size = TAILLE_IMAGE;
export const contentType = TYPE_IMAGE;
// Export statique : l'image est produite une fois, au build.
export const dynamic = 'force-static';

const REVUE = `mis à jour le ${dateFr(REVUE_DES_GUIDES)}`;

export default function Image() {
  return imageDePartage({
    surtitre: 'Demandeurs d\'emploi · ' + REVUE,
    titre: PAGES.demandeursEmploi.titre,
  });
}
