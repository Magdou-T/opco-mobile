// Sigles définis à leur première occurrence (lib/sigles.ts) : définitions, sigle cité ou non, et sigles des fiches AKTO
// (NDA) et ATLAS (RQTH), cités une seule fois dans leurs données.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EMBEDDED_OPCOS } from '@opco/core';
import { ABREVIATIONS_PAR_OPCO } from '../src/lib/fiche';
import { SIGLES, citeLeSigle, definirAbreviations } from '../src/lib/sigles';

const source = (chemin: string) => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');

/** Toutes les chaînes des données d'un OPCO. */
function chaines(valeur: unknown): string[] {
  if (typeof valeur === 'string') return [valeur];
  if (valeur && typeof valeur === 'object') return Object.values(valeur).flatMap(chaines);
  return [];
}

describe('sigles du site', () => {
  test('définitions en toutes lettres', () => {
    assert.deepEqual(SIGLES, {
      'FSE+': 'Fonds social européen plus',
      IDCC: 'identifiant de la convention collective',
      NDA: "numéro de déclaration d'activité",
      RQTH: 'reconnaissance de la qualité de travailleur handicapé',
    });
  });

  test('sigle cité : mot entier et casse exacte, « + » compris', () => {
    assert.equal(citeLeSigle('FSE+ – Cofinancement', 'FSE+'), true);
    assert.equal(citeLeSigle('programmes FEDER-FSE+ 2021-2027', 'FSE+'), true);
    assert.equal(citeLeSigle('FSE+X', 'FSE+'), false);
    assert.equal(citeLeSigle('fse+', 'FSE+'), false);
    assert.equal(citeLeSigle('FSE seul', 'FSE+'), false);
    assert.equal(citeLeSigle('', 'FSE+'), false);
  });

  test('fiches AKTO et ATLAS : NDA et RQTH cités une seule fois dans les données, donc définis une seule fois', () => {
    for (const [slug, sigle] of [
      ['akto', 'NDA'],
      ['atlas', 'RQTH'],
    ] as const) {
      const opco = EMBEDDED_OPCOS.find((o) => o.slug === slug);
      assert.ok(opco, slug);
      assert.equal(ABREVIATIONS_PAR_OPCO[slug][sigle], SIGLES[sigle]);
      const textes = chaines(opco).filter((t) => citeLeSigle(t, sigle));
      assert.equal(textes.length, 1, `${slug} : ${sigle} cité ${textes.length} fois`);
      const morceaux = definirAbreviations(textes[0], ABREVIATIONS_PAR_OPCO[slug]);
      assert.deepEqual(
        morceaux.filter((m) => m.genre === 'abreviation').map((m) => [m.valeur, m.definition]),
        [[sigle, SIGLES[sigle]]],
      );
    }
    // BETIC (ATLAS) reste non défini : aucune source ne l'emploie.
    assert.equal(ABREVIATIONS_PAR_OPCO.atlas.BETIC, undefined);
  });

  test('modules légers : lib/sigles.ts sans importation, le composant Abreviation sans lib/fiche.ts', () => {
    const importations = (chemin: string) => (source(chemin).match(/^import .*$/gm) ?? []).join('\n');
    assert.equal(importations('../src/lib/sigles.ts'), '');
    const composant = importations('../src/components/ui/Abreviation.tsx');
    assert.doesNotMatch(composant, /lib\/fiche/);
    assert.match(composant, /from '@\/lib\/sigles'/);
    // Le simulateur et l'écran de résultats prennent le composant léger, jamais celui des fiches.
    for (const chemin of ['../src/components/wizard/StepIdentification.tsx', '../src/components/results/AideCard.tsx']) {
      const texte = importations(chemin);
      assert.match(texte, /from '@\/components\/ui\/Abreviation'/, chemin);
      assert.doesNotMatch(texte, /components\/opco\/TexteDonnees|lib\/fiche/, chemin);
    }
  });

  test('accueil et obligations : FSE+ et VAE écrits en toutes lettres à leur première occurrence', () => {
    const accueil = source('../src/app/page.tsx');
    assert.match(accueil, /validation des acquis de l'expérience \(VAE\)/);
    assert.match(accueil, /Fonds social européen plus \(FSE\+\)/);
    assert.ok(accueil.indexOf('(FSE+)') < accueil.indexOf('CPF, FSE+.'), "la définition précède l'autre occurrence");
    assert.match(source('../src/app/obligations/page.tsx'), /Fonds social européen plus \(FSE\+\)/);
  });
});
