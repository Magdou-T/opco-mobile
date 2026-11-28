// ============================================================
// Sigles : définitions sûres (textes officiels) et découpage d'un texte autour de ses sigles, pour les définir à leur
// première occurrence (`<abbr title>`, components/ui/Abreviation.tsx). Module sans importation : le simulateur et
// l'écran de résultats l'embarquent sans lib/fiche.ts, qui le réexporte. Tests : tests/fiche.test.ts
// (definirAbreviations) et tests/sigles.test.ts.
// ============================================================

/**
 * Sigles que le site définit lui-même, une fois par page : IDCC (résultats de la recherche d'entreprise), FSE+ (titre
 * de la première carte d'aide qui le cite), NDA (fiche AKTO) et RQTH (fiche ATLAS). Les sigles propres à un OPCO,
 * vérifiés sur sa page officielle, sont dans `ABREVIATIONS_PAR_OPCO` (lib/fiche.ts).
 */
export const SIGLES = {
  'FSE+': 'Fonds social européen plus',
  IDCC: 'identifiant de la convention collective',
  NDA: "numéro de déclaration d'activité",
  RQTH: 'reconnaissance de la qualité de travailleur handicapé',
} as const;

export type MorceauTexte =
  | { genre: 'texte'; valeur: string }
  | { genre: 'abreviation'; valeur: string; definition: string };

const echapper = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Découpe un texte autour de ses sigles définis : la première occurrence de chaque sigle (mot entier, casse exacte)
 * devient un morceau `abreviation` qui porte sa définition, le reste du texte est gardé tel quel ; les morceaux
 * recomposent le texte à l'identique. Texte vide : aucun morceau.
 */
export function definirAbreviations(texte: string, definitions: Readonly<Record<string, string>>): MorceauTexte[] {
  if (!texte) return [];
  const sigles = Object.keys(definitions).sort((a, b) => b.length - a.length);
  if (sigles.length === 0) return [{ genre: 'texte', valeur: texte }];
  const motif = new RegExp(`(?<![\\p{L}\\p{N}])(?:${sigles.map(echapper).join('|')})(?![\\p{L}\\p{N}])`, 'gu');
  const definis = new Set<string>();
  const morceaux: MorceauTexte[] = [];
  let debut = 0;
  for (const m of texte.matchAll(motif)) {
    if (definis.has(m[0])) continue;
    definis.add(m[0]);
    if (m.index > debut) morceaux.push({ genre: 'texte', valeur: texte.slice(debut, m.index) });
    morceaux.push({ genre: 'abreviation', valeur: m[0], definition: definitions[m[0]] });
    debut = m.index + m[0].length;
  }
  if (debut < texte.length) morceaux.push({ genre: 'texte', valeur: texte.slice(debut) });
  return morceaux;
}

/** Vrai quand le texte cite le sigle (mot entier, casse exacte : « FSE+ », jamais « FSE+X » ni « fse+ »). */
export function citeLeSigle(texte: string, sigle: string): boolean {
  return definirAbreviations(texte, { [sigle]: sigle }).some((m) => m.genre === 'abreviation');
}
