import { TexteAvecSigles } from '@/components/ui/Abreviation';
import { texteDonnees } from '@/lib/format';

/**
 * Texte des données affiché sur une fiche OPCO : dates JJ/MM/AAAA, montants et typographie à la française
 * (`texteDonnees`, jamais à l'intérieur d'un extrait cité « … »), et sigles vérifiés sur la page officielle de l'OPCO
 * définis à leur première occurrence (`<abbr title>`). Les données ne sont pas modifiées : seul l'affichage change.
 */
export function TexteDonnees({ texte, sigles }: { texte: string; sigles?: Readonly<Record<string, string>> }) {
  const affiche = texteDonnees(texte);
  if (!sigles) return <>{affiche}</>;
  return <TexteAvecSigles texte={affiche} sigles={sigles} />;
}
