// Lecture des saisies numériques du simulateur (champs texte lus à la française) : une saisie ambiguë ou illisible est
// refusée avec son explication, jamais devinée ni corrigée en silence.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { lireNombre, saisieDuNombre } from '../src/lib/saisie';
import type { ReglesNombre } from '../src/lib/saisie';

/** Espace insécable (U+00A0) et espace fine insécable (U+202F), écrits par leur code pour rester visibles ici. */
const INSECABLE = String.fromCharCode(0x00a0);
const FINE = String.fromCharCode(0x202f);
const MILLE = `1${INSECABLE}500`;

/** Règles des champs du parcours : montant en euros (coût, budget, solde CPF, frais), entier (durée, âge, effectif...). */
const MONTANT: ReglesNombre = { decimal: true, euros: true };
const ENTIER: ReglesNombre = {};
/** Nombre décimal qui n'est pas un montant (aucun champ du parcours aujourd'hui) : l'exemple n'a pas d'unité. */
const DECIMAL: ReglesNombre = { decimal: true };

/** Explications attendues (consigne W4-fix, constat A1), écrites ici en toutes lettres. */
const ERREURS = {
  montantAmbigu: `Pour ${MILLE}${INSECABLE}€, écrivez 1500 ou ${MILLE}${INSECABLE}; la virgule sert aux centimes.`,
  decimalAmbigu: `Pour ${MILLE}, écrivez 1500 ou ${MILLE}${INSECABLE}; la virgule sert aux décimales.`,
  entierSeparateur: `Saisissez un nombre entier, sans virgule ni point${INSECABLE}: pour ${MILLE}, écrivez 1500 ou ${MILLE}.`,
  espaces: `Les espaces séparent les milliers, par groupes de trois chiffres${INSECABLE}: écrivez 1500 ou ${MILLE}.`,
  tropGrand: `Nombre trop grand${INSECABLE}: vérifiez la saisie.`,
  horsMontant: `Saisissez un nombre sans symbole euro${INSECABLE}: ce champ n'est pas un montant.`,
  decimalIllisible: 'Saisissez un nombre, par exemple 1500 ou 1500,50.',
  entierIllisible: 'Saisissez un nombre entier, sans lettre ni signe.',
};

/** Saisies acceptées et valeur lue. */
const ACCEPTEES: [saisie: string, regles: ReglesNombre, valeur: number][] = [
  // Milliers : chiffres collés ou groupés par trois avec des espaces (ordinaires, insécables, fines).
  ['1500', MONTANT, 1500],
  ['1 500', MONTANT, 1500],
  [`1${INSECABLE}500`, MONTANT, 1500],
  [`1${FINE}500`, MONTANT, 1500],
  ['12 000', MONTANT, 12000],
  ['1 234 567', MONTANT, 1234567],
  ['1  500', MONTANT, 1500],
  // Décimales : une virgule ou un point suivi d'un ou de deux chiffres.
  ['1,5', MONTANT, 1.5],
  ['1,50', MONTANT, 1.5],
  ['1.5', MONTANT, 1.5],
  ['12,05', MONTANT, 12.05],
  ['0,5', MONTANT, 0.5],
  ['1 500,50', MONTANT, 1500.5],
  ['1 500.5', MONTANT, 1500.5],
  // Point et virgule ensemble : le dernier est décimal, l'autre groupe les milliers par trois.
  ['1.500,50', MONTANT, 1500.5],
  ['1,500.50', MONTANT, 1500.5],
  ['1.500,5', MONTANT, 1500.5],
  ['1.234.567,89', MONTANT, 1234567.89],
  ['1,234,567.89', MONTANT, 1234567.89],
  // Montant en euros : « € » ou « euros » en fin de saisie est ignoré.
  ['12 000 €', MONTANT, 12000],
  ['12000€', MONTANT, 12000],
  [`1 500,50${INSECABLE}€`, MONTANT, 1500.5],
  ['12 000 euros', MONTANT, 12000],
  ['1 euro', MONTANT, 1],
  ['  42  ', MONTANT, 42],
  ['0', MONTANT, 0],
  // Entier.
  ['42', ENTIER, 42],
  ['0', ENTIER, 0],
  ['1 500', ENTIER, 1500],
  [`1${INSECABLE}500`, ENTIER, 1500],
  ['1 234 567', ENTIER, 1234567],
  // Décimal sans unité.
  ['12,5', DECIMAL, 12.5],
  ['12.5', DECIMAL, 12.5],
  ['5 600,50', DECIMAL, 5600.5],
];

