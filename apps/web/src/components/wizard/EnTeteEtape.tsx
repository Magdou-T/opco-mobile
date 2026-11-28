import type { ReactNode } from 'react';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ETAPES } from '@/lib/etapes';
import type { EtapeSite } from '@/lib/etapes';

/**
 * Identifiant du titre de l'étape affichée : la carte de l'étape s'y réfère (aria-labelledby) et le focus y revient à
 * chaque changement d'étape.
 */
export const ID_TITRE_ETAPE = 'titre-etape';

/**
 * En-tête d'une étape du simulateur : surtitre « Étape n sur N », titre (Montserrat 700) et chapeau, puis la légende de
 * l'astérisque quand l'étape a des champs obligatoires (les lecteurs d'écran ont déjà « (obligatoire) » dans chaque
 * libellé : la légende leur est masquée).
 */
export function EnTeteEtape({
  etape,
  titre,
  chapeau,
  obligatoires = false,
}: {
  etape: EtapeSite;
  titre: ReactNode;
  chapeau?: ReactNode;
  obligatoires?: boolean;
}) {
  const position = ETAPES.findIndex((e) => e.key === etape) + 1;
  return (
    <div className="border-b border-filet pb-6 sm:pb-7">
      <SectionTitle
        as="h2"
        taille="sous-section"
        id={ID_TITRE_ETAPE}
        titreFocusable
        surtitre={`Étape ${position} sur ${ETAPES.length}`}
        titre={titre}
        chapeau={chapeau}
      />
      {obligatoires && (
        <p aria-hidden="true" className="mt-3 text-xs text-texte-discret">
          <span className="text-rouge">*</span> Champ obligatoire
        </p>
      )}
    </div>
  );
}
