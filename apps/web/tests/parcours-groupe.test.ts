// Parcours du simulateur avec un groupe (lib/parcours.ts) : `champsDepuisProjet` (les réponses propres à un autre statut
// reviennent à leur valeur initiale) et `etatDepuisProjet` avec plusieurs profils (le budget déjà consommé se garde ou se vide).
// Fonctions pures ; attentes écrites à la main.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampsProfil, ProjetType, WizardState } from '@opco/core';
import { champsDepuisProjet, etatDepuisProjet } from '../src/lib/parcours';
import { PROJETS, avecBudget } from './fixtures-groupe';

describe('champsDepuisProjet', () => {
  /** Un profil dont toutes les questions ont une réponse, y compris celles d'autres statuts. */
  const plein: ChampsProfil = {
    projetType: 'formation_salarie',
    contractType: 'cdi',
    anciennete_mois: 30,
    isHandicap: true,
    ageBeneficiaire: 19,
    niveauDiplome: 'bac',
    typeAlternance: 'apprentissage',
    inscritFranceTravail: true,
    statutDirigeant: 'artisan',
    microEntrepreneur: false,
    soldeCpf: 800,
    regionBeneficiaireCode: '84',
  };

  test('seules les réponses propres à un autre statut reviennent à leur valeur initiale ; celles du nouveau statut ne sont pas touchées', () => {
    const salarie = { typeAlternance: null, inscritFranceTravail: null, statutDirigeant: null, microEntrepreneur: null, regionBeneficiaireCode: null };
    assert.deepEqual(champsDepuisProjet(plein, 'formation_salarie'), { ...salarie, projetType: 'formation_salarie' });
    assert.deepEqual(champsDepuisProjet(plein, 'reconversion_salarie'), { ...salarie, projetType: 'reconversion_salarie' });
    assert.deepEqual(champsDepuisProjet(plein, 'recrutement_demandeur_emploi'), {
      projetType: 'recrutement_demandeur_emploi',
      contractType: null,
      anciennete_mois: null,
      soldeCpf: null,
      typeAlternance: null,
      statutDirigeant: null,
      microEntrepreneur: null,
    });
    assert.deepEqual(champsDepuisProjet(plein, 'alternance'), {
      projetType: 'alternance',
      contractType: 'alternance',
      anciennete_mois: null,
      soldeCpf: null,
      statutDirigeant: null,
      microEntrepreneur: null,
    });
    assert.deepEqual(champsDepuisProjet(plein, 'formation_dirigeant'), {
      projetType: 'formation_dirigeant',
      contractType: null,
      anciennete_mois: null,
      typeAlternance: null,
      inscritFranceTravail: null,
      regionBeneficiaireCode: null,
    });
  });

  test('les questions communes (âge, diplôme, RQTH) ne sont jamais touchées', () => {
    for (const projet of PROJETS) {
      const maj = champsDepuisProjet(plein, projet);
      for (const champ of ['ageBeneficiaire', 'niveauDiplome', 'isHandicap']) assert.equal(champ in maj, false, `${projet} : ${champ}`);
    }
  });

  test('le contrat « alternance » suit le statut', () => {
    // Alternant : « alternance » une fois le type de contrat choisi, vide sinon.
    assert.equal(champsDepuisProjet({ ...plein, contractType: 'cdd', typeAlternance: 'professionnalisation' }, 'alternance').contractType, 'alternance');
    assert.equal(champsDepuisProjet({ ...plein, contractType: 'alternance', typeAlternance: null }, 'alternance').contractType, null);
    // Salarié : « alternance » est retiré, un autre contrat reste (la mise à jour n'écrit pas le champ).
    assert.equal(champsDepuisProjet({ ...plein, contractType: 'alternance' }, 'formation_salarie').contractType, null);
    assert.equal(champsDepuisProjet({ ...plein, contractType: 'alternance' }, 'reconversion_salarie').contractType, null);
    assert.equal('contractType' in champsDepuisProjet({ ...plein, contractType: 'cdd' }, 'formation_salarie'), false);
    // Dirigeant et demandeur d'emploi : pas de contrat.
    assert.equal(champsDepuisProjet({ ...plein, contractType: 'alternance' }, 'formation_dirigeant').contractType, null);
    assert.equal(champsDepuisProjet({ ...plein, contractType: 'cdi' }, 'recrutement_demandeur_emploi').contractType, null);
  });

  test('les réponses reçues ne sont pas modifiées', () => {
    const copie = structuredClone(plein);
    for (const projet of PROJETS) champsDepuisProjet(plein, projet);
    assert.deepEqual(plein, copie);
  });
});

describe('etatDepuisProjet avec un groupe : le budget déjà consommé', () => {
  /** Budget de l'état après le choix de `vers` pour le profil principal. */
  const budgetApres = (groupe: WizardState, vers: ProjetType) => ({ ...groupe, ...etatDepuisProjet(groupe, vers) }).budgetDejaConsomme;

  test("gardé tant qu'un profil supplémentaire relève d'un projet salarié, quel que soit son rang", () => {
    for (const autres of [
      ['formation_salarie', 'formation_dirigeant', 'formation_dirigeant'],
      ['formation_dirigeant', 'reconversion_salarie', 'formation_dirigeant'],
      ['formation_dirigeant', 'formation_dirigeant', 'formation_salarie'],
    ] as const) {
      assert.equal(budgetApres(avecBudget('formation_dirigeant', ...autres), 'formation_dirigeant'), 2000, autres.join());
    }
  });

  test("gardé quand le nouveau projet du profil principal l'ouvre, même si aucun autre profil ne l'ouvre", () => {
    assert.equal(budgetApres(avecBudget('formation_dirigeant', 'formation_dirigeant', 'alternance'), 'formation_salarie'), 2000);
  });

  test("gardé pour un profil supplémentaire dont le projet n'est pas choisi", () => {
    assert.equal(budgetApres(avecBudget('formation_dirigeant', null), 'formation_dirigeant'), 2000);
  });

  test("vidé quand aucun profil du groupe ne l'ouvre", () => {
    assert.equal(budgetApres(avecBudget('formation_salarie', 'alternance', 'recrutement_demandeur_emploi'), 'formation_dirigeant'), null);
    assert.equal(budgetApres(avecBudget('formation_dirigeant', 'formation_dirigeant'), 'alternance'), null);
  });
});
