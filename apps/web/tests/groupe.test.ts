// État d'un groupe de personnes formées (lib/groupe.ts) : saisie du nombre, bornes, ajout et retrait de profils,
// changement de statut, prix du groupe, OPCO et budget du groupe. Fonctions pures ; attentes écrites à la main.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PERSONNES, MAX_PROFILS, createInitialWizardState, nombreDePersonnes } from '@opco/core';
import type { ProfilSupplementaire, WizardState } from '@opco/core';
import {
  ajouterProfil,
  basculerModePrix,
  changerProjetDuProfil,
  definirNombre,
  etatDepuisPrix,
  lireEffectif,
  majProfil,
  normaliserGroupe,
  nouveauProfil,
  opcoRequisPourLeGroupe,
  ouvreBudgetPourLeGroupe,
  prochainIdProfil,
  retirerProfil,
} from '../src/lib/groupe';
import { etatDepuisProjet } from '../src/lib/parcours';

const etat = (maj: Partial<WizardState> = {}): WizardState => ({
  ...createInitialWizardState(),
  projetType: 'formation_salarie',
  ...maj,
});
const extra = (id: string, maj: Partial<ProfilSupplementaire> = {}): ProfilSupplementaire => ({
  ...nouveauProfil(etat()),
  id,
  ...maj,
});

describe('saisie du nombre de personnes (lireEffectif)', () => {
  test('un entier de 1 à 99 est lu tel quel, les espaces autour sont ignorés', () => {
    assert.equal(lireEffectif('3'), 3);
    assert.equal(lireEffectif(' 12 '), 12);
    assert.equal(lireEffectif('0005'), 5);
    assert.equal(lireEffectif('99'), 99);
  });

  test('au-delà de 99 : 99', () => {
    assert.equal(lireEffectif('150'), MAX_PERSONNES);
    assert.equal(lireEffectif('9999'), MAX_PERSONNES);
  });

  test('zéro, vide, négatif, décimal, texte, notation scientifique, nombre trop long : refusés (null), jamais NaN', () => {
    for (const saisie of ['0', '0000', '', ' ', '-3', '3,7', '3.7', 'abc', '1e2', '1 2', '12345']) {
      assert.equal(lireEffectif(saisie), null, JSON.stringify(saisie));
    }
  });
});

