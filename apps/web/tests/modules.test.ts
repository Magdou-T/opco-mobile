// Organisation des modules du site : une seule définition des petites briques partagées (espace insécable, délai
// d'apparition, domaines de formation, dessin et erreur d'un champ), et les modules légers n'embarquent pas lib/format.ts.
// Lecture du code source : ces doublons ne se voient pas au rendu.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
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
