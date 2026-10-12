// Libellés d'un profil du groupe (lib/profils.ts) : `libelleDuProfil` (chaque statut, restes de saisie, morceaux absents),
// `pucesDuProfil` (ce que répond le profil, sans le statut) et `STATUT_DU_PROFIL`.
// Fonctions pures ; attentes écrites à la main.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { champsDuProfilPrincipal, createInitialWizardState } from '@opco/core';
import type { ChampsProfil, ProjetType } from '@opco/core';
import { INSECABLE } from '../src/lib/insecable';
import { STATUT_DU_PROFIL, libelleDuProfil, pucesDuProfil } from '../src/lib/profils';
import { PROJETS } from './fixtures-groupe';

describe("libellé d'un profil", () => {
  const champs = (maj: Partial<ChampsProfil>): ChampsProfil => ({ ...champsDuProfilPrincipal(createInitialWizardState()), ...maj });

  test("statut, puis ce qui le précise, l'âge et la reconnaissance de travailleur handicapé", () => {
    assert.equal(libelleDuProfil(champs({ projetType: 'formation_salarie', contractType: 'cdi', ageBeneficiaire: 35 })), `Salarié en CDI, 35${INSECABLE}ans`);
    assert.equal(
      libelleDuProfil(champs({ projetType: 'formation_dirigeant', statutDirigeant: 'artisan', ageBeneficiaire: 52, isHandicap: true })),
      `Dirigeant artisan, 52${INSECABLE}ans, RQTH`,
    );
    assert.equal(libelleDuProfil(champs({ projetType: 'reconversion_salarie', contractType: 'cdd' })), 'Salarié en reconversion, CDD');
    assert.equal(libelleDuProfil(champs({ projetType: 'formation_salarie', contractType: 'interim' })), 'Salarié en intérim');
    assert.equal(
      libelleDuProfil(champs({ projetType: 'alternance', typeAlternance: 'apprentissage', ageBeneficiaire: 19 })),
      `Alternant en apprentissage, 19${INSECABLE}ans`,
    );
    assert.equal(
      libelleDuProfil(champs({ projetType: 'alternance', typeAlternance: 'professionnalisation' })),
      'Alternant en contrat de professionnalisation',
    );
    assert.equal(libelleDuProfil(champs({ projetType: 'recrutement_demandeur_emploi' })), "Demandeur d'emploi");
  });

  test("projet non choisi ou contrat « alternance » d'un reste de saisie : « Salarié » seul", () => {
    assert.equal(libelleDuProfil(champs({ projetType: null })), 'Salarié');
    assert.equal(libelleDuProfil(champs({ projetType: 'formation_salarie', contractType: 'alternance' })), 'Salarié');
  });
});