describe('normaliserGroupe', () => {
  test("un état d'une personne n'est pas touché", () => {
    const initial = etat();
    assert.deepEqual(normaliserGroupe(initial), initial);
  });

  test('effectifs ramenés à un entier de 1 à 99', () => {
    const cas: [number, number][] = [
      [0, 1],
      [-4, 1],
      [3.9, 3],
      [Number.NaN, 1],
      [200, 99],
    ];
    for (const [saisi, attendu] of cas) {
      assert.equal(normaliserGroupe(etat({ nombrePersonnes: saisi })).nombrePersonnes, attendu, String(saisi));
    }
    assert.equal(normaliserGroupe(etat({ autresProfils: [extra('profil-2', { nombre: 0 })] })).autresProfils[0].nombre, 1);
  });

  test('au plus 5 profils supplémentaires', () => {
    const sept = Array.from({ length: 7 }, (_, i) => extra(`profil-${i + 2}`));
    assert.deepEqual(
      normaliserGroupe(etat({ autresProfils: sept })).autresProfils.map((p) => p.id),
      ['profil-2', 'profil-3', 'profil-4', 'profil-5', 'profil-6'],
    );
    assert.equal(MAX_PROFILS - 1, 5);
  });

  test('au plus 99 personnes : le surplus est retiré du dernier profil, puis des précédents, puis du profil principal', () => {
    const a = normaliserGroupe(
      etat({ nombrePersonnes: 60, autresProfils: [extra('profil-2', { nombre: 30 }), extra('profil-3', { nombre: 30 })] }),
    );
    assert.deepEqual([a.nombrePersonnes, ...a.autresProfils.map((p) => p.nombre)], [60, 30, 9]);
    const cinq = Array.from({ length: 5 }, (_, i) => extra(`profil-${i + 2}`, { nombre: 99 }));
    const b = normaliserGroupe(etat({ nombrePersonnes: 99, autresProfils: cinq }));
    assert.deepEqual([b.nombrePersonnes, ...b.autresProfils.map((p) => p.nombre)], [94, 1, 1, 1, 1, 1]);
    assert.equal(nombreDePersonnes(b), 99);
  });

  test("le prix du groupe n'a de sens qu'à partir de 2 personnes", () => {
    assert.equal(normaliserGroupe(etat({ prixDuGroupe: 5600, pedagogyCostTotal: 5600 })).prixDuGroupe, null);
    assert.equal(normaliserGroupe(etat({ nombrePersonnes: 2, prixDuGroupe: 5600 })).prixDuGroupe, 5600);
  });

  test("prix du groupe renseigné : le coût d'une personne et le coût horaire suivent, y compris quand l'effectif change", () => {
    const deux = normaliserGroupe(etat({ nombrePersonnes: 2, prixDuGroupe: 5600, durationHours: 35 }));
    assert.equal(deux.pedagogyCostTotal, 2800);
    assert.equal(deux.pedagogyCostPerHour, 80);
    const quatre = normaliserGroupe({ ...deux, nombrePersonnes: 4 });
    assert.equal(quatre.pedagogyCostTotal, 1400);
    assert.equal(quatre.pedagogyCostPerHour, 40);
  });

  test('sans durée (vide ou nulle) : coût horaire vide, jamais NaN ni infini', () => {
    for (const durationHours of [null, 0]) {
      const r = normaliserGroupe(etat({ nombrePersonnes: 3, prixDuGroupe: 900, durationHours }));
      assert.equal(r.pedagogyCostTotal, 300);
      assert.equal(r.pedagogyCostPerHour, null, String(durationHours));
    }
  });

  test('idempotente', () => {
    const x = etat({ nombrePersonnes: 3, durationHours: 21, prixDuGroupe: 1000, autresProfils: [extra('profil-2', { nombre: 2 })] });
    assert.deepEqual(normaliserGroupe(normaliserGroupe(x)), normaliserGroupe(x));
  });
});