/** Saisies refusées et explication attendue. */
const REFUSEES: [saisie: string, regles: ReglesNombre, erreur: string][] = [
  // Un séparateur seul suivi de trois chiffres ou plus : 1 500 ou 1,5 ? Refusé, jamais deviné.
  ['1.500', MONTANT, ERREURS.montantAmbigu],
  ['1,500', MONTANT, ERREURS.montantAmbigu],
  ['1.500', { ...MONTANT, min: 1 }, ERREURS.montantAmbigu],
  ['1,500', { ...MONTANT, min: 1 }, ERREURS.montantAmbigu],
  ['12,345', MONTANT, ERREURS.montantAmbigu],
  ['1,5000', MONTANT, ERREURS.montantAmbigu],
  ['1.500 €', MONTANT, ERREURS.montantAmbigu],
  ['1.500', DECIMAL, ERREURS.decimalAmbigu],
  // Deux séparateurs : décimales au plus deux, milliers par trois, même séparateur décimal jamais répété.
  ['1.500,500', MONTANT, ERREURS.montantAmbigu],
  ['1,500.500', MONTANT, ERREURS.montantAmbigu],
  ['1.50,50', MONTANT, ERREURS.montantAmbigu],
  ['15.00,50', MONTANT, ERREURS.montantAmbigu],
  ['1,500,000', MONTANT, ERREURS.montantAmbigu],
  ['1.500.000', MONTANT, ERREURS.montantAmbigu],
  ['1,2,3', MONTANT, ERREURS.montantAmbigu],
  ['1,2,3', DECIMAL, ERREURS.decimalAmbigu],
  ['1 500.000,50', MONTANT, ERREURS.montantAmbigu],
  // Espaces : seulement entre des groupes de trois chiffres.
  ['1 5 00', MONTANT, ERREURS.espaces],
  ['1500 000', MONTANT, ERREURS.espaces],
  ['15 00', MONTANT, ERREURS.espaces],
  ['1 500,5 0', MONTANT, ERREURS.espaces],
  ['1 5 00', ENTIER, ERREURS.espaces],
  // Résultat non fini (Infinity).
  ['9'.repeat(400), MONTANT, ERREURS.tropGrand],
  ['9'.repeat(309), ENTIER, ERREURS.tropGrand],
  [`${'9'.repeat(310)},50`, MONTANT, ERREURS.tropGrand],
  // Symbole euro hors d'un montant.
  ['12 000 €', ENTIER, ERREURS.horsMontant],
  ['35 euros', ENTIER, ERREURS.horsMontant],
  ['5€', DECIMAL, ERREURS.horsMontant],
  ['€', ENTIER, ERREURS.horsMontant],
  // Mode entier : ni virgule ni point.
  ['1.500', ENTIER, ERREURS.entierSeparateur],
  ['1,500', ENTIER, ERREURS.entierSeparateur],
  ['1,5', ENTIER, ERREURS.entierSeparateur],
  ['12.5', ENTIER, ERREURS.entierSeparateur],
  ['1.500,00', ENTIER, ERREURS.entierSeparateur],
  // Saisies illisibles.
  ['-5', MONTANT, ERREURS.decimalIllisible],
  ['abc', MONTANT, ERREURS.decimalIllisible],
  ['1e3', MONTANT, ERREURS.decimalIllisible],
  ['12,', MONTANT, ERREURS.decimalIllisible],
  [',5', MONTANT, ERREURS.decimalIllisible],
  ['..', MONTANT, ERREURS.decimalIllisible],
  ['€', MONTANT, ERREURS.decimalIllisible],
  ['€ 12', MONTANT, ERREURS.decimalIllisible],
  ['12 € €', MONTANT, ERREURS.decimalIllisible],
  ['-5', ENTIER, ERREURS.entierIllisible],
  ['abc', ENTIER, ERREURS.entierIllisible],
  ['1e3', ENTIER, ERREURS.entierIllisible],
  ['+3', ENTIER, ERREURS.entierIllisible],
  ['12a', ENTIER, ERREURS.entierIllisible],
];

const nomDuCas = (saisie: string, regles: ReglesNombre) =>
  `« ${saisie.length > 24 ? `${saisie.slice(0, 24)}...` : saisie} » ${JSON.stringify(regles)}`;

describe('lireNombre', () => {
  test('vide : valeur nulle, sans erreur', () => {
    assert.deepEqual(lireNombre(''), { valeur: null, erreur: null });
    assert.deepEqual(lireNombre('   '), { valeur: null, erreur: null });
    assert.deepEqual(lireNombre(INSECABLE, MONTANT), { valeur: null, erreur: null });
  });

  test('saisies acceptées : valeur lue, sans erreur', () => {
    for (const [saisie, regles, valeur] of ACCEPTEES) {
      assert.deepEqual(lireNombre(saisie, regles), { valeur, erreur: null }, nomDuCas(saisie, regles));
    }
  });

  test('saisies ambiguës ou illisibles : refusées avec leur explication, jamais devinées', () => {
    for (const [saisie, regles, erreur] of REFUSEES) {
      assert.deepEqual(lireNombre(saisie, regles), { valeur: null, erreur }, nomDuCas(saisie, regles));
    }
  });

  test('aucune explication ne porte de tiret cadratin ni ne commence une ligne par sa ponctuation', () => {
    const cadratin = String.fromCharCode(0x2014);
    for (const erreur of Object.values(ERREURS)) {
      assert.ok(!erreur.includes(cadratin), erreur);
      assert.ok(!/ [:;]/.test(erreur), `espace ordinaire avant « : » ou « ; » : ${erreur}`);
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
    assert.equal(lireNombre('1 500 €', { ...MONTANT, min: 1 }).valeur, 1500);
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
    for (const n of [0, 1, 7, 140, 1500, 4200.5, 37.33, 0.05]) {
      assert.equal(lireNombre(saisieDuNombre(n), MONTANT).valeur, n, String(n));
    }
    for (const [saisie, regles, valeur] of ACCEPTEES) {
      assert.equal(lireNombre(saisieDuNombre(valeur), regles).valeur, valeur, nomDuCas(saisie, regles));
    }
  });
});
