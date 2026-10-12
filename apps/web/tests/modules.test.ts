// Organisation des modules du site : une seule définition des petites briques partagées (espace insécable, délai
// d'apparition, domaines de formation, dessin et erreur d'un champ), les modules légers n'embarquent pas lib/format.ts, et le
// lot initial du simulateur n'atteint ni le calcul ni le catalogue d'aides de l'écran de résultats.
// Lecture du code source : ces doublons et ces importations ne se voient pas au rendu.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { delai } from '../src/lib/apparition';
import { DOMAINES_DE_FORMATION } from '../src/lib/domaines';
import { INSECABLE } from '../src/lib/insecable';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

/** Fichiers du site (.ts et .tsx) : chemin relatif à src/ et texte. */
function sources(): { chemin: string; texte: string }[] {
  const liste: { chemin: string; texte: string }[] = [];
  const parcourir = (dossier: string) => {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (/\.tsx?$/.test(e.name)) liste.push({ chemin: relative(SRC, chemin).split('\\').join('/'), texte: readFileSync(chemin, 'utf8') });
    }
  };
  parcourir(SRC);
  return liste;
}
const FICHIERS = sources();
const ou = (motif: RegExp) => FICHIERS.filter((f) => motif.test(f.texte)).map((f) => f.chemin);

