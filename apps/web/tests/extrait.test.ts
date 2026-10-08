// Extrait des secteurs d'un OPCO sur l'accueil (lib/extrait.ts) : une coupe propre (après un élément de liste ou un mot,
// jamais dans une parenthèse), sinon le texte entier.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { EMBEDDED_OPCOS } from '@opco/core';
import { extrait } from '../src/lib/extrait';

const ELLIPSE = '…';

/** Parenthèses équilibrées : jamais de fermante sans ouvrante, aucune ouvrante laissée seule. */
function equilibre(texte: string): boolean {
  let profondeur = 0;
  for (const c of texte) {
    if (c === '(') profondeur++;
    else if (c === ')' && --profondeur < 0) return false;
  }
  return profondeur === 0;
}

/**
 * Propriétés d'un extrait de `texte` : le texte entier, ou un début de `max` caractères au plus, coupé avant un
 * séparateur (jamais au milieu d'un mot), aux parenthèses équilibrées, suivi de « … ».
 */
function verifier(texte: string, max: number, contexte: string): string {
  const r = extrait(texte, max);
  if (texte.length <= max) {
    assert.equal(r, texte, contexte);
    return r;
  }
  if (r === texte) return r;
  assert.ok(r.endsWith(ELLIPSE), `${contexte} : « … » attendu`);
  const debut = r.slice(0, -1);
  assert.ok(debut.length > 0 && debut.length <= max, `${contexte} : ${debut.length} caractères`);
  assert.ok(texte.startsWith(debut), `${contexte} : pas un début du texte`);
  assert.match(texte[debut.length], /[\s,;:·(]/u, `${contexte} : mot coupé (« ${debut.slice(-12)} »)`);
  assert.ok(equilibre(debut), `${contexte} : parenthèse laissée ouverte (« ${debut} »)`);
  return r;
}

describe('extrait', () => {
  test('texte court : rendu tel quel', () => {
    assert.equal(extrait('Commerce de détail', 96), 'Commerce de détail');
    const juste = 'a'.repeat(96);
    assert.equal(extrait(juste, 96), juste);
  });

  test('coupe après un élément de liste, à la dernière virgule passé la moitié', () => {
    assert.equal(extrait('Commerce, artisanat, services de proximité, professions libérales', 30), 'Commerce, artisanat…');
  });

  test("sinon, coupe à la fin d'un mot", () => {
    assert.equal(
      extrait('Commerce, artisanat et services de proximité dans les territoires ruraux', 30),
      'Commerce, artisanat et…',
    );
  });

  test('une parenthèse ouverte par la coupe est retirée avec son contenu', () => {
    assert.equal(
      extrait('Coiffure et esthétique (instituts de beauté, parfumeries, spas) et commerce de proximité', 45),
      'Coiffure et esthétique…',
    );
  });

  test('texte qui commence par une parenthèse tranchée : aucune coupe propre, le texte entier', () => {
    const texte = "(Branches de la coiffure, de l'esthétique et de la parfumerie) et commerce de détail";
    assert.equal(extrait(texte, 30), texte);
  });

  test("premier mot plus long que l'extrait : aucune coupe propre, le texte entier", () => {
    const texte = `${'a'.repeat(120)} et la suite`;
    assert.equal(extrait(texte, 96), texte);
  });

  test('parenthèses imbriquées : la coupe ne laisse pas la parenthèse extérieure ouverte', () => {
    assert.equal(
      extrait('Industries (chimie (fine), plasturgie, caoutchouc, pétrole et gaz) et métallurgie', 40),
      'Industries…',
    );
  });

  test('parenthèses équilibrées et mots entiers sur 3 000 textes tirés au hasard (graine fixe)', () => {
    // mulberry32, graine fixe : le tirage est reproductible.
    let graine = 7;
    const hasard = (n: number) => {
      graine = (graine + 0x6d2b79f5) | 0;
      let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
    };
    const mot = () => 'abcdefghij'.slice(0, 1 + hasard(10)).repeat(1 + hasard(hasard(8) === 0 ? 30 : 2));
    let coupes = 0;
    let entiers = 0;
    for (let i = 0; i < 3000; i++) {
      // Texte à parenthèses bien formées (parfois en tête, parfois imbriquées), mots séparés par une espace ou « , ».
      let texte = '';
      let profondeur = 0;
      const longueur = 2 + hasard(40);
      for (let m = 0; m < longueur; m++) {
        if (m > 0) texte += hasard(4) === 0 ? ', ' : ' ';
        if (hasard(6) === 0 && profondeur < 2) {
          texte += '(';
          profondeur++;
        }
        texte += mot();
        if (profondeur > 0 && hasard(3) === 0) {
          texte += ')';
          profondeur--;
        }
      }
      texte += ')'.repeat(profondeur);
      const max = 20 + hasard(100);
      const r = verifier(texte, max, `texte ${i} (max ${max}) : ${texte}`);
      if (texte.length > max) {
        if (r === texte) entiers++;
        else coupes++;
      }
    }
    // Les deux issues se produisent : le tirage couvre bien les coupes et les textes rendus entiers.
    assert.ok(coupes > 1000 && entiers > 10, `${coupes} coupes, ${entiers} textes entiers`);
  });

  test("les secteurs des 11 OPCO, tels que l'accueil les affiche (96 caractères)", () => {
    for (const o of EMBEDDED_OPCOS) verifier(o.secteurs, 96, o.slug);
  });
});