describe('profils : ajout, retrait, changement', () => {
  test("ajouter : un profil d'une personne, du statut du profil principal, sans autre réponse", () => {
    const e = ajouterProfil(etat({ projetType: 'formation_dirigeant', statutDirigeant: 'artisan', ageBeneficiaire: 40 }));
    assert.equal(e.autresProfils.length, 1);
    const p = e.autresProfils[0];
    assert.deepEqual([p.id, p.nombre, p.projetType], ['profil-2', 1, 'formation_dirigeant']);
    assert.equal(p.statutDirigeant, null);
    assert.equal(p.ageBeneficiaire, null);
  });

  test("identifiants : le plus petit libre à partir de profil-2 ; un identifiant retiré resservit avec des réponses vides", () => {
    let e = ajouterProfil(ajouterProfil(etat()));
    assert.deepEqual(e.autresProfils.map((p) => p.id), ['profil-2', 'profil-3']);
    e = majProfil(e, 'profil-2', { ageBeneficiaire: 52, isHandicap: true });
    e = retirerProfil(e, 'profil-2');
    assert.deepEqual(e.autresProfils.map((p) => p.id), ['profil-3']);
    e = ajouterProfil(e);
    assert.deepEqual(e.autresProfils.map((p) => p.id), ['profil-3', 'profil-2']);
    const neuf = e.autresProfils.find((p) => p.id === 'profil-2')!;
    assert.equal(neuf.ageBeneficiaire, null);
    assert.equal(neuf.isHandicap, false);
    assert.equal(prochainIdProfil(e), 'profil-4');
  });

  test('limites : 6 profils, 99 personnes ; retirer le profil principal ou un profil inconnu ne fait rien', () => {
    let e = etat();
    for (let i = 0; i < 8; i++) e = ajouterProfil(e);
    assert.equal(e.autresProfils.length, MAX_PROFILS - 1);
    assert.equal(ajouterProfil(etat({ nombrePersonnes: 99 })).autresProfils.length, 0);
    assert.equal(retirerProfil(e, 'principal').autresProfils.length, 5);
    assert.equal(retirerProfil(e, 'profil-42').autresProfils.length, 5);
  });

  test("majProfil : un profil supplémentaire change seul ; le profil principal change les champs de l'état", () => {
    const e = ajouterProfil(etat({ ageBeneficiaire: 30 }));
    const apres = majProfil(majProfil(e, 'profil-2', { ageBeneficiaire: 58 }), 'principal', { isHandicap: true });
    assert.equal(apres.ageBeneficiaire, 30);
    assert.equal(apres.isHandicap, true);
    assert.equal(apres.autresProfils[0].ageBeneficiaire, 58);
    assert.equal(apres.autresProfils[0].isHandicap, false);
  });

  test('statut changé : seules les réponses du nouveau statut et les questions communes restent', () => {
    let e = ajouterProfil(etat());
    e = majProfil(e, 'profil-2', {
      projetType: 'formation_dirigeant',
      statutDirigeant: 'artisan',
      microEntrepreneur: false,
      soldeCpf: 800,
      ageBeneficiaire: 52,
      niveauDiplome: 'bac',
      isHandicap: true,
    });
    e = changerProjetDuProfil(e, 'profil-2', 'formation_salarie');
    const salarie = e.autresProfils[0];
    assert.equal(salarie.projetType, 'formation_salarie');
    assert.equal(salarie.statutDirigeant, null);
    assert.equal(salarie.microEntrepreneur, null);
    assert.equal(salarie.soldeCpf, 800); // le salarié garde le solde CPF
    assert.deepEqual([salarie.ageBeneficiaire, salarie.niveauDiplome, salarie.isHandicap], [52, 'bac', true]); // questions communes
    e = changerProjetDuProfil(e, 'profil-2', 'alternance');
    assert.equal(e.autresProfils[0].soldeCpf, null);
    assert.equal(e.autresProfils[0].contractType, null); // pas encore de type de contrat d'alternance
    assert.deepEqual(changerProjetDuProfil(e, 'profil-42', 'formation_dirigeant'), e);
  });

  test("definirNombre : borné à la place qui reste, jamais 0 ni NaN ; un profil inconnu ne change rien", () => {
    const e = etat({ nombrePersonnes: 10, autresProfils: [extra('profil-2', { nombre: 50 })] });
    assert.equal(definirNombre(e, 'principal', 80).nombrePersonnes, 49);
    assert.equal(definirNombre(e, 'principal', 0).nombrePersonnes, 1);
    assert.equal(definirNombre(e, 'principal', Number.NaN).nombrePersonnes, 1);
    assert.equal(definirNombre(e, 'profil-2', 7.9).autresProfils[0].nombre, 7);
    assert.deepEqual(definirNombre(e, 'profil-42', 5), e);
  });

  test("changer le projet du profil principal garde le budget déjà consommé tant qu'un profil relève d'un projet salarié", () => {
    const groupe = ajouterProfil(etat({ budgetDejaConsomme: 2000 })); // profil-2 est salarié aussi
    assert.equal({ ...groupe, ...etatDepuisProjet(groupe, 'formation_dirigeant') }.budgetDejaConsomme, 2000);
    const seul = etat({ budgetDejaConsomme: 2000 });
    assert.equal({ ...seul, ...etatDepuisProjet(seul, 'formation_dirigeant') }.budgetDejaConsomme, null);
  });
});

