// Barre de navigation collante du simulateur : réserve du bas de la zone de défilement et contrôle qui passe sous la
// barre (lib/barreCollante.ts ; le crochet useReserveBarreCollante les applique au document).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AIR_AU_DESSUS_DE_LA_BARRE, VARIABLE_RESERVE, focusSousLaBarre, reserveDeLaBarre } from '../src/lib/barreCollante';

describe('réserve de la barre collante', () => {
  test('hauteur arrondie au pixel supérieur, plus 8 px pour l’anneau de focus', () => {
    assert.equal(AIR_AU_DESSUS_DE_LA_BARRE, 8);
    assert.equal(reserveDeLaBarre(69), 77);
    assert.equal(reserveDeLaBarre(99.2), 108);
    assert.equal(reserveDeLaBarre(0), 8);
  });

  test('une variable CSS propre à la barre du simulateur (une par élément collant)', () => {
    assert.equal(VARIABLE_RESERVE, '--reserve-barre-simulateur');
  });
});

describe('contrôle masqué par la barre', () => {
  // Mesure du relecteur (375 x 812) : barre de 100 px en haut à 712, champ au y 734-782 après la frappe de « . ».
  test('un champ hors de la barre dont le bas dépasse le haut de la barre moins 8 px doit remonter', () => {
    assert.equal(focusSousLaBarre(782, 712, false, true), true);
    assert.equal(focusSousLaBarre(705, 712, false, true), true);
    assert.equal(focusSousLaBarre(704, 712, false, true), false);
    assert.equal(focusSousLaBarre(600, 712, false, true), false);
  });

  test("jamais pour un contrôle de la barre elle-même, ni quand la barre ne colle pas", () => {
    assert.equal(focusSousLaBarre(790, 743, true, true), false);
    assert.equal(focusSousLaBarre(782, 712, false, false), false);
  });
});
