// Formulaire de contact (lib/contact.ts) : le lien mailto reste celui du formulaire d'origine (destinataire, objet, corps),
// les champs obligatoires vides ou mal formés sont refusés avec un message qui dit quoi écrire.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAMPS_OBLIGATOIRES, CONTACT_EMAIL, SUJETS, erreursDuContact, lienMailto } from '../src/lib/contact';

const NBSP = String.fromCharCode(0xa0);

describe('lienMailto', () => {
  test('destinataire SFG Développement, objet préfixé, champs facultatifs absents quand ils sont vides', () => {
    assert.equal(CONTACT_EMAIL, 'contact@sfgdeveloppement.fr');
    assert.equal(
      lienMailto({ nom: 'Marie Dupont', entreprise: '', email: 'marie@exemple.fr', telephone: '', sujet: 'Autre demande', message: 'Bonjour' }),
      'mailto:contact@sfgdeveloppement.fr?subject=%5BfinancementOPCO%5D%20Autre%20demande&body=Nom%20%3A%20Marie%20Dupont%0AEmail%20%3A%20marie%40exemple.fr%0A%0ABonjour',
    );
  });

  test('tous les champs : entreprise et téléphone dans le corps, dans cet ordre, caractères encodés', () => {
    assert.equal(
      lienMailto({
        nom: 'Marie Dupont',
        entreprise: 'Boulangerie Dupont',
        email: 'marie@exemple.fr',
        telephone: '06 12 34 56 78',
        sujet: SUJETS[0],
        message: 'Formation Excel pour 3 salariés & 100% financée ?',
      }),
      'mailto:contact@sfgdeveloppement.fr?subject=%5BfinancementOPCO%5D%20Estimer%20ou%20monter%20un%20dossier%20de%20financement%20OPCO' +
        '&body=Nom%20%3A%20Marie%20Dupont%0AEntreprise%20%3A%20Boulangerie%20Dupont%0AEmail%20%3A%20marie%40exemple.fr' +
        '%0AT%C3%A9l%C3%A9phone%20%3A%2006%2012%2034%2056%2078%0A%0AFormation%20Excel%20pour%203%20salari%C3%A9s%20%26%20100%25%20financ%C3%A9e%20%3F',
    );
  });

  test('les cinq sujets du formulaire, dans leur ordre', () => {
    assert.deepEqual(SUJETS, [
      'Estimer ou monter un dossier de financement OPCO',
      'Organiser une formation pour mes salariés',
      'Question sur mes obligations (contributions, entretiens)',
      'Signaler une erreur sur le site',
      'Autre demande',
    ]);
  });
});

describe('erreursDuContact', () => {
  test('champs obligatoires vides ou faits d’espaces : une erreur chacun, dans l’ordre du formulaire', () => {
    assert.deepEqual(erreursDuContact({ nom: '', email: '', message: '' }, false), {
      nom: 'Indiquez votre nom.',
      email: 'Indiquez votre adresse e-mail.',
      message: 'Écrivez votre message.',
    });
    assert.deepEqual(Object.keys(erreursDuContact({ nom: '  ', email: ' ', message: '\n' }, false)), [...CHAMPS_OBLIGATOIRES]);
  });

  test('adresse e-mail mal formée selon le navigateur : refusée avec la forme attendue', () => {
    assert.deepEqual(erreursDuContact({ nom: 'Marie', email: 'marie@', message: 'Bonjour' }, true), {
      email: `Vérifiez l'adresse e-mail${NBSP}: elle s'écrit sous la forme nom@entreprise.fr.`,
    });
    // Vide, elle est d'abord demandée.
    assert.deepEqual(erreursDuContact({ nom: 'Marie', email: '', message: 'Bonjour' }, true), { email: 'Indiquez votre adresse e-mail.' });
  });

  test('formulaire complet : aucune erreur', () => {
    assert.deepEqual(erreursDuContact({ nom: 'Marie', email: 'marie@exemple.fr', message: 'Bonjour' }, false), {});
  });
});
