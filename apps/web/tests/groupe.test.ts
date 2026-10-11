// État d'un groupe de personnes formées (lib/groupe.ts) : saisie du nombre, bornes, ajout et retrait de profils,
// changement de statut, prix du groupe, OPCO et budget du groupe. Fonctions pures ; attentes écrites à la main.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PERSONNES,
  MAX_PROFILS,
  champsDuProfilPrincipal,
  createInitialWizardState,
  nombreDePersonnes,
  profilsDuGroupe,
} from '@opco/core';
import type { ChampsProfil, ProfilSupplementaire, ProjetType, WizardState } from '@opco/core';
import { champsManquants, manquantsDuProfil } from '../src/lib/etapes';
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
  projetsDuGroupe,
  retirerProfil,
} from '../src/lib/groupe';
import { INSECABLE } from '../src/lib/insecable';
import { champsDepuisProjet, etatDepuisProjet } from '../src/lib/parcours';
import { STATUT_DU_PROFIL, libelleDuProfil } from '../src/lib/profils';
import { etiquettesDeSituation } from '../src/lib/situation';

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
/** Un état dont les profils ont ces projets, d'une personne chacun : le premier est le projet du profil principal. */
const avec = (...projets: WizardState['projetType'][]): WizardState => {
  const [principal, ...autres] = projets;
  return etat({ projetType: principal, autresProfils: autres.map((p, i) => extra(`profil-${i + 2}`, { projetType: p })) });
};

