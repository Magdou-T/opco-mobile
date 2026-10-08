// ============================================================
// Aucun test de `npm test` ne dépend du jour où il s'exécute. Les contrôles de dates des données comparent les dates de
// vérification à la date de référence du jeu de données (dates-donnees.ts) ; seul fraicheur.test.ts les compare à la date
// du jour : il est exclu de `npm test` (vitest.config.ts) et lancé par `npm run test:fraicheur` (workflow hebdomadaire).
// Sans cette séparation, l'intégration continue passerait au rouge le 1er octobre 2027 sans aucune modification du code.
// ============================================================

import { readdirSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import configParDefaut, { TESTS_A_PART } from '../vitest.config';
import configFraicheur from '../vitest.fraicheur.config';
import paquet from '../package.json';
import { EMBEDDED_AIDES, EMBEDDED_OPCOS, EMBEDDED_PORTAILS } from '../src/data';
import { DATE_REFERENCE_DONNEES, controlerDatesFutures, controlerFraicheur, dateDeReference } from './dates-donnees';

/** Toutes les entrées datées du jeu de données embarqué : aides, portails régionaux et OPCO. */
const ENTREES = [
  ...EMBEDDED_AIDES.map((a) => ({ id: a.id, derniere_verification: a.derniere_verification })),
  ...EMBEDDED_PORTAILS.map((p) => ({ id: `portail ${p.region}`, derniere_verification: p.derniere_verification })),
  ...EMBEDDED_OPCOS.map((o) => ({ id: o.slug, derniere_verification: o.derniere_verification ?? '' })),
];

/** Lecture de l'horloge : un `Date` construit sans argument, ou `Date.now`. */
const LECTURE_DE_L_HORLOGE = /\bnew Date\(\s*\)|\bDate\.now\(/;

/** Fichiers .ts d'un dossier du paquet (chemin relatif au paquet) avec leur contenu. */
function fichiers(dossier: 'src' | 'src/aides' | 'tests'): { chemin: string; contenu: string }[] {
  const url = new URL(`../${dossier}/`, import.meta.url);
  return readdirSync(url)
    .filter((nom) => nom.endsWith('.ts'))
    .map((nom) => ({ chemin: `${dossier}/${nom}`, contenu: readFileSync(new URL(nom, url), 'utf8') }));
}

describe('date de référence du jeu de données', () => {
  it("est une date du calendrier, à laquelle aucune vérification des données n'est postérieure de plus d'un jour", () => {
    expect(DATE_REFERENCE_DONNEES).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dateDeReference().toISOString().slice(0, 10)).toBe(DATE_REFERENCE_DONNEES);
    expect(ENTREES.length).toBeGreaterThan(190);
    expect(controlerDatesFutures(ENTREES, dateDeReference())).toEqual([]);
    expect(controlerFraicheur(ENTREES, dateDeReference())).toEqual([]);
  });

  it("un an après la date de référence (1er octobre 2027), le contrôle de fraîcheur signale les données : `npm run test:fraicheur` échouerait ce jour-là, pas `npm test`", () => {
    const enOctobre2027 = new Date('2027-10-01T00:00:00Z');
    const perimees = controlerFraicheur(ENTREES, enOctobre2027);
    expect(perimees.length).toBeGreaterThan(100);
    expect(perimees).toContain(`nat-cpf : dernière vérification le ${EMBEDDED_AIDES.find((a) => a.id === 'nat-cpf')!.derniere_verification} (12 mois)`);
    // Les contrôles de `npm test` comparent à la date de référence : le jour de l'exécution n'y change rien.
    expect(controlerFraicheur(ENTREES, dateDeReference())).toEqual([]);
  });
});

describe("aucun test de `npm test` ne lit l'horloge", () => {
  it('le contrôle de fraîcheur, seul à la lire, est exclu de `npm test` et seul lancé par `npm run test:fraicheur`', () => {
    expect(TESTS_A_PART).toEqual(['tests/fraicheur.test.ts']);
    expect(configParDefaut.test?.exclude).toEqual(expect.arrayContaining(TESTS_A_PART));
    expect(configFraicheur.test?.include).toEqual(TESTS_A_PART);
    expect(paquet.scripts.test).toBe('vitest run');
    expect(paquet.scripts['test:fraicheur']).toBe('vitest run --config vitest.fraicheur.config.ts');
  });

  it("aucun autre fichier de tests du cœur ne lit l'horloge", () => {
    const tests = fichiers('tests');
    expect(tests.length).toBeGreaterThan(20);
    const lecteurs = tests.filter((f) => LECTURE_DE_L_HORLOGE.test(f.contenu)).map((f) => f.chemin);
    expect(lecteurs).toEqual(['tests/fraicheur.test.ts']);
  });

  it("le moteur (src) ne lit jamais l'horloge : la date de référence lui est toujours passée en paramètre", () => {
    const sources = [...fichiers('src'), ...fichiers('src/aides')];
    expect(sources.length).toBeGreaterThan(10);
    expect(sources.filter((f) => LECTURE_DE_L_HORLOGE.test(f.contenu)).map((f) => f.chemin)).toEqual([]);
  });

  it("le motif reconnaît une lecture de l'horloge, pas une date construite à partir d'une chaîne", () => {
    // Exemples assemblés par morceaux : écrits d'un bloc, ils feraient de ce fichier un lecteur de l'horloge pour le contrôle.
    const date = ['new', 'Date'].join(' ');
    const now = ['Date', 'now'].join('.');
    expect(LECTURE_DE_L_HORLOGE.test(`const d = ${date}();`)).toBe(true);
    expect(LECTURE_DE_L_HORLOGE.test(`const d = ${date}( );`)).toBe(true);
    expect(LECTURE_DE_L_HORLOGE.test(`const t = ${now}();`)).toBe(true);
    expect(LECTURE_DE_L_HORLOGE.test(`const d = ${date}('2026-10-08T00:00:00Z');`)).toBe(false);
    expect(LECTURE_DE_L_HORLOGE.test(`const d = ${date}(iso);`)).toBe(false);
  });
});
