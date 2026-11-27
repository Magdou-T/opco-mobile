import { imageDePartage, TAILLE_IMAGE, TYPE_IMAGE } from '@/lib/image-de-partage';

// Image de partage commune : toute page qui n'a pas la sienne (guides, simulateur, contact) hérite de celle-ci.
export const alt = 'financementOPCO : trouvez tous les financements de votre formation';
export const size = TAILLE_IMAGE;
export const contentType = TYPE_IMAGE;
// Export statique : l'image est produite une fois, au build.
export const dynamic = 'force-static';

export default function Image() {
  return imageDePartage({
    surtitre: 'OPCO · CPF · Région · France Travail · Agefiph',
    titre: 'Trouvez tous les financements de votre formation',
  });
}
