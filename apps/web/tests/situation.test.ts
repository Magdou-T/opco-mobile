// Étiquettes de la situation d'un groupe, en tête de l'écran de résultats (lib/situation.ts) : « N personnes » avec un profil,
// « N personnes · M profils » avec plusieurs, et leur place après le projet, l'OPCO, la région et la durée. Celles d'une
// personne seule (projet, OPCO, région, durée) sont dans resultats.test.ts. Fonction pure ; attentes écrites à la main.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { WizardState } from '@opco/core';
import { INSECABLE } from '../src/lib/insecable';
import { etiquettesDeSituation } from '../src/lib/situation';
import { etat, extra, groupeDe } from './fixtures-groupe';

describe("étiquettes de la situation d'un groupe", () => {
  test('rien pour une personne ; « N personnes » avec un profil ; « N personnes · M profils » avec plusieurs', () => {
    assert.deepEqual(etiquettesDeSituation(etat()), ['Former un salarié']);
    assert.deepEqual(etiquettesDeSituation(etat({ nombrePersonnes: 3 })), ['Former un salarié', `3${INSECABLE}personnes`]);
    assert.deepEqual(
      etiquettesDeSituation(etat({ nombrePersonnes: 3, autresProfils: [extra('profil-2', { nombre: 2 })] })),
      ['Former un salarié', `5${INSECABLE}personnes · 2${INSECABLE}profils`],
    );
  });
});

describe("étiquettes de la situation d'un groupe : cas limites", () => {
  test('deux personnes suffisent, avec un profil comme avec deux', () => {
    assert.deepEqual(etiquettesDeSituation(etat({ nombrePersonnes: 2 })), ['Former un salarié', `2${INSECABLE}personnes`]);
    assert.deepEqual(etiquettesDeSituation(groupeDe(1, [1])), ['Former un salarié', `2${INSECABLE}personnes · 2${INSECABLE}profils`]);
  });

  test("l'étiquette du groupe vient après le projet, l'OPCO, la région et la durée", () => {
    const e = groupeDe(3, [1], { selectedOpcoSlug: 'akto', regionCode: '11', durationHours: 35 });
    assert.deepEqual(etiquettesDeSituation(e), [
      'Former un salarié',
      'AKTO',
      'Île-de-France',
      `35${INSECABLE}h`,
      `4${INSECABLE}personnes · 2${INSECABLE}profils`,
    ]);
  });

  test("aux plus grands groupes (six profils, 99 personnes) : l'étiquette dit le nombre de personnes et de profils", () => {
    assert.deepEqual(etiquettesDeSituation(groupeDe(1, [1, 1, 1, 1, 1])), ['Former un salarié', `6${INSECABLE}personnes · 6${INSECABLE}profils`]);
    assert.deepEqual(etiquettesDeSituation(groupeDe(50, [49])), ['Former un salarié', `99${INSECABLE}personnes · 2${INSECABLE}profils`]);
  });

  test('projet non choisi : « Former un salarié », comme pour une personne seule', () => {
    assert.deepEqual(etiquettesDeSituation(etat({ projetType: null, nombrePersonnes: 3 })), ['Former un salarié', `3${INSECABLE}personnes`]);
  });

  test('un état ancien, sans tableau de profils supplémentaires, compte un seul profil', () => {
    const ancien = { ...etat({ nombrePersonnes: 3 }), autresProfils: undefined } as unknown as WizardState;
    assert.deepEqual(etiquettesDeSituation(ancien), ['Former un salarié', `3${INSECABLE}personnes`]);
  });
});