describe("libellé d'un profil : chaque statut, restes de saisie, morceaux absents", () => {
  const champs = (maj: Partial<ChampsProfil>): ChampsProfil => ({ ...champsDuProfilPrincipal(createInitialWizardState()), ...maj });
  const libelle = (projetType: ProjetType | null, maj: Partial<ChampsProfil> = {}): string => libelleDuProfil(champs({ projetType, ...maj }));

  test('salarié et reconversion : chaque contrat, après « en » pour le salarié, après une virgule pour la reconversion', () => {
    for (const [contractType, salarie, reconversion] of [
      ['cdi', 'Salarié en CDI', 'Salarié en reconversion, CDI'],
      ['cdd', 'Salarié en CDD', 'Salarié en reconversion, CDD'],
      ['interim', 'Salarié en intérim', 'Salarié en reconversion, intérim'],
    ] as const) {
      assert.equal(libelle('formation_salarie', { contractType }), salarie, contractType);
      assert.equal(libelle('reconversion_salarie', { contractType }), reconversion, contractType);
    }
  });

  test("sans contrat, ou avec le contrat « alternance » d'un reste de saisie : le statut seul", () => {
    assert.equal(libelle('formation_salarie'), 'Salarié');
    assert.equal(libelle('reconversion_salarie'), 'Salarié en reconversion');
    assert.equal(libelle('reconversion_salarie', { contractType: 'alternance' }), 'Salarié en reconversion');
  });

  test('dirigeant : chacun des cinq statuts, ou « Dirigeant » seul', () => {
    const attendus: Record<NonNullable<ChampsProfil['statutDirigeant']>, string> = {
      commercant: 'Dirigeant commerçant',
      artisan: 'Dirigeant artisan',
      profession_liberale: 'Dirigeant profession libérale',
      exploitant_agricole: 'Dirigeant exploitant agricole',
      assimile_salarie: 'Dirigeant assimilé salarié',
    };
    for (const [statutDirigeant, attendu] of Object.entries(attendus) as [keyof typeof attendus, string][]) {
      assert.equal(libelle('formation_dirigeant', { statutDirigeant }), attendu, statutDirigeant);
    }
    assert.equal(libelle('formation_dirigeant'), 'Dirigeant');
  });

  test("alternant : le type de contrat d'alternance, ou « Alternant » seul ; le contrat « alternance » de l'état n'est pas lu", () => {
    assert.equal(libelle('alternance'), 'Alternant');
    assert.equal(libelle('alternance', { contractType: 'alternance' }), 'Alternant');
    assert.equal(
      libelle('alternance', { contractType: 'alternance', typeAlternance: 'professionnalisation', ageBeneficiaire: 22 }),
      `Alternant en contrat de professionnalisation, 22${INSECABLE}ans`,
    );
  });

  test("l'âge et la RQTH se disent seuls, séparés par une virgule et une espace, sans morceau vide", () => {
    assert.equal(libelle('formation_salarie', { contractType: 'cdi', isHandicap: true }), 'Salarié en CDI, RQTH');
    assert.equal(libelle('recrutement_demandeur_emploi', { ageBeneficiaire: 30 }), `Demandeur d'emploi, 30${INSECABLE}ans`);
    assert.equal(
      libelle('recrutement_demandeur_emploi', { ageBeneficiaire: 30, isHandicap: true }),
      `Demandeur d'emploi, 30${INSECABLE}ans, RQTH`,
    );
    assert.equal(libelle(null, { isHandicap: true, ageBeneficiaire: 41 }), `Salarié, 41${INSECABLE}ans, RQTH`);
    // Un âge est dit dès qu'il est posé, même à zéro (présence, pas valeur).
    assert.equal(libelle('formation_salarie', { contractType: 'cdi', ageBeneficiaire: 0 }), `Salarié en CDI, 0${INSECABLE}ans`);
  });

  test("un profil ne dit que les réponses de son statut : celles d'un autre projet sont ignorées", () => {
    const restes = { contractType: 'cdi', typeAlternance: 'apprentissage', statutDirigeant: 'artisan' } as const;
    assert.equal(libelle('formation_salarie', restes), 'Salarié en CDI');
    assert.equal(libelle('reconversion_salarie', restes), 'Salarié en reconversion, CDI');
    assert.equal(libelle('recrutement_demandeur_emploi', restes), "Demandeur d'emploi");
    assert.equal(libelle('alternance', restes), 'Alternant en apprentissage');
    assert.equal(libelle('formation_dirigeant', restes), 'Dirigeant artisan');
    // Sans contrat, ni le type d'alternance ni le statut de dirigeant n'ont de place chez un salarié ou un demandeur d'emploi.
    const sansContrat = { typeAlternance: 'professionnalisation', statutDirigeant: 'artisan' } as const;
    assert.equal(libelle('formation_salarie', sansContrat), 'Salarié');
    assert.equal(libelle('reconversion_salarie', sansContrat), 'Salarié en reconversion');
    assert.equal(libelle('recrutement_demandeur_emploi', sansContrat), "Demandeur d'emploi");
    assert.equal(libelle('alternance', { statutDirigeant: 'artisan' }), 'Alternant');
    assert.equal(libelle('formation_dirigeant', { typeAlternance: 'apprentissage' }), 'Dirigeant');
  });
});

