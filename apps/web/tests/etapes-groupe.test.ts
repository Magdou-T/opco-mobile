// Ce qui manque à un groupe pour continuer (lib/etapes.ts) : `champsManquants` pour l'étape Participants (numéro de profil,
// effectif) et pour l'étape Entreprise (OPCO requis selon tous les profils), `manquantsDuProfil` (chaque statut, champ par champ).
// Fonctions pures ; attentes écrites à la main.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampsProfil, ProjetType, WizardState } from '@opco/core';
import { champsManquants, manquantsDuProfil } from '../src/lib/etapes';
import { PROJETS, avec, champs, etat, extra } from './fixtures-groupe';

describe("champs manquants d'un groupe (étape Participants)", () => {
  test("un seul profil : les textes d'une personne seule, sans nom de profil, quel que soit l'effectif", () => {
    assert.deepEqual(champsManquants('situation', etat()), ['le type de contrat']);
    assert.deepEqual(champsManquants('situation', etat({ contractType: 'cdi' })), []);
    assert.deepEqual(champsManquants('situation', etat({ nombrePersonnes: 4, contractType: 'cdi' })), []);
  });

  test('plusieurs profils : chaque manque nomme son profil', () => {
    const e = etat({
      contractType: null,
      selectedOpcoSlug: 'akto',
      autresProfils: [extra('profil-2', { projetType: 'formation_dirigeant' }), extra('profil-3', { projetType: 'alternance' })],
    });
    assert.deepEqual(champsManquants('situation', e), [
      'le type de contrat (profil 1)',
      'le statut du dirigeant (profil 2)',
      "le type de contrat d'alternance (profil 3)",
      "l'âge de l'alternant (profil 3)",
    ]);
  });

  test('un profil supplémentaire incomplet empêche de continuer, un profil complet non', () => {
    const complet = extra('profil-2', { contractType: 'cdd' });
    const avecOpco = { contractType: 'cdi', selectedOpcoSlug: 'akto' } as const;
    assert.deepEqual(champsManquants('situation', etat({ ...avecOpco, autresProfils: [complet] })), []);
    assert.deepEqual(champsManquants('situation', etat({ ...avecOpco, autresProfils: [extra('profil-2')] })), [
      'le type de contrat (profil 2)',
    ]);
  });

  test("OPCO : requis dès qu'un profil n'est pas un dirigeant", () => {
    const dirigeantSeul = etat({ projetType: 'formation_dirigeant', regionCode: '11', companySize: 'less_11' });
    assert.deepEqual(champsManquants('identification', dirigeantSeul), []);
    assert.deepEqual(champsManquants('identification', { ...dirigeantSeul, autresProfils: [extra('profil-2')] }), ["l'OPCO"]);
  });

  test('manquantsDuProfil : un projet non choisi manque au profil', () => {
    assert.deepEqual(manquantsDuProfil(champs({ projetType: null })), ['votre projet (étape 1)']);
  });
});