describe('prix de la formation', () => {
  test("par personne : le coût d'une personne est le prix saisi", () => {
    const e = etatDepuisPrix(etat({ nombrePersonnes: 3 }), 2800, 35, false);
    assert.deepEqual([e.pedagogyCostTotal, e.pedagogyCostPerHour, e.prixDuGroupe, e.durationHours], [2800, 80, null, 35]);
  });

  test("pour le groupe : le coût d'une personne est le prix divisé par l'effectif", () => {
    const e = etatDepuisPrix(etat({ nombrePersonnes: 4 }), 11200, 35, true);
    assert.deepEqual([e.pedagogyCostTotal, e.pedagogyCostPerHour, e.prixDuGroupe], [2800, 80, 11200]);
  });

  test('pour le groupe avec une seule personne : ignoré', () => {
    const e = etatDepuisPrix(etat(), 2800, 35, true);
    assert.deepEqual([e.pedagogyCostTotal, e.prixDuGroupe], [2800, null]);
  });

  test('prix effacé ou durée absente : jamais NaN ni infini', () => {
    for (const pourLeGroupe of [false, true]) {
      const efface = etatDepuisPrix(etat({ nombrePersonnes: 2 }), null, 35, pourLeGroupe);
      assert.deepEqual([efface.pedagogyCostTotal, efface.pedagogyCostPerHour, efface.prixDuGroupe], [null, null, null]);
      assert.equal(etatDepuisPrix(etat({ nombrePersonnes: 2 }), 5600, null, pourLeGroupe).pedagogyCostPerHour, null);
    }
  });

  test('bascule de mode : le coût réel est gardé, converti et non ressaisi', () => {
    const base = etatDepuisPrix(etat({ nombrePersonnes: 4 }), 2800, 35, false);
    const groupe = basculerModePrix(base, true);
    assert.deepEqual([groupe.prixDuGroupe, groupe.pedagogyCostTotal, groupe.pedagogyCostPerHour], [11200, 2800, 80]);
    const retour = basculerModePrix(groupe, false);
    assert.deepEqual([retour.prixDuGroupe, retour.pedagogyCostTotal], [null, 2800]);
    // Aucun prix saisi : rien à convertir. Une seule personne : pas de prix de groupe.
    assert.deepEqual(basculerModePrix(etat({ nombrePersonnes: 4 }), true), etat({ nombrePersonnes: 4 }));
    assert.equal(basculerModePrix(etatDepuisPrix(etat(), 2800, 35, false), true).prixDuGroupe, null);
  });
});

describe('OPCO et budget du groupe', () => {
  const avec = (...projets: WizardState['projetType'][]): WizardState => {
    const [principal, ...autres] = projets;
    return etat({ projetType: principal, autresProfils: autres.map((p, i) => extra(`profil-${i + 2}`, { projetType: p })) });
  };

  test('dirigeant seul : OPCO facultatif, aucun budget', () => {
    assert.equal(opcoRequisPourLeGroupe(avec('formation_dirigeant')), false);
    assert.equal(ouvreBudgetPourLeGroupe(avec('formation_dirigeant')), false);
  });

  test('un salarié dans le groupe : OPCO requis, budget ouvert, quel que soit son rang', () => {
    for (const projets of [
      ['formation_dirigeant', 'formation_salarie'],
      ['formation_salarie', 'formation_dirigeant'],
      ['formation_dirigeant', 'reconversion_salarie'],
    ] as const) {
      assert.equal(opcoRequisPourLeGroupe(avec(...projets)), true, projets.join());
      assert.equal(ouvreBudgetPourLeGroupe(avec(...projets)), true, projets.join());
    }
  });

  test("alternance et demandeur d'emploi : OPCO requis, aucun budget", () => {
    assert.equal(opcoRequisPourLeGroupe(avec('alternance', 'recrutement_demandeur_emploi')), true);
    assert.equal(ouvreBudgetPourLeGroupe(avec('alternance', 'recrutement_demandeur_emploi')), false);
  });

  test('projet non choisi : requis et ouvert, comme pour une personne seule', () => {
    assert.equal(opcoRequisPourLeGroupe(avec(null)), true);
    assert.equal(ouvreBudgetPourLeGroupe(avec(null)), true);
  });
});
