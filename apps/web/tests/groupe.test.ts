// État d'un groupe de personnes formées (lib/groupe.ts) : saisie du nombre, bornes, ajout et retrait de profils,
// changement de statut, prix du groupe, OPCO et budget du groupe. Fonctions pures ; attentes écrites à la main.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PERSONNES, MAX_PROFILS, createInitialWizardState, nombreDePersonnes } from '@opco/core';
import type { ChampsProfil, ProfilSupplementaire, ProjetType, WizardState } from '@opco/core';
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
import { champsDepuisProjet, etatDepuisProjet } from '../src/lib/parcours';

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

// ---------------------------------------------------------------------------------------------------------------------
// Compléments aux tests ci-dessus : limites, ordre du retrait du surplus, identifiants repris, arrondi au centime, cas sans
// effet (l'état reçu est rendu tel quel), profil dont on lit les réponses, rang d'un profil dans l'OPCO et le budget, état
// toujours normalisé, suites d'opérations tirées au hasard. Chaque attente est écrite à la main.
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
/** Un état dont les profils ont ces projets, d'une personne chacun : le premier est le projet du profil principal. */
const groupeDeProjets = (...projets: WizardState['projetType'][]): WizardState => {
  const [principal, ...autres] = projets;
  return etat({ projetType: principal, autresProfils: autres.map((p, i) => extra(`profil-${i + 2}`, { projetType: p })) });
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
    // mulberry32 : tirages reproductibles.
    let graine = 11;
    const hasard = (): number => {
      graine = (graine + 0x6d2b79f5) | 0;
      let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const signes = ['0', '1', '2', '5', '9', ' ', '\t', '-', '+', '.', ',', 'e', 'x'];
    for (let i = 0; i < 3000; i++) {
      const saisie = Array.from({ length: Math.floor(hasard() * 8) }, () => signes[Math.floor(hasard() * signes.length)]).join('');
      const lu = lireEffectif(saisie);
      assert.ok(lu === null || (Number.isInteger(lu) && lu >= 1 && lu <= MAX_PERSONNES), JSON.stringify(saisie));
      // Acceptée exactement quand elle est faite de 1 à 4 chiffres, espaces autour mis à part, et que sa valeur n'est pas 0.
      const attendue = /^[0-9]{1,4}$/.test(saisie.trim()) && Number(saisie.trim()) >= 1;
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

  test('99 personnes tiennent ; à 100, une personne est retirée du dernier profil', () => {
    assert.deepEqual(effectifs(normaliserGroupe(groupeDe(60, [20, 19]))), [60, 20, 19]);
    assert.deepEqual(effectifs(normaliserGroupe(groupeDe(60, [20, 20]))), [60, 20, 19]);
  });

  test("le surplus est retiré du dernier profil jusqu'à une personne, puis du profil précédent", () => {
    // 160 personnes, 61 de trop : le dernier profil en perd 39 (il en garde 1), l'avant-dernier 22.
    assert.deepEqual(effectifs(normaliserGroupe(groupeDe(40, [40, 40, 40]))), [40, 40, 18, 1]);
  });

  test('puis du profil principal, qui garde au moins une personne', () => {
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
    assert.equal(normaliserGroupe(etat({ nombrePersonnes: 3, prixDuGroupe: 10000 })).pedagogyCostTotal, 3333.3333333333335);
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
    assert.equal(etatDepuisPrix(etat({ nombrePersonnes: 3 }), 10000, 35, true).pedagogyCostTotal, 3333.3333333333335);
  });

  test("pour le groupe sans durée : le coût d'une personne est calculé, le coût horaire est vide", () => {
    const e = etatDepuisPrix(etat({ nombrePersonnes: 4 }), 11200, null, true);
    assert.deepEqual([e.pedagogyCostTotal, e.pedagogyCostPerHour, e.durationHours, e.prixDuGroupe], [2800, null, null, 11200]);
  });

  test("passer à un prix par personne efface le prix du groupe ; le reste de l'état est gardé", () => {
    const groupe = etatDepuisPrix(etat({ nombrePersonnes: 4, companyName: 'Atelier Martin' }), 11200, 35, true);
    const parPersonne = etatDepuisPrix(groupe, 2400, 35, false);
    assert.deepEqual([parPersonne.prixDuGroupe, parPersonne.pedagogyCostTotal], [null, 2400]);
    assert.equal(parPersonne.pedagogyCostPerHour, 68.57142857142857);
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
    assert.deepEqual(projetsDuGroupe(groupeDeProjets('formation_dirigeant', 'alternance', null, 'formation_salarie')), [
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
      assert.equal(opcoRequisPourLeGroupe(groupeDeProjets(...projets)), true, projets.join());
      assert.equal(ouvreBudgetPourLeGroupe(groupeDeProjets(...projets)), true, projets.join());
    }
  });

  test('six dirigeants : OPCO facultatif, aucun budget', () => {
    const six = groupeDeProjets(...Array<'formation_dirigeant'>(6).fill('formation_dirigeant'));
    assert.equal(opcoRequisPourLeGroupe(six), false);
    assert.equal(ouvreBudgetPourLeGroupe(six), false);
  });

  test('un profil au projet non choisi compte comme un salarié, à son rang', () => {
    const groupe = groupeDeProjets('formation_dirigeant', 'formation_dirigeant', null);
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
  const avecBudget = (...projets: WizardState['projetType'][]): WizardState => ({ ...groupeDeProjets(...projets), budgetDejaConsomme: 2000 });

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
  test('40 suites de 100 opérations : effectifs, profils, prix du groupe et coûts restent cohérents', () => {
    // mulberry32 : tirages reproductibles.
    let graine = 2026;
    const hasard = (): number => {
      graine = (graine + 0x6d2b79f5) | 0;
      let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const choisir = <T>(valeurs: readonly T[]): T => valeurs[Math.floor(hasard() * valeurs.length)];

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
      for (const v of [e.prixDuGroupe, e.pedagogyCostTotal, e.pedagogyCostPerHour, e.durationHours]) {
        assert.ok(v === null || Number.isFinite(v), `${contexte} : ${v}`);
      }
      assert.deepEqual(normaliserGroupe(e), e, `${contexte} : état non normalisé`);
    };

    const vus = { cinqProfils: false, quatreVingtDixNeuf: false, prixDuGroupe: false, sansEffet: false };
    for (let suite = 0; suite < 40; suite++) {
      let e = etat();
      for (let pas = 0; pas < 100; pas++) {
        const avant = e;
        const copie = structuredClone(avant);
        const id = choisir(['principal', ...avant.autresProfils.map((p) => p.id), 'profil-42']);
        const profil = avant.autresProfils.find((p) => p.id === id);
        const connu = id === 'principal' || profil != null;
        const operation = Math.floor(hasard() * 7);
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
        } else {
          e = basculerModePrix(avant, hasard() < 0.5);
        }
        assert.deepEqual(avant, copie, `${contexte} : l'état reçu a été modifié`);
        verifier(e, contexte);
        if (e.autresProfils.length === MAX_PROFILS - 1) vus.cinqProfils = true;
        if (total(e) === MAX_PERSONNES) vus.quatreVingtDixNeuf = true;
        if (e.prixDuGroupe != null && total(e) >= 2) vus.prixDuGroupe = true;
        if (e === avant) vus.sansEffet = true;
      }
    }
    assert.deepEqual(vus, { cinqProfils: true, quatreVingtDixNeuf: true, prixDuGroupe: true, sansEffet: true }, 'les suites doivent visiter les cas limites');
  });
});