describe('manquantsDuProfil : chaque statut, champ par champ', () => {
  const manque = (projetType: ProjetType | null, maj: Partial<ChampsProfil> = {}): string[] => manquantsDuProfil(champs({ projetType, ...maj }));

  test("salarié : le type de contrat, que « alternance » (reste d'une saisie) ne remplace pas ; aucune ancienneté demandée", () => {
    assert.deepEqual(manque('formation_salarie'), ['le type de contrat']);
    assert.deepEqual(manque('formation_salarie', { contractType: 'alternance' }), ['le type de contrat']);
    for (const contractType of ['cdi', 'cdd', 'interim'] as const) {
      assert.deepEqual(manque('formation_salarie', { contractType }), [], contractType);
    }
  });

  test("reconversion : le type de contrat, puis l'ancienneté ; zéro mois est une réponse", () => {
    assert.deepEqual(manque('reconversion_salarie'), ['le type de contrat', "l'ancienneté"]);
    assert.deepEqual(manque('reconversion_salarie', { contractType: 'alternance' }), ['le type de contrat', "l'ancienneté"]);
    assert.deepEqual(manque('reconversion_salarie', { contractType: 'cdd' }), ["l'ancienneté"]);
    assert.deepEqual(manque('reconversion_salarie', { anciennete_mois: 18 }), ['le type de contrat']);
    assert.deepEqual(manque('reconversion_salarie', { contractType: 'cdi', anciennete_mois: 18 }), []);
    assert.deepEqual(manque('reconversion_salarie', { contractType: 'cdi', anciennete_mois: 0 }), []);
  });

  test("demandeur d'emploi : l'inscription à France Travail ; « non » est une réponse", () => {
    assert.deepEqual(manque('recrutement_demandeur_emploi'), ["l'inscription à France Travail"]);
    assert.deepEqual(manque('recrutement_demandeur_emploi', { inscritFranceTravail: true }), []);
    assert.deepEqual(manque('recrutement_demandeur_emploi', { inscritFranceTravail: false }), []);
  });

  test("alternance : le type de contrat d'alternance puis l'âge, chacun seul quand il est le seul à manquer", () => {
    assert.deepEqual(manque('alternance'), ["le type de contrat d'alternance", "l'âge de l'alternant"]);
    assert.deepEqual(manque('alternance', { typeAlternance: 'apprentissage' }), ["l'âge de l'alternant"]);
    assert.deepEqual(manque('alternance', { ageBeneficiaire: 19 }), ["le type de contrat d'alternance"]);
    assert.deepEqual(manque('alternance', { typeAlternance: 'professionnalisation', ageBeneficiaire: 19 }), []);
  });

  test('dirigeant : son statut', () => {
    assert.deepEqual(manque('formation_dirigeant'), ['le statut du dirigeant']);
    assert.deepEqual(manque('formation_dirigeant', { statutDirigeant: 'assimile_salarie' }), []);
  });

  /** Toutes les réponses des statuts à la fois : un profil complet, quel que soit son projet, avec celles d'un autre projet en plus. */
  const toutes = {
    contractType: 'cdi',
    anciennete_mois: 12,
    inscritFranceTravail: true,
    typeAlternance: 'apprentissage',
    ageBeneficiaire: 19,
    statutDirigeant: 'artisan',
  } as const;

  test('un profil complet ne manque de rien, avec les réponses laissées par un autre projet en plus', () => {
    for (const projet of PROJETS) assert.deepEqual(manque(projet, toutes), [], projet);
  });

  test('un projet non choisi manque, quelles que soient les autres réponses', () => {
    assert.deepEqual(manque(null, toutes), ['votre projet (étape 1)']);
  });
});

describe("champs manquants d'un groupe : numéros de profil, effectifs, OPCO", () => {
  test("avec un seul profil, l'effectif ne nomme aucun profil", () => {
    assert.deepEqual(champsManquants('situation', etat({ nombrePersonnes: 4 })), ['le type de contrat']);
    assert.deepEqual(champsManquants('situation', etat({ nombrePersonnes: 99, projetType: 'alternance' })), [
      "le type de contrat d'alternance",
      "l'âge de l'alternant",
    ]);
  });

  test("le numéro est la position dans le groupe (le principal est le profil 1), pas l'identifiant du profil", () => {
    const complet = (id: string) => extra(id, { contractType: 'cdd' });
    const e = etat({
      contractType: 'cdi',
      selectedOpcoSlug: 'akto',
      autresProfils: [complet('profil-4'), complet('profil-2'), extra('profil-7'), complet('profil-3'), extra('profil-5')],
    });
    assert.deepEqual(champsManquants('situation', e), ['le type de contrat (profil 4)', 'le type de contrat (profil 6)']);
  });

  test("OPCO : facultatif tant que tous les profils sont des dirigeants, requis dès qu'un seul ne l'est pas, quel que soit son rang", () => {
    const entreprise = { regionCode: '11', companySize: 'less_11' } as const;
    const identification = (e: WizardState): string[] => champsManquants('identification', { ...e, ...entreprise });
    assert.deepEqual(identification(avec('formation_dirigeant', 'formation_dirigeant')), []);
    for (const projets of [
      ['formation_dirigeant', 'alternance'],
      ['alternance', 'formation_dirigeant'],
      ['formation_dirigeant', 'formation_dirigeant', 'recrutement_demandeur_emploi'],
      ['formation_dirigeant', null],
    ] as const) {
      assert.deepEqual(identification(avec(...projets)), ["l'OPCO"], projets.join());
    }
    // Choisi ou détecté, l'OPCO suffit.
    assert.deepEqual(identification({ ...avec('formation_dirigeant', 'alternance'), selectedOpcoSlug: 'akto' }), []);
    assert.deepEqual(identification({ ...avec('formation_dirigeant', 'alternance'), detectedOpcoSlug: 'akto' }), []);
  });
});

