// Surlignage `.mark` (globals.css, charte financementopco) : l'accent typographique des titres, en italique, souligné
// d'un aplat de surligneur posé par une ombre intérieure. `box-decoration-break: clone` redessine l'aplat sur chaque
// ligne : un surlignage de plusieurs mots passe à la ligne sans être rogné (espacement de texte WCAG 1.4.12 à 320 et
// 375 px), sans groupe obligatoire. L'ancien trait en `white-space: nowrap`, qui imposait le groupe `.mark-groupe`, a
// disparu avec la charte SFG. Un seul montant surligné par écran : `.montant-cle`. Lecture du code source.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

describe('surlignage', () => {
  test('le surlignage est un italique souligné par une ombre, redessinée sur chaque ligne, sans blocage du retour à la ligne', () => {
    const regle = /\.mark \{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    assert.match(regle, /font-style: italic;/);
    assert.match(regle, /box-shadow: inset 0 -0\.34em 0 var\(--surligneur\);/);
    assert.match(regle, /box-decoration-break: clone;/);
    assert.doesNotMatch(regle, /white-space: nowrap/);
  });

  test('le montant clé est en DM Mono, surligné ; le surligneur ne colore jamais un texte', () => {
    const regle = /\.montant-cle \{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    assert.match(regle, /font-family: var\(--font-mono\);/);
    assert.match(regle, /var\(--surligneur\)/);
    for (const f of fichiersTsx(SRC)) {
      assert.doesNotMatch(readFileSync(f, 'utf8'), /text-surligneur/, f);
    }
  });

  test("l'accueil n'a qu'un montant surligné (la prise en charge du plan d'exemple)", () => {
    const accueil = readFileSync(join(SRC, 'app/page.tsx'), 'utf8');
    assert.equal(accueil.match(/montant-cle/g)?.length, 1);
  });
});
