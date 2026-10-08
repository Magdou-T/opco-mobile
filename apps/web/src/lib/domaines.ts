import type { EtiquetteTone } from '@/components/ui/Etiquette';

/**
 * Domaines de formation de SFG Développement, dans la couleur que la charte attribue à chacun (IA en vert clair, santé
 * et sécurité au travail en rouge, langues en turquoise, TOSA et soft skills en orange, certifications en or). Repris
 * par l'accueil et la page de contact.
 */
export const DOMAINES_DE_FORMATION: readonly { label: string; tone: EtiquetteTone }[] = [
  { label: 'Bureautique et TOSA', tone: 'orange' },
  { label: 'Langues', tone: 'turquoise' },
  { label: 'Intelligence artificielle', tone: 'vert-clair' },
  { label: 'Santé et sécurité au travail', tone: 'rouge' },
  { label: 'Soft skills', tone: 'orange' },
  { label: 'Certifications', tone: 'or' },
];
