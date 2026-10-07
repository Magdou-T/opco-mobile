// Lecture des saisies numériques du simulateur (champs texte lus à la française).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { lireNombre, saisieDuNombre } from '../src/lib/saisie';

/** Espace insécable (U+00A0) et espace fine insécable (U+202F), écrits par leur code pour rester visibles ici. */
const INSECABLE = String.fromCharCode(0x00a0);
const FINE = String.fromCharCode(0x202f);

describe('lireNombre', () => {
  test('vide : valeur nulle, sans erreur', () => {
    assert.deepEqual(lireNombre(''), { valeur: null, erreur: null });
    assert.deepEqual(lireNombre('   '), { valeur: null, erreur: null });
  });

  test('entier avec espaces de milliers (insécables compris)', () => {
    assert.equal(lireNombre('42').valeur, 42);
    assert.equal(lireNombre('0').valeur, 0);
    assert.equal(lireNombre('1 500').valeur, 1500);
    assert.equal(lireNombre(`1${INSECABLE}500`).valeur, 1500);
    assert.equal(lireNombre(`1${FINE}500`).valeur, 1500);
  });

  test('décimal avec virgule ou point', () => {
    assert.equal(lireNombre('12,5', { decimal: true }).valeur, 12.5);
    assert.equal(lireNombre('12.5', { decimal: true }).valeur, 12.5);
    assert.equal(lireNombre('5 600,50', { decimal: true }).valeur, 5600.5);
  });

  test('une saisie illisible est refusée avec son explication, jamais corrigée en silence', () => {
    for (const saisie of ['-5', 'abc', '1e3', '12,5', '4.2', '+3', '12a']) {
      const lecture = lireNombre(saisie);
      assert.equal(lecture.valeur, null, saisie);
      assert.match(lecture.erreur ?? '', /nombre entier/, saisie);
    }
    for (const saisie of ['-5', '1,2,3', '..', '5€']) {
      const lecture = lireNombre(saisie, { decimal: true });
      assert.equal(lecture.valeur, null, saisie);
      assert.match(lecture.erreur ?? '', /Saisissez un nombre/, saisie);
    }
  });

  test('les bornes sont vérifiées', () => {
    assert.deepEqual(lireNombre('5', { min: 14, max: 99 }), {
      valeur: null,
      erreur: 'Saisissez un nombre entre 14 et 99.',
    });
    assert.equal(lireNombre('150', { min: 14, max: 99 }).valeur, null);
    assert.equal(lireNombre('99', { min: 14, max: 99 }).valeur, 99);
    assert.deepEqual(lireNombre('0', { min: 1 }), { valeur: null, erreur: 'Saisissez un nombre égal ou supérieur à 1.' });
    assert.equal(lireNombre('0,5', { decimal: true, min: 1 }).valeur, null);
  });
});

describe('saisieDuNombre', () => {
  test("texte du champ pour une valeur de l'état", () => {
    assert.equal(saisieDuNombre(null), '');
    assert.equal(saisieDuNombre(0), '0');
    assert.equal(saisieDuNombre(1500), '1500');
    assert.equal(saisieDuNombre(12.5), '12,5');
  });

  test('aller-retour : la valeur relue depuis son texte est la même', () => {
    for (const n of [0, 1, 7, 140, 1500, 4200.5, 37.33]) {
      assert.equal(lireNombre(saisieDuNombre(n), { decimal: true }).valeur, n);
    }
  });
});