describe("puces d'un profil (pucesDuProfil)", () => {
  /** Espace fine insécable (U+202F), écrite par son code : séparateur des milliers de `formatEuro` (Intl, fr-FR). */
  const FINE = String.fromCharCode(0x202f);
  const champs = (maj: Partial<ChampsProfil>): ChampsProfil => ({ ...champsDuProfilPrincipal(createInitialWizardState()), ...maj });
  const puces = (projetType: ProjetType | null, maj: Partial<ChampsProfil> = {}): string[] => pucesDuProfil(champs({ projetType, ...maj }));

  test('salarié, profil complet : contrat, âge, diplôme, RQTH, solde CPF, dans cet ordre, sans le statut', () => {
    assert.deepEqual(
      puces('formation_salarie', { contractType: 'cdi', ageBeneficiaire: 35, niveauDiplome: 'bac_plus_2', isHandicap: true, soldeCpf: 1200 }),
      ['CDI', `35${INSECABLE}ans`, 'Bac +2', 'RQTH', `Solde CPF 1${FINE}200${INSECABLE}€`],
    );
  });

  test('salarié en reconversion, profil complet : le contrat, un solde à centimes', () => {
    assert.deepEqual(
      puces('reconversion_salarie', { contractType: 'interim', ageBeneficiaire: 28, niveauDiplome: 'bac', isHandicap: true, soldeCpf: 2500.5 }),
      ['Intérim', `28${INSECABLE}ans`, 'Bac', 'RQTH', `Solde CPF 2${FINE}500,50${INSECABLE}€`],
    );
  });

  test('dirigeant, profil complet : son statut, puis le reste, solde CPF compris', () => {
    assert.deepEqual(
      puces('formation_dirigeant', { statutDirigeant: 'artisan', ageBeneficiaire: 52, niveauDiplome: 'bac_plus_3_et_plus', isHandicap: true, soldeCpf: 800 }),
      ['Artisan', `52${INSECABLE}ans`, 'Bac +3 et plus', 'RQTH', `Solde CPF 800${INSECABLE}€`],
    );
  });

  test("alternant, profil complet : le type de contrat d'alternance, jamais de solde CPF même renseigné", () => {
    assert.deepEqual(
      puces('alternance', { typeAlternance: 'apprentissage', contractType: 'alternance', ageBeneficiaire: 19, niveauDiplome: 'cap_bep', isHandicap: true, soldeCpf: 1200 }),
      ['Apprentissage', `19${INSECABLE}ans`, 'CAP / BEP', 'RQTH'],
    );
    assert.deepEqual(
      puces('alternance', { typeAlternance: 'professionnalisation', contractType: 'alternance', ageBeneficiaire: 22, niveauDiplome: 'sans_diplome' }),
      ['Contrat de professionnalisation', `22${INSECABLE}ans`, 'Sans diplôme'],
    );
  });

  test("demandeur d'emploi, profil complet : rien pour le statut, jamais de solde CPF même renseigné", () => {
    assert.deepEqual(
      puces('recrutement_demandeur_emploi', {
        inscritFranceTravail: true,
        contractType: 'cdi',
        ageBeneficiaire: 30,
        niveauDiplome: 'sans_diplome',
        isHandicap: true,
        soldeCpf: 900,
      }),
      [`30${INSECABLE}ans`, 'Sans diplôme', 'RQTH'],
    );
  });

  test('profil vide : aucune puce, pour chaque statut et pour un projet non choisi', () => {
    for (const projetType of [null, 'formation_salarie', 'reconversion_salarie', 'recrutement_demandeur_emploi', 'alternance', 'formation_dirigeant'] as const) {
      assert.deepEqual(puces(projetType), [], String(projetType));
    }
  });

  test('un champ seul ne produit que sa puce : le contrat du salarié et du salarié en reconversion, en majuscule', () => {
    for (const projetType of ['formation_salarie', 'reconversion_salarie'] as const) {
      assert.deepEqual(puces(projetType, { contractType: 'cdi' }), ['CDI'], projetType);
      assert.deepEqual(puces(projetType, { contractType: 'cdd' }), ['CDD'], projetType);
      assert.deepEqual(puces(projetType, { contractType: 'interim' }), ['Intérim'], projetType);
    }
  });

  test("un champ seul ne produit que sa puce : le type d'alternance et chacun des cinq statuts de dirigeant, en majuscule", () => {
    assert.deepEqual(puces('alternance', { typeAlternance: 'apprentissage' }), ['Apprentissage']);
    assert.deepEqual(puces('alternance', { typeAlternance: 'professionnalisation' }), ['Contrat de professionnalisation']);
    for (const [statutDirigeant, attendu] of [
      ['commercant', 'Commerçant'],
      ['artisan', 'Artisan'],
      ['profession_liberale', 'Profession libérale'],
      ['exploitant_agricole', 'Exploitant agricole'],
      ['assimile_salarie', 'Assimilé salarié'],
    ] as const) {
      assert.deepEqual(puces('formation_dirigeant', { statutDirigeant }), [attendu], statutDirigeant);
    }
  });

  test("un champ seul ne produit que sa puce : l'âge, chacun des cinq diplômes, la RQTH, le solde CPF", () => {
    assert.deepEqual(puces('recrutement_demandeur_emploi', { ageBeneficiaire: 30 }), [`30${INSECABLE}ans`]);
    for (const [niveauDiplome, attendu] of [
      ['sans_diplome', 'Sans diplôme'],
      ['cap_bep', 'CAP / BEP'],
      ['bac', 'Bac'],
      ['bac_plus_2', 'Bac +2'],
      ['bac_plus_3_et_plus', 'Bac +3 et plus'],
    ] as const) {
      assert.deepEqual(puces('recrutement_demandeur_emploi', { niveauDiplome }), [attendu], niveauDiplome);
    }
    assert.deepEqual(puces('alternance', { isHandicap: true }), ['RQTH']);
    assert.deepEqual(puces('formation_salarie', { soldeCpf: 1200 }), [`Solde CPF 1${FINE}200${INSECABLE}€`]);
    assert.deepEqual(puces('formation_dirigeant', { soldeCpf: 800 }), [`Solde CPF 800${INSECABLE}€`]);
  });

  test('une réponse à zéro est dite : la présence compte, pas la valeur', () => {
    assert.deepEqual(puces('formation_salarie', { ageBeneficiaire: 0 }), [`0${INSECABLE}ans`]);
    assert.deepEqual(puces('formation_salarie', { soldeCpf: 0 }), [`Solde CPF 0${INSECABLE}€`]);
  });

  test("espaces insécables : aucune espace ordinaire entre l'âge et « ans », ni dans le montant du solde CPF", () => {
    const [age, solde] = puces('formation_salarie', { ageBeneficiaire: 35, soldeCpf: 12500 });
    assert.equal(age, `35${INSECABLE}ans`);
    assert.equal(age.includes(' '), false, 'âge');
    assert.equal(solde, `Solde CPF 12${FINE}500${INSECABLE}€`);
    assert.equal(solde.replace('Solde CPF ', '').includes(' '), false, 'montant');
  });

  test('solde CPF : seulement pour les statuts qui posent la question (salarié, reconversion, dirigeant)', () => {
    for (const projetType of ['formation_salarie', 'reconversion_salarie', 'formation_dirigeant'] as const) {
      assert.deepEqual(puces(projetType, { soldeCpf: 1200 }), [`Solde CPF 1${FINE}200${INSECABLE}€`], projetType);
    }
    for (const projetType of ['recrutement_demandeur_emploi', 'alternance'] as const) {
      assert.deepEqual(puces(projetType, { soldeCpf: 1200 }), [], projetType);
    }
  });

  test("le contrat « alternance » d'un reste de saisie n'est pas une précision de statut", () => {
    assert.deepEqual(puces('formation_salarie', { contractType: 'alternance' }), []);
    assert.deepEqual(puces('reconversion_salarie', { contractType: 'alternance', ageBeneficiaire: 30 }), [`30${INSECABLE}ans`]);
    // Pour un alternant, le contrat « alternance » est la valeur normale : la précision vient du type d'alternance seul.
    assert.deepEqual(puces('alternance', { contractType: 'alternance' }), []);
    assert.deepEqual(puces('alternance', { contractType: 'alternance', typeAlternance: 'apprentissage' }), ['Apprentissage']);
  });

  test("un profil ne dit que les réponses de son statut : celles d'un autre projet sont ignorées", () => {
    const restes = { contractType: 'cdi', typeAlternance: 'apprentissage', statutDirigeant: 'artisan' } as const;
    assert.deepEqual(puces('formation_salarie', restes), ['CDI']);
    assert.deepEqual(puces('reconversion_salarie', restes), ['CDI']);
    assert.deepEqual(puces('recrutement_demandeur_emploi', restes), []);
    assert.deepEqual(puces('alternance', restes), ['Apprentissage']);
    assert.deepEqual(puces('formation_dirigeant', restes), ['Artisan']);
  });

  test('projet non choisi : lu comme un salarié', () => {
    assert.deepEqual(puces(null, { contractType: 'cdd', soldeCpf: 500 }), ['CDD', `Solde CPF 500${INSECABLE}€`]);
  });

  test("l'ordre ne change pas quand des puces manquent : précision, âge, diplôme, RQTH, solde CPF", () => {
    assert.deepEqual(puces('formation_salarie', { ageBeneficiaire: 35, niveauDiplome: 'bac' }), [`35${INSECABLE}ans`, 'Bac']);
    assert.deepEqual(puces('formation_salarie', { niveauDiplome: 'bac', isHandicap: true }), ['Bac', 'RQTH']);
    assert.deepEqual(puces('formation_salarie', { isHandicap: true, soldeCpf: 300 }), ['RQTH', `Solde CPF 300${INSECABLE}€`]);
    assert.deepEqual(puces('formation_salarie', { contractType: 'cdd', soldeCpf: 300 }), ['CDD', `Solde CPF 300${INSECABLE}€`]);
    assert.deepEqual(puces('formation_salarie', { contractType: 'cdd', ageBeneficiaire: 41 }), ['CDD', `41${INSECABLE}ans`]);
    assert.deepEqual(puces('formation_salarie', { contractType: 'cdd', niveauDiplome: 'cap_bep' }), ['CDD', 'CAP / BEP']);
    assert.deepEqual(puces('formation_salarie', { contractType: 'cdd', isHandicap: true }), ['CDD', 'RQTH']);
    assert.deepEqual(puces('formation_salarie', { ageBeneficiaire: 41, isHandicap: true }), [`41${INSECABLE}ans`, 'RQTH']);
    assert.deepEqual(puces('formation_salarie', { ageBeneficiaire: 41, soldeCpf: 300 }), [`41${INSECABLE}ans`, `Solde CPF 300${INSECABLE}€`]);
    assert.deepEqual(puces('formation_salarie', { niveauDiplome: 'bac', soldeCpf: 300 }), ['Bac', `Solde CPF 300${INSECABLE}€`]);
  });

  test("fonction pure : les réponses reçues ne sont pas modifiées et chaque appel rend un tableau neuf", () => {
    const recues = Object.freeze(champs({ projetType: 'formation_salarie', contractType: 'cdi', soldeCpf: 1200 }));
    const premier = pucesDuProfil(recues);
    const second = pucesDuProfil(recues);
    assert.deepEqual(premier, ['CDI', `Solde CPF 1${FINE}200${INSECABLE}€`]);
    assert.deepEqual(second, premier);
    assert.notEqual(second, premier);
    premier.push('autre');
    assert.deepEqual(pucesDuProfil(recues), ['CDI', `Solde CPF 1${FINE}200${INSECABLE}€`]);
    // Même un profil sans réponse rend un tableau à lui : modifier le premier ne change pas le suivant.
    const vide = puces('recrutement_demandeur_emploi');
    vide.push('autre');
    assert.deepEqual(puces('recrutement_demandeur_emploi'), []);
  });
});

describe('statut du profil (STATUT_DU_PROFIL)', () => {
  test('une entrée par projet, dite en un ou deux mots', () => {
    assert.deepEqual(STATUT_DU_PROFIL, {
      formation_salarie: 'Salarié',
      reconversion_salarie: 'Salarié en reconversion',
      recrutement_demandeur_emploi: "Demandeur d'emploi",
      alternance: 'Alternant',
      formation_dirigeant: 'Dirigeant',
    });
    assert.deepEqual(Object.keys(STATUT_DU_PROFIL).sort(), [...PROJETS].sort());
  });
});
