import { EMBEDDED_OPCOS, getEmbeddedOpcoBySlug } from '@opco/core';
import { dateFr } from '@/lib/format';
import { imageDePartage, TAILLE_IMAGE, TYPE_IMAGE } from '@/lib/image-de-partage';

// Image de partage d'une fiche : le nom de l'OPCO et la date de vérification de ses barèmes.
export const alt = "Barèmes de prise en charge 2026 d'un opérateur de compétences";
export const size = TAILLE_IMAGE;
export const contentType = TYPE_IMAGE;
// Export statique : l'image est produite une fois, au build.
export const dynamic = 'force-static';

export function generateStaticParams() {
  return EMBEDDED_OPCOS.map((o) => ({ slug: o.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const opco = getEmbeddedOpcoBySlug(slug);
  const nom = opco?.name ?? 'OPCO';
  return imageDePartage({
    surtitre: opco?.derniere_verification
      ? `Fiche OPCO · barèmes vérifiés le ${dateFr(opco.derniere_verification)}`
      : 'Fiche OPCO · barèmes 2026',
    titre: `${nom} : barèmes et prise en charge 2026`,
    pastille: 'Plafonds, frais annexes, branches, sources',
  });
}