describe("OPCO à l'étape Participants : un profil ajouté après l'étape Entreprise peut le rendre requis", () => {
  /** Deux dirigeants complets, sans OPCO : l'étape Entreprise les a laissés passer. */
  const dirigeants = etat({
    projetType: 'formation_dirigeant',
    statutDirigeant: 'artisan',
    autresProfils: [extra('profil-2', { projetType: 'formation_dirigeant', statutDirigeant: 'commercant' })],
  });
  const salarie = (id: string, maj: Parameters<typeof extra>[1] = {}) => extra(id, { projetType: 'formation_salarie', contractType: 'cdi', ...maj });
  /** Les deux dirigeants, suivis de ces profils. */
  const avecEnPlus = (...autres: ReturnType<typeof extra>[]): WizardState => ({ ...dirigeants, autresProfils: [...dirigeants.autresProfils, ...autres] });

  test("un groupe de dirigeants sans OPCO : rien ne manque, l'OPCO reste facultatif", () => {
    assert.deepEqual(champsManquants('situation', dirigeants), []);
  });

  test("un salarié ajouté au groupe de dirigeants sans OPCO : « l'OPCO (étape 2) » manque, une seule fois, après les manques des profils", () => {
    assert.deepEqual(champsManquants('situation', avecEnPlus(salarie('profil-3'))), ["l'OPCO (étape 2)"]);
    // Plusieurs profils qui le demandent (salarié, reconversion, alternance) : le manque reste unique.
    const plusieurs = avecEnPlus(
      salarie('profil-3'),
      salarie('profil-4', { projetType: 'reconversion_salarie', anciennete_mois: 12 }),
      extra('profil-5', { projetType: 'alternance', typeAlternance: 'apprentissage', ageBeneficiaire: 19 }),
    );
    assert.deepEqual(champsManquants('situation', plusieurs), ["l'OPCO (étape 2)"]);
    // Un profil encore incomplet : ses manques d'abord, dans l'ordre de l'écran, puis l'OPCO, à reprendre à l'étape 2.
    assert.deepEqual(champsManquants('situation', avecEnPlus(salarie('profil-3', { contractType: null }))), [
      'le type de contrat (profil 3)',
      "l'OPCO (étape 2)",
    ]);
  });

  test('le même groupe avec un OPCO choisi, puis détecté : plus rien ne manque', () => {
    const groupe = avecEnPlus(salarie('profil-3'));
    assert.deepEqual(champsManquants('situation', { ...groupe, selectedOpcoSlug: 'akto' }), []);
    assert.deepEqual(champsManquants('situation', { ...groupe, detectedOpcoSlug: 'akto' }), []);
  });

  test("un groupe de salariés sans OPCO : le manque apparaît aussi ; un seul profil garde les textes d'une personne seule", () => {
    assert.deepEqual(champsManquants('situation', etat({ contractType: 'cdi', autresProfils: [extra('profil-2', { contractType: 'cdd' })] })), [
      "l'OPCO (étape 2)",
    ]);
    // Un seul profil, d'une ou de quatre personnes : son projet a été choisi à l'étape 1 et l'étape Entreprise a exigé l'OPCO.
    assert.deepEqual(champsManquants('situation', etat({ contractType: 'cdi' })), []);
    assert.deepEqual(champsManquants('situation', etat({ contractType: 'cdi', nombrePersonnes: 4 })), []);
  });

  test("l'OPCO ne manque qu'aux étapes Entreprise et Participants", () => {
    const groupe = avecEnPlus(salarie('profil-3'));
    for (const etape of ['projet', 'formation', 'frais', 'recap'] as const) {
      assert.equal(champsManquants(etape, groupe).some((m) => m.includes('OPCO')), false, etape);
    }
  });
});