describe('une seule définition des briques partagées', () => {
  test('l’espace insécable n’est écrite qu’une fois, dans lib/insecable.ts (module sans importation)', () => {
    assert.equal(INSECABLE, String.fromCharCode(0xa0));
    assert.deepEqual(ou(/fromCharCode\(\s*(?:0x0*a0|160)\s*\)/i), ['lib/insecable.ts']);
    assert.deepEqual(ou(/(?:export\s+)?const\s+INSECABLE\s*=/), ['lib/insecable.ts']);
    const insecable = FICHIERS.find((f) => f.chemin === 'lib/insecable.ts');
    assert.ok(insecable && !/^\s*import\s/m.test(insecable.texte));
  });

  test('les modules légers n’embarquent pas lib/format.ts (expressions régulières, Intl) pour une constante', () => {
    for (const chemin of ['lib/contact.ts', 'lib/saisie.ts', 'lib/recherche.ts', 'lib/insecable.ts']) {
      const f = FICHIERS.find((x) => x.chemin === chemin);
      assert.ok(f, chemin);
      assert.doesNotMatch(f.texte, /from ['"](?:\.\/format|@\/lib\/format)['"]/, chemin);
    }
  });

  test('délai d’apparition, domaines de formation, dessin et zone d’erreur d’un champ : une seule copie', () => {
    assert.deepEqual(ou(/const delai\s*=|function delai\(/), ['lib/apparition.ts']);
    assert.deepEqual(delai(120), { '--delai': '120ms' });
    assert.deepEqual(delai(600, 360), { '--delai': '360ms' });
    assert.deepEqual(ou(/'Bureautique et TOSA'/), ['lib/domaines.ts']);
    assert.equal(DOMAINES_DE_FORMATION.length, 6);
    assert.deepEqual(ou(/function (?:ZoneErreur|Erreur)\(/), ['components/ui/Champ.tsx']);
    assert.deepEqual(ou(/'block min-h-12 w-full/), ['components/ui/Champ.tsx']);
    // La vérification la plus récente des barèmes : une fonction de lib/format.ts, plus de réduction recopiée.
    assert.deepEqual(ou(/derniere_verification > recente/), ['lib/format.ts']);
  });

  test('un seul composant ListeIdcc ; les alertes d’une branche reprennent l’élément de liste des alertes', () => {
    assert.deepEqual(ou(/function ListeIdcc\(/), ['components/opco/ListeIdcc.tsx']);
    assert.deepEqual(ou(/className="stamp text-rouge"/), ['components/ui/AlertesOpco.tsx']);
  });
});

// --- Lot initial du simulateur ------------------------------------------------------------------------------------

const TEXTES = new Map(FICHIERS.map((f) => [f.chemin, f.texte]));

/**
 * Importations STATIQUES d'un fichier : `import ... from '...'`, `import '...'` et `export ... from '...'`, sur une ou
 * plusieurs lignes. Les importations de types seuls (`import type`, `export type`, ou `{ type A }`) sont effacées à la
 * compilation et les `import()` dynamiques chargent à la demande : ni les unes ni les autres n'entrent dans le lot.
 */
function importationsStatiques(texte: string): { source: string; clause: string }[] {
  const liste: { source: string; clause: string }[] = [];
  for (const m of texte.matchAll(/^[ \t]*(?:import|export)\s+(type\s+)?(?:([^'";]*?)\s+from\s+)?['"]([^'"]+)['"]/gm)) {
    const clause = (m[2] ?? '').trim();
    const typesSeuls =
      m[1] != null || (/^\{\s*type\s[^}]*\}$/.test(clause) && clause.slice(1, -1).split(',').every((s) => /^\s*(type\s|$)/.test(s)));
    if (!typesSeuls) liste.push({ source: m[3], clause });
  }
  return liste;
}

/**
 * Fichier du site visé par `source` depuis `depuis` (chemins relatifs à src/) : alias `@/` vers src/, chemins relatifs,
 * extensions `.ts` et `.tsx`, fichiers `index`. Un paquet (react, next, @opco/core) : null ; un fichier du site introuvable
 * ou qui n'est pas du code : undefined.
 */
function fichierVise(depuis: string, source: string): string | null | undefined {
  let base: string;
  if (source.startsWith('@/')) base = join(SRC, source.slice(2));
  else if (source.startsWith('.')) base = join(dirname(join(SRC, depuis)), source);
  else return null;
  for (const candidat of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (/\.tsx?$/.test(candidat) && existsSync(candidat) && statSync(candidat).isFile()) return relative(SRC, candidat).split('\\').join('/');
  }
  return undefined;
}

/** Les fichiers du site que `depart` atteint par ses importations statiques, de proche en proche, et les sources non résolues. */
function lotStatique(depart: string): { atteints: Set<string>; nonResolues: string[] } {
  const atteints = new Set([depart]);
  const nonResolues: string[] = [];
  const aVoir = [depart];
  while (aVoir.length > 0) {
    const chemin = aVoir.pop()!;
    for (const { source } of importationsStatiques(TEXTES.get(chemin) ?? '')) {
      const vise = fichierVise(chemin, source);
      if (vise === null) continue;
      if (vise === undefined) {
        if (!/\.css$/.test(source)) nonResolues.push(`${chemin} : ${source}`);
      } else if (!atteints.has(vise)) {
        atteints.add(vise);
        aVoir.push(vise);
      }
    }
  }
  return { atteints, nonResolues };
}

/** Le fichier importe le catalogue d'aides (`EMBEDDED_AIDES` de @opco/core, comme lib/resultats.ts). */
const importeLeCatalogue = (chemin: string): boolean =>
  importationsStatiques(TEXTES.get(chemin) ?? '').some(({ source, clause }) => source === '@opco/core' && /\bEMBEDDED_AIDES\b/.test(clause));

describe("lot initial du simulateur : ni le calcul ni le catalogue de l'écran de résultats", () => {
  test("WizardContainer n'atteint par ses importations statiques ni lib/resultats.ts, ni lib/encadres-resultats.ts, ni un fichier qui importe EMBEDDED_AIDES", () => {
    const { atteints, nonResolues } = lotStatique('components/wizard/WizardContainer.tsx');
    assert.deepEqual(nonResolues, []);
    // Témoins : le parcours atteint ses étapes, leurs fonctions pures et l'attente de l'écran de résultats, jamais l'écran
    // lui-même, chargé à la demande par `import()`.
    for (const chemin of ['components/wizard/StepRecap.tsx', 'components/wizard/StepSituation.tsx', 'lib/etapes.ts', 'lib/groupe.ts', 'components/results/EtatsResultats.tsx']) {
      assert.ok(atteints.has(chemin), chemin);
    }
    assert.equal(atteints.has('components/results/EcranResultats.tsx'), false);
    assert.deepEqual([...atteints].filter((c) => c === 'lib/resultats.ts' || c === 'lib/encadres-resultats.ts'), []);
    assert.deepEqual([...atteints].filter(importeLeCatalogue), []);
  });

  test("témoin : depuis l'écran de résultats, la même lecture atteint le calcul, ses encadrés et le catalogue", () => {
    const { atteints, nonResolues } = lotStatique('components/results/EcranResultats.tsx');
    assert.deepEqual(nonResolues, []);
    assert.ok(atteints.has('lib/resultats.ts'));
    assert.ok(atteints.has('lib/encadres-resultats.ts'));
    assert.ok(importeLeCatalogue('lib/resultats.ts'));
  });
});
