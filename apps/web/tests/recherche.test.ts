// Recherche d'entreprise : requête envoyée à l'API, IDCC affichés sous un résultat, numéros groupés pour la lecture.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CODES_ECHAPPATOIRES, parseResultatRechercheEntreprises } from '@opco/core';
import { idccAffichables, numeroLisible, requeteRecherche } from '../src/lib/recherche';

/** Espace insécable (U+00A0) et espace fine insécable (U+202F), écrits par leur code pour rester visibles ici. */
const INSECABLE = String.fromCharCode(0x00a0);
const FINE = String.fromCharCode(0x202f);

describe('requeteRecherche', () => {
  test('un SIREN saisi avec des séparateurs part en chiffres collés', () => {
    const saisies = [
      '814739728',
      '814 739 728',
      ['814', '739', '728'].join(INSECABLE),
      ['814', '739', '728'].join(FINE),
      '814.739.728',
      '814-739-728',
      '  814 739 728  ',
      '814 - 739 - 728',
    ];
    for (const saisie of saisies) assert.equal(requeteRecherche(saisie), '814739728', JSON.stringify(saisie));
  });

  test('un préfixe « SIREN » ou « SIRET » est ignoré', () => {
    assert.equal(requeteRecherche('SIREN 814 739 728'), '814739728');
    assert.equal(requeteRecherche('siren: 814739728'), '814739728');
    assert.equal(requeteRecherche('Siren n° 814-739-728'), '814739728');
    assert.equal(requeteRecherche('SIRET 814 739 728 00024'), '81473972800024');
    assert.equal(requeteRecherche('siret 81473972800024'), '81473972800024');
  });

  test('un SIRET de 14 chiffres groupés part en chiffres collés', () => {
    assert.equal(requeteRecherche('814 739 728 00024'), '81473972800024');
    assert.equal(requeteRecherche('814.739.728.00024'), '81473972800024');
  });

  test('un nom ou un numéro incomplet part tel quel, sans les espaces de bord', () => {
    assert.equal(requeteRecherche('  SFG Développement '), 'SFG Développement');
    assert.equal(requeteRecherche('Carrefour'), 'Carrefour');
    assert.equal(requeteRecherche('814 739 72'), '814 739 72');
    assert.equal(requeteRecherche('8147397280'), '8147397280');
    assert.equal(requeteRecherche('SIRENA 12'), 'SIRENA 12');
    assert.equal(requeteRecherche('Siret Conseil'), 'Siret Conseil');
    assert.equal(requeteRecherche('SIREN'), 'SIREN');
    assert.equal(requeteRecherche(''), '');
  });
});

describe('idccAffichables', () => {
  test('les codes échappatoires de la DSN ne sont jamais affichés comme des IDCC', () => {
    assert.deepEqual(idccAffichables(['1612', '3248', '9999', '1944']), ['1612', '3248', '1944']);
    assert.deepEqual(idccAffichables(Object.keys(CODES_ECHAPPATOIRES)), []);
    assert.deepEqual(idccAffichables([]), []);
  });

  test("réponses réelles de l'API : aucun code échappatoire ne reste, l'ordre est gardé", () => {
    const fixtures = readFileSync(fileURLToPath(new URL('./fixtures/recherche-entreprises.json', import.meta.url)), 'utf8');
    const entreprises = (JSON.parse(fixtures) as { results: Record<string, unknown>[] }).results.map(
      parseResultatRechercheEntreprises,
    );
    const airbus = entreprises.find((e) => e.siren === '383474814');
    assert.ok(airbus?.idccs.includes('9999'), 'la réponse AIRBUS déclare le code 9999');
    for (const e of entreprises) {
      const affiches = idccAffichables(e.idccs);
      assert.deepEqual(affiches, e.idccs.filter((i) => !Object.keys(CODES_ECHAPPATOIRES).includes(i)), e.siren);
    }
  });
});

describe('numeroLisible', () => {
  test('SIREN et SIRET groupés par espaces insécables', () => {
    assert.equal(numeroLisible('814739728'), ['814', '739', '728'].join(INSECABLE));
    assert.equal(numeroLisible('81473972800024'), ['814', '739', '728', '00024'].join(INSECABLE));
  });

  test('toute autre valeur est rendue telle quelle', () => {
    assert.equal(numeroLisible('81473972'), '81473972');
    assert.equal(numeroLisible('ABC'), 'ABC');
  });
});