describe('saisie du nombre de personnes (lireEffectif)', () => {
  test('un entier de 1 à 99 est lu tel quel, les espaces autour sont ignorés', () => {
    assert.equal(lireEffectif('3'), 3);
    assert.equal(lireEffectif(' 12 '), 12);
    assert.equal(lireEffectif('0005'), 5);
    assert.equal(lireEffectif('99'), 99);
    assert.equal(lireEffectif(`${'0'.repeat(400)}7`), 7); // les zéros devant ne comptent pas, même nombreux
  });

  test('au-delà de 99 : 99, quel que soit le nombre de chiffres', () => {
    assert.equal(lireEffectif('150'), MAX_PERSONNES);
    assert.equal(lireEffectif('9999'), MAX_PERSONNES);
    assert.equal(lireEffectif('12345'), MAX_PERSONNES);
    assert.equal(lireEffectif('9'.repeat(400)), MAX_PERSONNES); // Number lit cette suite comme Infinity
    assert.equal(lireEffectif('1'.repeat(400)), MAX_PERSONNES);
  });

  test('zéro, vide, négatif, décimal, texte, notation scientifique : refusés (null), jamais NaN', () => {
    for (const saisie of ['0', '0000', '', ' ', '-3', '3,7', '3.7', 'abc', '1e2', '1 2']) {
      assert.equal(lireEffectif(saisie), null, JSON.stringify(saisie));
    }
    assert.equal(lireEffectif('0'.repeat(400)), null); // zéro, même écrit avec 400 chiffres
  });

  test('les chiffres autres que 0 à 9 (arabo-indiens, indiens, pleine chasse) sont refusés', () => {
    // Le zéro de chaque série : arabo-indien (U+0660), arabo-indien étendu (U+06F0), devanagari (U+0966), pleine chasse (U+FF10).
    for (const zero of [0x0660, 0x06f0, 0x0966, 0xff10]) {
      const chiffre = (n: number): string => String.fromCharCode(zero + n);
      const nom = `U+${zero.toString(16).toUpperCase()}`;
      assert.equal(lireEffectif(chiffre(3)), null, nom);
      assert.equal(lireEffectif(chiffre(1) + chiffre(2)), null, `${nom} sur deux chiffres`);
      assert.equal(lireEffectif(`1${chiffre(3)}`), null, `${nom} après un chiffre ASCII`);
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

// ---------------------------------------------------------------------------------------------------------------------
// Compléments aux tests ci-dessus : limites, ordre du retrait du surplus, identifiants repris, arrondi au centime, profil dont
// on lit les réponses, rang d'un profil dans l'OPCO et le budget, état toujours normalisé, suites d'opérations tirées au hasard.
//
// Cas sans effet : `ajouterProfil` à 6 profils ou à 99 personnes, `definirNombre` et `changerProjetDuProfil` avec un identifiant
// inconnu, `basculerModePrix` vers le groupe (à partir de deux personnes) sans prix saisi rendent l'état reçu lui-même (le même
// objet) : `useWizard` s'en sert dans `setState`, et un état identique n'y provoque aucun nouveau rendu. `retirerProfil` et
// `majProfil`, eux, rendent toujours un état normalisé neuf, même quand rien ne change : leurs tests comparent par valeur.
//
// Oracle : les attentes des cas écrits à la main sont écrites à la main. Les suites tirées au hasard recopient en revanche
// quelques formules de production pour vérifier chaque pas : l'expression régulière de `lireEffectif`, le coût horaire, la
// garde d'`ajouterProfil`, la borne de `definirNombre`, la condition d'`etatDepuisPrix` et les projets qui ouvrent le budget.
// Les cas écrits à la main les figent déjà.
// ---------------------------------------------------------------------------------------------------------------------

const PROJETS: ProjetType[] = [
  'formation_salarie',
  'reconversion_salarie',
  'recrutement_demandeur_emploi',
  'alternance',
  'formation_dirigeant',
];
/** Effectifs d'un état : le profil principal d'abord, puis les profils supplémentaires. */
const effectifs = (e: WizardState): number[] => [e.nombrePersonnes, ...e.autresProfils.map((p) => p.nombre)];
/** Nombre de personnes du groupe, compté ici et non par le cœur. */
const total = (e: WizardState): number => effectifs(e).reduce((somme, n) => somme + n, 0);
/** Un état dont le profil principal compte `principal` personnes, suivi de profils supplémentaires (profil-2, profil-3...) de ces effectifs. */
const groupeDe = (principal: number, autres: number[], maj: Partial<WizardState> = {}): WizardState =>
  etat({ ...maj, nombrePersonnes: principal, autresProfils: autres.map((nombre, i) => extra(`profil-${i + 2}`, { nombre })) });
/** Le même état que `avec(...projets)`, avec 2 000 € de budget déjà consommé. */
const avecBudget = (...projets: WizardState['projetType'][]): WizardState => ({ ...avec(...projets), budgetDejaConsomme: 2000 });
/** mulberry32 : tirages reproductibles dans [0, 1[ pour une graine donnée. */
const hasardFixe = (graine: number): (() => number) => {
  let g = graine;
  return () => {
    g = (g + 0x6d2b79f5) | 0;
    let t = Math.imul(g ^ (g >>> 15), 1 | g);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

describe('saisie du nombre de personnes : limites', () => {
  test('1 est le plus petit effectif ; les zéros devant, les espaces et les tabulations autour sont ignorés', () => {
    assert.equal(lireEffectif('1'), 1);
    assert.equal(lireEffectif('01'), 1);
    assert.equal(lireEffectif('\t7\n'), 7);
    assert.equal(lireEffectif('0099'), 99);
    assert.equal(lireEffectif('100'), MAX_PERSONNES);
  });

  test('3 000 saisies tirées au hasard (graine 11) : null ou un entier de 1 à 99, jamais NaN', () => {
    const hasard = hasardFixe(11);
    const signes = ['0', '1', '2', '5', '9', ' ', '\t', '-', '+', '.', ',', 'e', 'x'];
    for (let i = 0; i < 3000; i++) {
      const saisie = Array.from({ length: Math.floor(hasard() * 8) }, () => signes[Math.floor(hasard() * signes.length)]).join('');
      const lu = lireEffectif(saisie);
      assert.ok(lu === null || (Number.isInteger(lu) && lu >= 1 && lu <= MAX_PERSONNES), JSON.stringify(saisie));
      // Acceptée exactement quand elle est faite de chiffres de 0 à 9 seulement (un au moins), espaces autour mis à part, et que
      // sa valeur n'est pas 0.
      const attendue = /^[0-9]+$/.test(saisie.trim()) && Number(saisie.trim()) >= 1;
      assert.equal(lu !== null, attendue, JSON.stringify(saisie));
    }
  });
});

describe('normaliserGroupe : effectifs, surplus et prix du groupe', () => {
  test('une valeur non finie vaut une personne, comme dans le cœur', () => {
    for (const valeur of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      assert.deepEqual(effectifs(normaliserGroupe(groupeDe(valeur, [valeur]))), [1, 1], String(valeur));
    }
  });

  test('un effectif décimal est tronqué, pour un profil supplémentaire comme pour le profil principal', () => {
    assert.deepEqual(effectifs(normaliserGroupe(groupeDe(4.9, [2.9]))), [4, 2]);
  });

  test("pour un total d'au plus 99 personnes, les effectifs sont ceux de profilsDuGroupe, que le moteur lit", () => {
    // Le cœur ramène chaque effectif par `effectifValide` ; le site doit en faire autant, valeur par valeur (4 000 états tirés,
    // graine 7, effectifs absents, non finis, décimaux, négatifs ou trop grands compris).
    const hasard = hasardFixe(7);
    const valeurs: unknown[] = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -2, 0, 0.5, 1, 2.5, 3.9, 7, 20, 99, 150, null, undefined, '3'];
    const choisir = (): number => valeurs[Math.floor(hasard() * valeurs.length)] as number;
    let comparees = 0;
    for (let i = 0; i < 4000; i++) {
      const e = etat({
        nombrePersonnes: choisir(),
        autresProfils: Array.from({ length: Math.floor(hasard() * 6) }, (_, k) => extra(`profil-${k + 2}`, { nombre: choisir() })),
      });
      const duCoeur = profilsDuGroupe(e).map((p) => p.nombre);
      // Au-delà de 99 personnes, le site retire le surplus (autres tests) : ces états ne se comparent pas.
      if (duCoeur.reduce((somme, n) => somme + n, 0) > MAX_PERSONNES) continue;
      assert.deepEqual(effectifs(normaliserGroupe(e)), duCoeur, [e.nombrePersonnes, ...e.autresProfils.map((p) => p.nombre)].map(String).join());
      comparees++;
    }
    assert.ok(comparees > 1000, `${comparees} états comparés seulement`);
  });

  test('99 personnes tiennent ; à 100, une personne est retirée du dernier profil', () => {
    assert.deepEqual(effectifs(normaliserGroupe(groupeDe(60, [20, 19]))), [60, 20, 19]);
    assert.deepEqual(effectifs(normaliserGroupe(groupeDe(60, [20, 20]))), [60, 20, 19]);
  });

  test("le surplus est retiré du dernier profil jusqu'à une personne, puis du profil précédent", () => {
    // 160 personnes, 61 de trop : le dernier profil en perd 39 (il en garde 1), l'avant-dernier 22.
    assert.deepEqual(effectifs(normaliserGroupe(groupeDe(40, [40, 40, 40]))), [40, 40, 18, 1]);
  });

  test('puis du profil principal', () => {
    // 199 personnes, 100 de trop : les deux profils supplémentaires tombent à 1 (98 retirées), le principal perd les 2 autres.
    assert.deepEqual(effectifs(normaliserGroupe(groupeDe(99, [50, 50]))), [97, 1, 1]);
  });

  test('le prix du groupe se répartit sur tous les profils', () => {
    const e = normaliserGroupe(groupeDe(1, [3], { prixDuGroupe: 8000, durationHours: 40 }));
    assert.deepEqual([e.pedagogyCostTotal, e.pedagogyCostPerHour], [2000, 50]);
  });

  test('le surplus est retiré avant de diviser le prix : 99 personnes et non 198', () => {
    const e = normaliserGroupe(groupeDe(99, [99], { prixDuGroupe: 9900, durationHours: 20 }));
    assert.deepEqual(effectifs(e), [98, 1]);
    assert.deepEqual([e.pedagogyCostTotal, e.pedagogyCostPerHour], [100, 5]);
  });

  test("le coût d'une personne n'est pas arrondi : 10 000 € pour 3 personnes", () => {
    assert.equal(normaliserGroupe(etat({ nombrePersonnes: 3, prixDuGroupe: 10000 })).pedagogyCostTotal, 10000 / 3);
  });

  test('un état hors bornes revient dans les bornes, et normaliser de nouveau ne change plus rien', () => {
    const sept = Array.from({ length: 7 }, (_, i) =>
      extra(`profil-${i + 2}`, { nombre: i % 2 === 0 ? 60.7 : Number.POSITIVE_INFINITY }),
    );
    const hors = etat({ nombrePersonnes: Number.NaN, durationHours: 21, prixDuGroupe: 1000, autresProfils: sept });
    // 5 profils gardés (60, 1, 60, 1, 60) et 1 personne au profil principal : 183 personnes, 84 de trop. Le dernier profil
    // perd 59 personnes, le troisième 25.
    const une = normaliserGroupe(hors);
    assert.deepEqual(effectifs(une), [1, 60, 1, 35, 1, 1]);
    assert.deepEqual(normaliserGroupe(une), une);
  });
});

describe('profils : identifiants et profil neuf', () => {
  const avecIds = (...ids: string[]): WizardState => etat({ autresProfils: ids.map((id) => extra(id)) });

  test('le prochain identifiant est le plus petit « profil-N » libre à partir de N = 2', () => {
    const cas: [string[], string][] = [
      [[], 'profil-2'],
      [['profil-3'], 'profil-2'],
      [['profil-2'], 'profil-3'],
      [['profil-2', 'profil-4'], 'profil-3'],
      [['profil-4', 'profil-2', 'profil-3'], 'profil-5'],
    ];
    for (const [ids, attendu] of cas) assert.equal(prochainIdProfil(avecIds(...ids)), attendu, ids.join());
  });

  test('un profil neuf : une personne, aucune réponse, le projet du profil principal ou « former un salarié » sans projet', () => {
    const vide = {
      id: 'profil-2',
      nombre: 1,
      projetType: 'formation_salarie',
      contractType: null,
      anciennete_mois: null,
      isHandicap: false,
      ageBeneficiaire: null,
      niveauDiplome: null,
      typeAlternance: null,
      inscritFranceTravail: null,
      statutDirigeant: null,
      microEntrepreneur: null,
      soldeCpf: null,
      regionBeneficiaireCode: null,
    };
    const reponses = { contractType: 'cdi', anciennete_mois: 30, isHandicap: true, ageBeneficiaire: 33, soldeCpf: 100, regionBeneficiaireCode: '84' } as const;
    assert.deepEqual(nouveauProfil(etat({ ...reponses, projetType: null })), vide);
    assert.deepEqual(nouveauProfil(etat({ ...reponses, projetType: 'alternance' })), { ...vide, projetType: 'alternance' });
    assert.equal(nouveauProfil(avecIds('profil-2')).id, 'profil-3');
  });
});

describe('ajout et retrait de profils : limites et effets', () => {
  test("ajouter à 6 profils ou à 99 personnes rend l'état reçu lui-même", () => {
    let six = etat();
    for (let i = 0; i < 5; i++) six = ajouterProfil(six);
    assert.equal(six.autresProfils.length, 5);
    assert.equal(ajouterProfil(six), six);
    const plein = etat({ nombrePersonnes: 99 });
    assert.equal(ajouterProfil(plein), plein);
    const reparti = groupeDe(98, [1]); // 99 personnes sur deux profils
    assert.equal(ajouterProfil(reparti), reparti);
  });

  test("à 98 personnes un profil d'une personne tient encore ; à 4 profils supplémentaires un cinquième aussi", () => {
    assert.deepEqual(effectifs(ajouterProfil(etat({ nombrePersonnes: 98 }))), [98, 1]);
    assert.equal(ajouterProfil(groupeDe(1, [1, 1, 1, 1])).autresProfils.length, 5);
  });

  test('le profil neuf prend la dernière place, les autres profils ne changent pas', () => {
    const avant = groupeDe(2, [3, 4]);
    const apres = ajouterProfil(avant);
    assert.deepEqual(apres.autresProfils.slice(0, 2), avant.autresProfils);
    assert.equal(apres.autresProfils[2].id, 'profil-4');
    assert.deepEqual(effectifs(apres), [2, 3, 4, 1]);
  });

  test("retirer un profil du milieu garde les autres dans l'ordre et libère ses personnes", () => {
    const apres = retirerProfil(groupeDe(1, [2, 3, 4]), 'profil-3');
    assert.deepEqual(apres.autresProfils.map((p) => p.id), ['profil-2', 'profil-4']);
    assert.deepEqual(effectifs(apres), [1, 2, 4]);
  });

  test('retirer le profil principal ou un identifiant inconnu ne change rien', () => {
    const e = groupeDe(3, [2, 5]);
    assert.deepEqual(retirerProfil(e, 'principal'), e);
    assert.deepEqual(retirerProfil(e, 'profil-42'), e);
  });

  test("le prix du groupe suit les ajouts et les retraits : le coût d'une personne est recalculé", () => {
    const deux = etat({ nombrePersonnes: 2, prixDuGroupe: 8400, durationHours: 35, pedagogyCostTotal: 4200, pedagogyCostPerHour: 120 });
    const trois = ajouterProfil(deux);
    assert.deepEqual([trois.prixDuGroupe, trois.pedagogyCostTotal, trois.pedagogyCostPerHour], [8400, 2800, 80]);
    const retour = retirerProfil(trois, 'profil-2');
    assert.deepEqual([retour.prixDuGroupe, retour.pedagogyCostTotal, retour.pedagogyCostPerHour], [8400, 4200, 120]);
  });

  test("sous 2 personnes le prix du groupe est vidé, le coût d'une personne reste", () => {
    const deux = etatDepuisPrix(ajouterProfil(etat()), 8400, 35, true); // le profil principal et profil-2 : 4 200 € chacun
    assert.deepEqual([deux.prixDuGroupe, deux.pedagogyCostTotal], [8400, 4200]);
    const seul = retirerProfil(deux, 'profil-2');
    assert.deepEqual([seul.prixDuGroupe, seul.pedagogyCostTotal, seul.pedagogyCostPerHour], [null, 4200, 120]);
  });
});

describe('majProfil et changerProjetDuProfil : le bon profil, avec ses propres réponses', () => {
  test('parmi plusieurs profils supplémentaires, seul celui désigné change', () => {
    const e = groupeDe(1, [1, 1]);
    const apres = majProfil(e, 'profil-3', { ageBeneficiaire: 61, niveauDiplome: 'cap_bep' });
    assert.deepEqual([apres.ageBeneficiaire, apres.niveauDiplome], [null, null]);
    assert.deepEqual(apres.autresProfils[0], e.autresProfils[0]);
    assert.deepEqual([apres.autresProfils[1].ageBeneficiaire, apres.autresProfils[1].niveauDiplome], [61, 'cap_bep']);
  });

  test('un identifiant inconnu ne change rien', () => {
    const e = groupeDe(1, [1, 1]);
    assert.deepEqual(majProfil(e, 'profil-42', { ageBeneficiaire: 61 }), e);
  });

  test("le profil principal change les champs de l'état et laisse les profils supplémentaires", () => {
    const e = groupeDe(1, [1, 1]);
    const apres = majProfil(e, 'principal', { ageBeneficiaire: 25, projetType: 'formation_dirigeant' });
    assert.deepEqual([apres.ageBeneficiaire, apres.projetType], [25, 'formation_dirigeant']);
    assert.deepEqual(apres.autresProfils, e.autresProfils);
  });

  test('le contrat « alternance » vient des réponses du profil changé, pas de celles du profil principal', () => {
    // Le profil principal est un alternant qui a choisi son type de contrat ; profil-2 est un dirigeant qui n'en a pas choisi.
    const principalAlternant = { projetType: 'alternance', typeAlternance: 'apprentissage', contractType: 'alternance' } as const;
    let e = etat({ ...principalAlternant, autresProfils: [extra('profil-2', { projetType: 'formation_dirigeant' })] });
    assert.equal(changerProjetDuProfil(e, 'profil-2', 'alternance').autresProfils[0].contractType, null);
    // Quand profil-2 a choisi son type de contrat, « alternance » vient de lui, même si le profil principal n'en a pas.
    e = etat({
      projetType: 'formation_salarie',
      contractType: 'cdi',
      autresProfils: [extra('profil-2', { projetType: 'formation_dirigeant', typeAlternance: 'professionnalisation' })],
    });
    assert.equal(changerProjetDuProfil(e, 'profil-2', 'alternance').autresProfils[0].contractType, 'alternance');
    // Un alternant qui devient salarié perd « alternance », même si le contrat du profil principal est un autre.
    e = etat({
      projetType: 'formation_salarie',
      contractType: 'cdi',
      autresProfils: [extra('profil-2', { projetType: 'alternance', typeAlternance: 'apprentissage', contractType: 'alternance' })],
    });
    const salarie = changerProjetDuProfil(e, 'profil-2', 'formation_salarie').autresProfils[0];
    assert.deepEqual([salarie.contractType, salarie.typeAlternance], [null, null]);
  });

  test("changer le projet du profil principal vide ses réponses d'un autre statut et laisse les profils supplémentaires", () => {
    const e = etat({
      projetType: 'formation_dirigeant',
      statutDirigeant: 'artisan',
      soldeCpf: 700,
      ageBeneficiaire: 41,
      autresProfils: [extra('profil-2', { statutDirigeant: 'commercant', soldeCpf: 300 })],
    });
    const apres = changerProjetDuProfil(e, 'principal', 'recrutement_demandeur_emploi');
    assert.equal(apres.projetType, 'recrutement_demandeur_emploi');
    assert.deepEqual([apres.statutDirigeant, apres.soldeCpf, apres.ageBeneficiaire], [null, null, 41]);
    assert.deepEqual(apres.autresProfils, e.autresProfils);
  });

  test("un identifiant inconnu rend l'état reçu lui-même", () => {
    const e = groupeDe(1, [1]);
    assert.equal(changerProjetDuProfil(e, 'profil-42', 'alternance'), e);
  });
});

describe('definirNombre : bornes et effets', () => {
  test('parmi plusieurs profils, seul celui désigné change ; la place qui reste tient compte de tous les autres', () => {
    const e = groupeDe(10, [20, 30]); // 60 personnes
    assert.deepEqual(effectifs(definirNombre(e, 'profil-2', 5)), [10, 5, 30]);
    assert.deepEqual(effectifs(definirNombre(e, 'profil-3', 50)), [10, 20, 50]);
    assert.deepEqual(effectifs(definirNombre(e, 'profil-3', 90)), [10, 20, 69]); // 99 - 10 - 20
    assert.deepEqual(effectifs(definirNombre(e, 'profil-2', 90)), [10, 59, 30]); // 99 - 10 - 30
  });

  test('une valeur non finie ou négative vaut une personne, un décimal est tronqué', () => {
    const e = groupeDe(10, [20]);
    for (const valeur of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -5]) {
      assert.equal(definirNombre(e, 'principal', valeur).nombrePersonnes, 1, String(valeur));
      assert.equal(definirNombre(e, 'profil-2', valeur).autresProfils[0].nombre, 1, String(valeur));
    }
    assert.equal(definirNombre(e, 'principal', 7.9).nombrePersonnes, 7);
  });

  test("un identifiant inconnu rend l'état reçu lui-même", () => {
    const e = groupeDe(10, [20]);
    assert.equal(definirNombre(e, 'profil-42', 5), e);
  });

  test("le prix du groupe suit : le coût d'une personne est recalculé", () => {
    const deux = etat({ nombrePersonnes: 2, prixDuGroupe: 8400, durationHours: 35, pedagogyCostTotal: 4200, pedagogyCostPerHour: 120 });
    const quatre = definirNombre(deux, 'principal', 4);
    assert.deepEqual([quatre.prixDuGroupe, quatre.pedagogyCostTotal, quatre.pedagogyCostPerHour], [8400, 2100, 60]);
    const avecProfil = definirNombre(ajouterProfil(deux), 'profil-2', 3); // 2 + 3 personnes
    assert.deepEqual([avecProfil.pedagogyCostTotal, avecProfil.pedagogyCostPerHour], [1680, 48]);
    const vide = definirNombre(ajouterProfil(deux), 'principal', 1); // 1 + 1 personne
    assert.deepEqual([vide.prixDuGroupe, vide.pedagogyCostTotal], [8400, 4200]);
  });
});

describe('prix de la formation : cas limites', () => {
  test('pour le groupe, à exactement 2 personnes', () => {
    const e = etatDepuisPrix(etat({ nombrePersonnes: 2 }), 5600, 35, true);
    assert.deepEqual([e.pedagogyCostTotal, e.pedagogyCostPerHour, e.prixDuGroupe], [2800, 80, 5600]);
  });

  test('pour le groupe, tous les profils comptent et pas seulement le profil principal', () => {
    const e = etatDepuisPrix(groupeDe(1, [3]), 8000, 40, true);
    assert.deepEqual([e.pedagogyCostTotal, e.pedagogyCostPerHour, e.prixDuGroupe], [2000, 50, 8000]);
  });

  test("pour le groupe, le coût d'une personne n'est pas arrondi", () => {
    assert.equal(etatDepuisPrix(etat({ nombrePersonnes: 3 }), 10000, 35, true).pedagogyCostTotal, 10000 / 3);
  });

  test("pour le groupe sans durée : le coût d'une personne est calculé, le coût horaire est vide", () => {
    const e = etatDepuisPrix(etat({ nombrePersonnes: 4 }), 11200, null, true);
    assert.deepEqual([e.pedagogyCostTotal, e.pedagogyCostPerHour, e.durationHours, e.prixDuGroupe], [2800, null, null, 11200]);
  });

  test("passer à un prix par personne efface le prix du groupe ; le reste de l'état est gardé", () => {
    const groupe = etatDepuisPrix(etat({ nombrePersonnes: 4, companyName: 'Atelier Martin' }), 11200, 35, true);
    const parPersonne = etatDepuisPrix(groupe, 2400, 35, false);
    assert.deepEqual([parPersonne.prixDuGroupe, parPersonne.pedagogyCostTotal], [null, 2400]);
    assert.equal(parPersonne.pedagogyCostPerHour, 2400 / 35);
    assert.equal(parPersonne.companyName, 'Atelier Martin');
  });

  test('bascule vers le groupe : exactement 2 personnes, et tous les profils comptent', () => {
    const deux = basculerModePrix(etatDepuisPrix(etat({ nombrePersonnes: 2 }), 2800, 35, false), true);
    assert.equal(deux.prixDuGroupe, 5600);
    const profils = basculerModePrix(etatDepuisPrix(groupeDe(1, [3]), 2000, 40, false), true);
    assert.deepEqual([profils.prixDuGroupe, profils.pedagogyCostTotal, profils.pedagogyCostPerHour], [8000, 2000, 50]);
  });

  test("bascule vers le groupe avec une seule personne : le prix du groupe est vidé, même si l'état reçu en porte un", () => {
    assert.equal(basculerModePrix(etat({ prixDuGroupe: 2800 }), true).prixDuGroupe, null);
  });

  test('bascule vers le groupe : le prix est arrondi au centime, sans le bruit de la virgule flottante', () => {
    // 800,2 x 3 donne 2400,6000000000004 et 800,3 x 3 donne 2400,8999999999996 en virgule flottante. 33,35 x 3 = 100,05 : l'arrondi
    // se fait au centime, ni au dixième ni au millième. 1 234,5678 x 3 = 3 703,7034 : moins d'un centime de trop, arrondi au centime.
    const cas: [number, number, number][] = [
      [800.2, 3, 2400.6],
      [800.3, 3, 2400.9],
      [33.35, 3, 100.05],
      [1234.5678, 3, 3703.7],
    ];
    for (const [cout, personnes, prix] of cas) {
      const e = basculerModePrix(etatDepuisPrix(etat({ nombrePersonnes: personnes }), cout, 35, false), true);
      assert.equal(e.prixDuGroupe, prix, String(cout));
    }
  });

  test("bascule vers le groupe : le coût d'une personne redevient le prix du groupe divisé par l'effectif", () => {
    // 1 234,5678 € par personne donne 3 703,70 € pour 3 personnes, soit 1 234,5666... € par personne.
    const e = basculerModePrix(etatDepuisPrix(etat({ nombrePersonnes: 3 }), 1234.5678, 35, false), true);
    assert.equal(e.pedagogyCostTotal, 3703.7 / 3);
    assert.equal(e.pedagogyCostPerHour, 3703.7 / 3 / 35);
  });

  test("bascule : sans prix saisi l'état reçu est rendu tel quel ; déjà en mode groupe rien ne change", () => {
    const sansPrix = etat({ nombrePersonnes: 4 });
    assert.equal(basculerModePrix(sansPrix, true), sansPrix);
    const groupe = etatDepuisPrix(etat({ nombrePersonnes: 4 }), 11200, 35, true);
    assert.deepEqual(basculerModePrix(groupe, true), groupe);
  });
});

describe('OPCO et budget du groupe : tous les rangs comptent', () => {
  test("projetsDuGroupe : le profil principal d'abord, puis les autres dans l'ordre, projet non choisi compris", () => {
    assert.deepEqual(projetsDuGroupe(avec('formation_dirigeant', 'alternance', null, 'formation_salarie')), [
      'formation_dirigeant',
      'alternance',
      null,
      'formation_salarie',
    ]);
    assert.deepEqual(projetsDuGroupe(etat({ projetType: null })), [null]);
  });

  test('un salarié au milieu du groupe, ou au sixième rang, suffit', () => {
    const dirigeants = Array<'formation_dirigeant'>(5).fill('formation_dirigeant');
    for (const projets of [
      ['formation_dirigeant', 'formation_salarie', 'formation_dirigeant'],
      [...dirigeants, 'reconversion_salarie'],
    ] as const) {
      assert.equal(opcoRequisPourLeGroupe(avec(...projets)), true, projets.join());
      assert.equal(ouvreBudgetPourLeGroupe(avec(...projets)), true, projets.join());
    }
  });

  test('six dirigeants : OPCO facultatif, aucun budget', () => {
    const six = avec(...Array<'formation_dirigeant'>(6).fill('formation_dirigeant'));
    assert.equal(opcoRequisPourLeGroupe(six), false);
    assert.equal(ouvreBudgetPourLeGroupe(six), false);
  });

  test('un profil au projet non choisi compte comme un salarié, à son rang', () => {
    const groupe = avec('formation_dirigeant', 'formation_dirigeant', null);
    assert.equal(opcoRequisPourLeGroupe(groupe), true);
    assert.equal(ouvreBudgetPourLeGroupe(groupe), true);
  });
});

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

describe("normaliserGroupe : le budget déjà consommé se garde tant qu'un profil relève d'un projet salarié", () => {
  test('retirer le dernier profil salarié vide le budget ; retirer un autre profil le laisse', () => {
    assert.equal(retirerProfil(avecBudget('formation_dirigeant', 'formation_salarie'), 'profil-2').budgetDejaConsomme, null);
    const trois = avecBudget('formation_dirigeant', 'formation_salarie', 'formation_dirigeant');
    assert.equal(retirerProfil(trois, 'profil-3').budgetDejaConsomme, 2000);
    assert.equal(retirerProfil(trois, 'profil-2').budgetDejaConsomme, null);
  });

  test('passer le dernier profil salarié à un projet sans budget le vide, par changerProjetDuProfil comme par majProfil', () => {
    const groupe = avecBudget('formation_dirigeant', 'formation_salarie');
    for (const projet of ['formation_dirigeant', 'alternance', 'recrutement_demandeur_emploi'] as const) {
      assert.equal(changerProjetDuProfil(groupe, 'profil-2', projet).budgetDejaConsomme, null, projet);
      assert.equal(majProfil(groupe, 'profil-2', { projetType: projet }).budgetDejaConsomme, null, projet);
    }
    // Un autre projet salarié l'ouvre aussi : le budget reste.
    assert.equal(changerProjetDuProfil(groupe, 'profil-2', 'reconversion_salarie').budgetDejaConsomme, 2000);
  });

  test("il reste tant qu'un profil relève d'un projet salarié, quel que soit son rang", () => {
    const cas: [WizardState['projetType'][], string][] = [
      [['formation_salarie', 'formation_dirigeant', 'formation_dirigeant'], 'principal'],
      [['formation_dirigeant', 'formation_salarie', 'formation_dirigeant'], 'profil-2'],
      [['formation_dirigeant', 'formation_dirigeant', 'reconversion_salarie'], 'profil-3'],
    ];
    for (const [projets, salarie] of cas) {
      const groupe = avecBudget(...projets);
      const nom = projets.join();
      assert.equal(normaliserGroupe(groupe).budgetDejaConsomme, 2000, nom);
      // Les deux autres profils ne l'ouvrent pas : changer leurs réponses ou leur projet, ou les retirer, laisse le budget.
      for (const autre of ['principal', 'profil-2', 'profil-3'].filter((id) => id !== salarie)) {
        assert.equal(majProfil(groupe, autre, { ageBeneficiaire: 40 }).budgetDejaConsomme, 2000, `${nom} : âge de ${autre}`);
        assert.equal(changerProjetDuProfil(groupe, autre, 'alternance').budgetDejaConsomme, 2000, `${nom} : ${autre} en alternance`);
        if (autre !== 'principal') assert.equal(retirerProfil(groupe, autre).budgetDejaConsomme, 2000, `${nom} : ${autre} retiré`);
      }
      // Le profil salarié est le seul : le quitter, ou le retirer, vide le budget.
      assert.equal(changerProjetDuProfil(groupe, salarie, 'formation_dirigeant').budgetDejaConsomme, null, `${nom} : ${salarie} dirigeant`);
      if (salarie !== 'principal') assert.equal(retirerProfil(groupe, salarie).budgetDejaConsomme, null, `${nom} : ${salarie} retiré`);
    }
  });

  test("un projet non choisi compte comme ouvert : le budget reste, jusqu'à ce que tous les projets soient choisis", () => {
    assert.equal(normaliserGroupe(avecBudget(null)).budgetDejaConsomme, 2000);
    const groupe = avecBudget('formation_dirigeant', null);
    assert.equal(normaliserGroupe(groupe).budgetDejaConsomme, 2000);
    assert.equal(majProfil(groupe, 'principal', { ageBeneficiaire: 40 }).budgetDejaConsomme, 2000);
    assert.equal(majProfil(groupe, 'profil-2', { projetType: 'alternance' }).budgetDejaConsomme, null);
  });

  test("dirigeant, alternance et demandeur d'emploi n'ouvrent pas le budget : vidé, même à zéro", () => {
    for (const projets of [
      ['formation_dirigeant'],
      ['alternance'],
      ['recrutement_demandeur_emploi'],
      ['formation_dirigeant', 'alternance', 'recrutement_demandeur_emploi'],
    ] as const) {
      assert.equal(normaliserGroupe(avecBudget(...projets)).budgetDejaConsomme, null, projets.join());
    }
    assert.equal(normaliserGroupe({ ...avec('formation_dirigeant'), budgetDejaConsomme: 0 }).budgetDejaConsomme, null);
  });

  test('un profil au-delà du cinquième supplémentaire ne compte pas : retiré par la normalisation, il ne garde pas le budget', () => {
    const dirigeants = Array<'formation_dirigeant'>(5).fill('formation_dirigeant');
    const groupe = avecBudget('formation_dirigeant', ...dirigeants, 'formation_salarie', 'formation_salarie');
    assert.equal(groupe.autresProfils.length, 7);
    const normalise = normaliserGroupe(groupe);
    assert.equal(normalise.autresProfils.length, 5);
    assert.equal(normalise.budgetDejaConsomme, null);
  });

  test("changerProjetDuProfil du profil principal donne le budget d'etatDepuisProjet pour le même changement", () => {
    const groupes = [
      avecBudget('formation_salarie'),
      avecBudget('formation_salarie', 'formation_dirigeant'),
      avecBudget('formation_dirigeant', 'formation_salarie'),
      avecBudget('formation_dirigeant', 'alternance', null),
      avecBudget('alternance', 'recrutement_demandeur_emploi'),
      avecBudget('formation_dirigeant', 'formation_dirigeant'),
    ];
    for (const groupe of groupes) {
      for (const projet of PROJETS) {
        const attendu = { ...groupe, ...etatDepuisProjet(groupe, projet) }.budgetDejaConsomme;
        const nom = `${projetsDuGroupe(groupe).join()} -> ${projet}`;
        assert.equal(changerProjetDuProfil(groupe, 'principal', projet).budgetDejaConsomme, attendu, nom);
      }
    }
  });

  test('idempotente, budget compris', () => {
    for (const projets of [['formation_dirigeant'], ['formation_dirigeant', 'formation_salarie'], [null], ['alternance', 'formation_dirigeant']] as const) {
      const une = normaliserGroupe(avecBudget(...projets));
      assert.deepEqual(normaliserGroupe(une), une, projets.join());
    }
  });
});

describe("toutes les opérations : un état normalisé en sortie, l'état reçu intact", () => {
  /** Un état hors bornes, comme celui d'une source qui ne passe pas par ces fonctions : 120 personnes, un effectif nul, un prix du groupe. */
  const hors = (): WizardState => groupeDe(120, [0, 30], { prixDuGroupe: 1000, pedagogyCostTotal: 500, durationHours: 10 });
  const cas: [string, (e: WizardState) => WizardState][] = [
    ['retirerProfil', (e) => retirerProfil(e, 'profil-3')],
    ['majProfil, profil principal', (e) => majProfil(e, 'principal', { ageBeneficiaire: 30 })],
    ['majProfil, profil supplémentaire', (e) => majProfil(e, 'profil-2', { ageBeneficiaire: 30 })],
    ['changerProjetDuProfil', (e) => changerProjetDuProfil(e, 'profil-2', 'alternance')],
    ['definirNombre, profil principal', (e) => definirNombre(e, 'principal', 50)],
    ['definirNombre, profil supplémentaire', (e) => definirNombre(e, 'profil-2', 5)],
    ['basculerModePrix', (e) => basculerModePrix(e, true)],
  ];
  for (const [nom, operation] of cas) {
    test(`${nom} : état rendu normalisé, état reçu intact`, () => {
      const entree = hors();
      const copie = structuredClone(entree);
      const sortie = operation(entree);
      assert.deepEqual(entree, copie);
      assert.deepEqual(normaliserGroupe(sortie), sortie);
    });
  }

  test('ajouterProfil : état rendu normalisé, état reçu intact', () => {
    const entree = groupeDe(Number.NaN, [0.5], { prixDuGroupe: 1000, pedagogyCostTotal: 500, durationHours: 10 });
    const copie = structuredClone(entree);
    const sortie = ajouterProfil(entree);
    assert.deepEqual(entree, copie);
    assert.deepEqual(effectifs(sortie), [1, 1, 1]);
    assert.deepEqual(normaliserGroupe(sortie), sortie);
  });
});

describe("suites d'opérations tirées au hasard (graine 2026)", () => {
  test('40 suites de 100 opérations : effectifs, profils, prix du groupe, coûts et budget restent cohérents', () => {
    const hasard = hasardFixe(2026);
    const choisir = <T>(valeurs: readonly T[]): T => valeurs[Math.floor(hasard() * valeurs.length)];
    /** Un profil au moins relève d'un projet qui ouvre le budget : salarié, reconversion, ou projet non choisi. */
    const ouvreLeBudget = (e: WizardState): boolean =>
      [e.projetType, ...e.autresProfils.map((p) => p.projetType)].some((p) => p == null || p === 'formation_salarie' || p === 'reconversion_salarie');

    /** Invariants d'un état de groupe, écrits à la main. */
    const verifier = (e: WizardState, contexte: string): void => {
      const nombres = effectifs(e);
      assert.ok(nombres.every((n) => Number.isInteger(n) && n >= 1 && n <= MAX_PERSONNES), `${contexte} : effectifs ${nombres.join()}`);
      assert.ok(total(e) <= MAX_PERSONNES, `${contexte} : ${total(e)} personnes`);
      assert.ok(e.autresProfils.length <= MAX_PROFILS - 1, `${contexte} : ${e.autresProfils.length} profils supplémentaires`);
      const ids = e.autresProfils.map((p) => p.id);
      assert.equal(new Set(ids).size, ids.length, `${contexte} : identifiants en double ${ids.join()}`);
      assert.ok(ids.every((id) => /^profil-\d+$/.test(id)), `${contexte} : identifiant ${ids.join()}`);
      if (total(e) < 2) assert.equal(e.prixDuGroupe, null, `${contexte} : prix du groupe pour ${total(e)} personne`);
      if (e.prixDuGroupe != null) {
        const ecart = Math.abs((e.pedagogyCostTotal ?? Number.NaN) * total(e) - e.prixDuGroupe);
        assert.ok(ecart <= 1e-6 * Math.max(1, e.prixDuGroupe), `${contexte} : ${e.pedagogyCostTotal} x ${total(e)} pour ${e.prixDuGroupe}`);
      }
      const cout = e.pedagogyCostTotal;
      const heures = e.durationHours;
      assert.equal(e.pedagogyCostPerHour, cout && heures && heures > 0 ? cout / heures : null, `${contexte} : coût horaire`);
      for (const v of [e.prixDuGroupe, e.pedagogyCostTotal, e.pedagogyCostPerHour, e.durationHours, e.budgetDejaConsomme]) {
        assert.ok(v === null || Number.isFinite(v), `${contexte} : ${v}`);
      }
      if (e.budgetDejaConsomme != null) assert.ok(ouvreLeBudget(e), `${contexte} : budget ${e.budgetDejaConsomme} sans projet salarié`);
      assert.deepEqual(normaliserGroupe(e), e, `${contexte} : état non normalisé`);
    };

    const vus = { cinqProfils: false, quatreVingtDixNeuf: false, prixDuGroupe: false, sansEffet: false, budgetGarde: false, budgetVide: false };
    for (let suite = 0; suite < 40; suite++) {
      let e = etat();
      for (let pas = 0; pas < 100; pas++) {
        const avant = e;
        const copie = structuredClone(avant);
        const id = choisir(['principal', ...avant.autresProfils.map((p) => p.id), 'profil-42']);
        const profil = avant.autresProfils.find((p) => p.id === id);
        const connu = id === 'principal' || profil != null;
        const operation = Math.floor(hasard() * 8);
        const contexte = `suite ${suite}, pas ${pas}, opération ${operation}`;
        if (operation === 0) {
          e = ajouterProfil(avant);
          if (avant.autresProfils.length < MAX_PROFILS - 1 && total(avant) < MAX_PERSONNES) {
            assert.deepEqual([e.autresProfils.length, total(e)], [avant.autresProfils.length + 1, total(avant) + 1], contexte);
          } else assert.equal(e, avant, contexte);
        } else if (operation === 1) {
          e = retirerProfil(avant, id);
          const attendu = [avant.autresProfils.length - (profil ? 1 : 0), total(avant) - (profil?.nombre ?? 0)];
          assert.deepEqual([e.autresProfils.length, total(e)], attendu, contexte);
        } else if (operation === 2) {
          const age = Math.floor(hasard() * 70);
          e = majProfil(avant, id, { ageBeneficiaire: age });
          assert.deepEqual(effectifs(e), effectifs(avant), contexte);
          if (id === 'principal') assert.equal(e.ageBeneficiaire, age, contexte);
          else if (profil) assert.equal(e.autresProfils.find((p) => p.id === id)?.ageBeneficiaire, age, contexte);
          else assert.deepEqual(e, avant, contexte);
        } else if (operation === 3) {
          const projet = choisir(PROJETS);
          e = changerProjetDuProfil(avant, id, projet);
          assert.deepEqual(effectifs(e), effectifs(avant), contexte);
          if (id === 'principal') assert.equal(e.projetType, projet, contexte);
          else if (profil) assert.equal(e.autresProfils.find((p) => p.id === id)?.projetType, projet, contexte);
          else assert.equal(e, avant, contexte);
        } else if (operation === 4) {
          const demande = choisir([0, 1, 2, 5, 7.9, 30, 60, 98, 99, 150, -3, Number.NaN, Number.POSITIVE_INFINITY]);
          e = definirNombre(avant, id, demande);
          if (connu) {
            const place = MAX_PERSONNES - (total(avant) - (profil ? profil.nombre : avant.nombrePersonnes));
            const attendu = Math.max(1, Math.min(Number.isFinite(demande) ? Math.floor(demande) : 1, place));
            assert.equal(profil ? e.autresProfils.find((p) => p.id === id)?.nombre : e.nombrePersonnes, attendu, contexte);
          } else assert.equal(e, avant, contexte);
        } else if (operation === 5) {
          const saisie = choisir([null, 0, 900, 2800, 5600.5, 10000]);
          const heures = choisir([null, 0, 7, 35, 140]);
          const pourLeGroupe = hasard() < 0.5;
          e = etatDepuisPrix(avant, saisie, heures, pourLeGroupe);
          assert.equal(e.prixDuGroupe, pourLeGroupe && total(avant) >= 2 ? saisie : null, contexte);
          assert.equal(e.durationHours, heures, contexte);
        } else if (operation === 6) {
          // Saisie du budget déjà consommé : gardé si un profil relève d'un projet salarié, vidé sinon.
          const budget = choisir([null, 0, 500, 2000]);
          e = normaliserGroupe({ ...avant, budgetDejaConsomme: budget });
          assert.equal(e.budgetDejaConsomme, ouvreLeBudget(avant) ? budget : null, contexte);
        } else {
          e = basculerModePrix(avant, hasard() < 0.5);
        }
        assert.deepEqual(avant, copie, `${contexte} : l'état reçu a été modifié`);
        // Les autres opérations gardent le budget tant qu'un profil relève d'un projet salarié, et le vident sinon.
        if (operation !== 6) assert.equal(e.budgetDejaConsomme, ouvreLeBudget(e) ? avant.budgetDejaConsomme : null, `${contexte} : budget`);
        verifier(e, contexte);
        if (e.autresProfils.length === MAX_PROFILS - 1) vus.cinqProfils = true;
        if (total(e) === MAX_PERSONNES) vus.quatreVingtDixNeuf = true;
        if (e.prixDuGroupe != null && total(e) >= 2) vus.prixDuGroupe = true;
        if (e === avant) vus.sansEffet = true;
        if (operation !== 6 && avant.budgetDejaConsomme != null) {
          if (e.budgetDejaConsomme == null) vus.budgetVide = true;
          else vus.budgetGarde = true;
        }
      }
    }
    const tous = { cinqProfils: true, quatreVingtDixNeuf: true, prixDuGroupe: true, sansEffet: true, budgetGarde: true, budgetVide: true };
    assert.deepEqual(vus, tous, 'les suites doivent visiter les cas limites');
  });
});

describe("champs manquants d'un groupe (étape Participants)", () => {
  test("un seul profil : les textes d'une personne seule, sans nom de profil, quel que soit l'effectif", () => {
    assert.deepEqual(champsManquants('situation', etat()), ['le type de contrat']);
    assert.deepEqual(champsManquants('situation', etat({ contractType: 'cdi' })), []);
    assert.deepEqual(champsManquants('situation', etat({ nombrePersonnes: 4, contractType: 'cdi' })), []);
  });

  test('plusieurs profils : chaque manque nomme son profil', () => {
    const e = etat({
      contractType: null,
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
    assert.deepEqual(champsManquants('situation', etat({ contractType: 'cdi', autresProfils: [complet] })), []);
    assert.deepEqual(champsManquants('situation', etat({ contractType: 'cdi', autresProfils: [extra('profil-2')] })), [
      'le type de contrat (profil 2)',
    ]);
  });

  test("OPCO : requis dès qu'un profil n'est pas un dirigeant", () => {
    const dirigeantSeul = etat({ projetType: 'formation_dirigeant', regionCode: '11', companySize: 'less_11' });
    assert.deepEqual(champsManquants('identification', dirigeantSeul), []);
    assert.deepEqual(champsManquants('identification', { ...dirigeantSeul, autresProfils: [extra('profil-2')] }), ["l'OPCO"]);
  });

  test('manquantsDuProfil : un projet non choisi manque au profil', () => {
    assert.deepEqual(manquantsDuProfil({ ...champsDuProfilPrincipal(createInitialWizardState()), projetType: null }), ['votre projet (étape 1)']);
  });
});

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

// ---------------------------------------------------------------------------------------------------------------------
// Compléments aux trois blocs ci-dessus, attentes écrites à la main : chaque branche de `manquantsDuProfil` et son texte,
// numéro de profil et effectif dans `champsManquants`, OPCO selon tous les profils, chaque statut et chaque reste de saisie
// du libellé d'un profil, `STATUT_DU_PROFIL`, cas limites des étiquettes du groupe.
// ---------------------------------------------------------------------------------------------------------------------

describe('manquantsDuProfil : chaque statut, champ par champ', () => {
  const sur = (maj: Partial<ChampsProfil>): ChampsProfil => ({ ...champsDuProfilPrincipal(createInitialWizardState()), ...maj });
  const manque = (projetType: ProjetType | null, maj: Partial<ChampsProfil> = {}): string[] => manquantsDuProfil(sur({ projetType, ...maj }));

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
    // Un âge est une réponse dès qu'il est posé, même à zéro (présence, pas valeur).
    assert.deepEqual(manque('alternance', { typeAlternance: 'apprentissage', ageBeneficiaire: 0 }), []);
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

  test('six profils au plus, 99 personnes au plus', () => {
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
