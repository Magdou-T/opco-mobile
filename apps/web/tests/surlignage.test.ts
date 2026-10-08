// Surlignage `.mark` (globals.css) : il ne se coupe pas (`white-space: nowrap`, le trait est tiré sous le mot entier).
// Un surlignage de plusieurs mots est donc posé dans un groupe `.mark-groupe` (bloc en ligne de largeur maximale 100 %),
// avec sa ponctuation : rendu identique tant qu'il tient sur une ligne, retour à la ligne au lieu d'un texte rogné
// quand il est plus large (espacement de texte WCAG 1.4.12 à 320 et 375 px : « prise en charge. » de l'accueil sortait
// de l'écran). Lecture du code source.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const CSS = readFileSync(join(SRC, 'app/globals.css'), 'utf8');

function fichiersTsx(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) return fichiersTsx(chemin);
    return e.name.endsWith('.tsx') ? [chemin] : [];
  });
}

/** Surlignages écrits en toutes lettres dont le texte contient une espace ordinaire, hors groupe. */
function surlignagesHorsGroupe(source: string): string[] {
  const fautes: string[] = [];
  for (const m of source.matchAll(/<span className="mark">([^<{]*)<\/span>/g)) {
    if (!m[1].includes(' ')) continue;
    const avant = source.slice(Math.max(0, m.index - 80), m.index);
    if (!/<span className="mark-groupe">\s*$/.test(avant)) fautes.push(m[1]);
  }
  return fautes;
}

describe('surlignage de plusieurs mots', () => {
  test('le détecteur repère un surlignage de plusieurs mots hors groupe, et lui seul', () => {
    assert.deepEqual(surlignagesHorsGroupe('peut être <span className="mark">prise en charge</span>.'), ['prise en charge']);
    assert.deepEqual(
      surlignagesHorsGroupe('<span className="mark-groupe">\n  <span className="mark">prise en charge</span>.\n</span>'),
      [],
    );
    assert.deepEqual(surlignagesHorsGroupe('projet de <span className="mark">formation</span>'), []);
    assert.deepEqual(surlignagesHorsGroupe('<span className="mark">875&nbsp;€</span>'), []);
  });

  test('chaque surlignage de plusieurs mots des pages est dans un groupe', () => {
    const fichiers = fichiersTsx(SRC);
    const fautes = fichiers.flatMap((f) =>
      surlignagesHorsGroupe(readFileSync(f, 'utf8')).map((t) => `${relative(SRC, f)} : ${t}`),
    );
    assert.deepEqual(fautes, []);
    // Les cinq titres concernés : accueil, obligations, comprendre les OPCO, se former sans budget, page 404.
    const groupes = fichiers.reduce((n, f) => n + (readFileSync(f, 'utf8').match(/className="mark-groupe"/g)?.length ?? 0), 0);
    assert.equal(groupes, 5);
  });

  test('le groupe est un bloc en ligne borné à la largeur de la ligne, où le surlignage peut passer à la ligne', () => {
    assert.match(CSS, /\.mark \{[^}]*white-space: nowrap;/);
    assert.match(CSS, /\.mark-groupe \{\s*display: inline-block;\s*max-width: 100%;\s*\}/);
    assert.match(CSS, /\.mark-groupe \.mark \{\s*white-space: normal;\s*\}/);
  });
});
