// Réponses « Je ne sais pas » de chaque profil du groupe (lib/groupe.ts : `inconnuesApresMaj`, `inconnuesSansProfil`) : elles
// suivent les règles de `reponsesInconnuesApres` (lib/parcours.ts), profil par profil, sans toucher aux autres profils.
// Fonctions pures. Oracle : les attentes des deux premiers blocs sont écrites à la main ; le troisième prend
// `reponsesInconnuesApres` pour référence, y compris dans le modèle de sa suite tirée au hasard (graine 12). Il vérifie que
// le registre applique cette fonction à chaque profil, sans entrée de trop, et non ses règles : leurs attentes écrites à la
// main sont dans parcours.test.ts.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { ChampsProfil, ProjetType } from '@opco/core';
import { ajouterProfil, inconnuesApresMaj, inconnuesSansProfil, prochainIdProfil, retirerProfil } from '../src/lib/groupe';
import type { InconnuesParProfil } from '../src/lib/groupe';
import { champsDepuisProjet, reponsesInconnuesApres } from '../src/lib/parcours';
import type { QuestionAvecInconnu, QuestionDeProfil } from '../src/lib/parcours';
import { PROJETS, etat, hasardFixe, vides } from './fixtures-groupe';

describe('réponses « Je ne sais pas » par profil', () => {
  test("une réponse « Je ne sais pas » s'ajoute au profil concerné, sans toucher aux autres", () => {
    const a = inconnuesApresMaj({}, 'profil-2', { inscritFranceTravail: null }, 'inscritFranceTravail');
    assert.deepEqual([...a['profil-2']], ['inscritFranceTravail']);
    const b = inconnuesApresMaj(a, 'profil-3', { microEntrepreneur: null }, 'microEntrepreneur');
    assert.deepEqual([...b['profil-3']], ['microEntrepreneur']);
    assert.deepEqual([...b['profil-2']], ['inscritFranceTravail']);
  });

  test('répondre ensuite oui ou non efface la réponse « Je ne sais pas »', () => {
    const a = inconnuesApresMaj({}, 'profil-2', { inscritFranceTravail: null }, 'inscritFranceTravail');
    assert.equal(inconnuesApresMaj(a, 'profil-2', { inscritFranceTravail: true })['profil-2'].has('inscritFranceTravail'), false);
  });

  test('un changement de statut efface les réponses des questions remises à vide', () => {
    const a = inconnuesApresMaj({}, 'profil-2', { inscritFranceTravail: null }, 'inscritFranceTravail');
    const vers = inconnuesApresMaj(a, 'profil-2', champsDepuisProjet(vides, 'formation_dirigeant'));
    assert.equal(vers['profil-2'].has('inscritFranceTravail'), false);
  });

  test('retirer un profil efface ses réponses ; son identifiant peut resservir sans rien garder', () => {
    const a = inconnuesApresMaj({}, 'profil-2', { inscritFranceTravail: null }, 'inscritFranceTravail');
    const b = inconnuesApresMaj(a, 'profil-3', { microEntrepreneur: null }, 'microEntrepreneur');
    const sans = inconnuesSansProfil(b, 'profil-2');
    assert.equal('profil-2' in sans, false);
    assert.equal('profil-3' in sans, true);
    assert.equal(inconnuesSansProfil(sans, 'profil-42'), sans);
    // Un profil neuf qui reprend l'identifiant libéré n'a aucune réponse « Je ne sais pas ».
    assert.equal(sans['profil-2'], undefined);
  });

  test('une mise à jour qui ne touche aucune question rend le même objet', () => {
    const a = inconnuesApresMaj({}, 'profil-2', { inscritFranceTravail: null }, 'inscritFranceTravail');
    assert.equal(inconnuesApresMaj(a, 'profil-4', { ageBeneficiaire: 30 }), a);
  });
});

describe('réponses « Je ne sais pas » par profil : cas limites', () => {
  /** profil-2 a répondu « Je ne sais pas » à inscritFranceTravail, profil-3 à microEntrepreneur. */
  const deuxProfils = (): InconnuesParProfil =>
    inconnuesApresMaj(
      inconnuesApresMaj({}, 'profil-2', { inscritFranceTravail: null }, 'inscritFranceTravail'),
      'profil-3',
      { microEntrepreneur: null },
      'microEntrepreneur',
    );

  test("les réponses « Je ne sais pas » d'un même profil s'additionnent", () => {
    const a = inconnuesApresMaj({}, 'profil-2', { inscritFranceTravail: null }, 'inscritFranceTravail');
    const b = inconnuesApresMaj(a, 'profil-2', { microEntrepreneur: null }, 'microEntrepreneur');
    assert.deepEqual([...b['profil-2']].sort(), ['inscritFranceTravail', 'microEntrepreneur']);
  });

  test('répondre une seconde fois « Je ne sais pas » à la même question ne change rien (même objet)', () => {
    const a = deuxProfils();
    assert.equal(inconnuesApresMaj(a, 'profil-2', { inscritFranceTravail: null }, 'inscritFranceTravail'), a);
  });

  test("répondre oui ou non n'efface que la réponse de cette question, dans ce profil", () => {
    // profil-2 a répondu « Je ne sais pas » aux deux questions, profil-3 à microEntrepreneur.
    const a = inconnuesApresMaj(deuxProfils(), 'profil-2', { microEntrepreneur: null }, 'microEntrepreneur');
    for (const reponse of [true, false]) {
      const france = inconnuesApresMaj(a, 'profil-2', { inscritFranceTravail: reponse });
      assert.deepEqual([...france['profil-2']], ['microEntrepreneur'], `inscritFranceTravail : ${reponse}`);
      const micro = inconnuesApresMaj(a, 'profil-2', { microEntrepreneur: reponse });
      assert.deepEqual([...micro['profil-2']], ['inscritFranceTravail'], `microEntrepreneur : ${reponse}`);
      assert.equal(france['profil-3'], a['profil-3']);
    }
  });

  test('toute écriture de la question efface sa réponse : oui, non, null sans la marque, et même sans valeur', () => {
    const a = deuxProfils();
    for (const valeur of [true, false, null, undefined]) {
      const france = inconnuesApresMaj(a, 'profil-2', { inscritFranceTravail: valeur });
      assert.equal(france['profil-2'].has('inscritFranceTravail'), false, `inscritFranceTravail : ${valeur}`);
      const micro = inconnuesApresMaj(a, 'profil-3', { microEntrepreneur: valeur });
      assert.equal(micro['profil-3'].has('microEntrepreneur'), false, `microEntrepreneur : ${valeur}`);
    }
  });

  test('un changement de statut garde les réponses des questions que le nouveau statut pose encore, et efface les autres', () => {
    // Écrit à la main : les statuts salarié et dirigeant ne posent pas la question France Travail, les statuts demandeur
    // d'emploi et alternant la posent, seul le dirigeant pose celle de la micro-entreprise.
    const cas: [ProjetType, QuestionDeProfil[]][] = [
      ['formation_salarie', []],
      ['reconversion_salarie', []],
      ['recrutement_demandeur_emploi', ['inscritFranceTravail']],
      ['alternance', ['inscritFranceTravail']],
      ['formation_dirigeant', ['microEntrepreneur']],
    ];
    const a = inconnuesApresMaj(deuxProfils(), 'profil-2', { microEntrepreneur: null }, 'microEntrepreneur');
    for (const [projet, restent] of cas) {
      const b = inconnuesApresMaj(a, 'profil-2', champsDepuisProjet(vides, projet));
      assert.deepEqual([...b['profil-2']], restent, projet);
      assert.equal(b['profil-3'], a['profil-3'], `${projet} : profil-3`);
    }
  });

  test("écrire la question d'un profil ne touche pas la même question chez les autres (ils gardent le même ensemble)", () => {
    let a = inconnuesApresMaj({}, 'profil-2', { inscritFranceTravail: null }, 'inscritFranceTravail');
    a = inconnuesApresMaj(a, 'profil-3', { inscritFranceTravail: null }, 'inscritFranceTravail');
    a = inconnuesApresMaj(a, 'profil-4', { microEntrepreneur: null }, 'microEntrepreneur');
    const cas: [string, Partial<ChampsProfil>][] = [
      ['réponse oui', { inscritFranceTravail: true }],
      ['écriture sans valeur', { inscritFranceTravail: undefined }],
      ['changement de statut', champsDepuisProjet(vides, 'formation_salarie')],
    ];
    for (const [nom, maj] of cas) {
      const b = inconnuesApresMaj(a, 'profil-3', maj);
      assert.equal(b['profil-3'].size, 0, `${nom} : profil-3`);
      assert.equal(b['profil-2'], a['profil-2'], `${nom} : profil-2`);
      assert.equal(b['profil-4'], a['profil-4'], `${nom} : profil-4`);
    }
  });

  test("une mise à jour d'une autre réponse du même profil garde ses réponses « Je ne sais pas » (même objet)", () => {
    const a = deuxProfils();
    assert.equal(inconnuesApresMaj(a, 'profil-2', { ageBeneficiaire: 30, isHandicap: true }), a);
    assert.equal(inconnuesApresMaj(a, 'profil-2', {}), a);
  });

  test("un profil sans entrée qui reçoit une mise à jour sans effet n'en gagne pas", () => {
    const vide: InconnuesParProfil = {};
    assert.equal(inconnuesApresMaj(vide, 'profil-2', { ageBeneficiaire: 30 }), vide);
    assert.equal(inconnuesApresMaj(vide, 'profil-2', { inscritFranceTravail: true }), vide);
    assert.equal(inconnuesApresMaj(vide, 'profil-2', champsDepuisProjet(vides, 'formation_dirigeant')), vide);
    assert.deepEqual(vide, {});
  });

  test("le registre reçu n'est jamais modifié, ni ses ensembles", () => {
    const a = deuxProfils();
    const copie = structuredClone(a);
    inconnuesApresMaj(a, 'profil-2', { inscritFranceTravail: true });
    inconnuesApresMaj(a, 'profil-2', champsDepuisProjet(vides, 'formation_salarie'));
    inconnuesApresMaj(a, 'profil-3', { microEntrepreneur: null }, 'microEntrepreneur');
    inconnuesApresMaj(a, 'profil-4', { microEntrepreneur: null }, 'microEntrepreneur');
    inconnuesSansProfil(a, 'profil-3');
    inconnuesSansProfil(a, 'profil-42');
    assert.deepEqual(a, copie);
  });

  test('retirer un profil ne garde que les autres, chacun avec son propre ensemble, quel que soit son rang', () => {
    const a = inconnuesApresMaj(deuxProfils(), 'profil-4', { inscritFranceTravail: null }, 'inscritFranceTravail');
    const ids = ['profil-2', 'profil-3', 'profil-4'];
    for (const retire of ids) {
      const sans = inconnuesSansProfil(a, retire);
      const restent = ids.filter((id) => id !== retire);
      assert.deepEqual(Object.keys(sans).sort(), restent, retire);
      for (const id of restent) assert.equal(sans[id], a[id], `${retire} retiré : ${id}`);
    }
  });

  test('retirer un profil absent, ou retirer deux fois le même, rend le même objet', () => {
    const vide: InconnuesParProfil = {};
    assert.equal(inconnuesSansProfil(vide, 'profil-2'), vide);
    const sans = inconnuesSansProfil(deuxProfils(), 'profil-3');
    assert.equal(inconnuesSansProfil(sans, 'profil-3'), sans);
  });

  test("l'identifiant libéré par un profil retiré resservira au profil suivant, qui n'hérite d'aucune réponse", () => {
    // Les deux opérations que `useWizard` enchaîne pour retirer un profil : l'état du groupe et le registre des réponses.
    let e = ajouterProfil(ajouterProfil(etat()));
    let r = deuxProfils();
    assert.deepEqual(
      e.autresProfils.map((p) => p.id),
      ['profil-2', 'profil-3'],
    );
    e = retirerProfil(e, 'profil-2');
    r = inconnuesSansProfil(r, 'profil-2');
    assert.equal(prochainIdProfil(e), 'profil-2');
    e = ajouterProfil(e);
    const neuf = e.autresProfils[e.autresProfils.length - 1].id;
    assert.equal(neuf, 'profil-2');
    assert.equal(r[neuf], undefined);
    const apres = inconnuesApresMaj(r, neuf, { microEntrepreneur: null }, 'microEntrepreneur');
    assert.deepEqual([...apres[neuf]], ['microEntrepreneur']);
    assert.deepEqual([...apres['profil-3']], ['microEntrepreneur']);
  });
});

describe('réponses « Je ne sais pas » par profil : même comportement que celles du profil principal', () => {
  /** Mises à jour d'un profil : les réponses écrites et, le cas échéant, la question à laquelle l'utilisateur répond « Je ne sais pas ». */
  const etapes: [Partial<ChampsProfil>, QuestionDeProfil?][] = [
    [{ inscritFranceTravail: null }, 'inscritFranceTravail'],
    [{ microEntrepreneur: null }, 'microEntrepreneur'],
    [{ inscritFranceTravail: true }],
    [{ inscritFranceTravail: false }],
    [{ microEntrepreneur: true }],
    [{ microEntrepreneur: false }],
    [{ inscritFranceTravail: null }],
    [{ microEntrepreneur: undefined }],
    [{ inscritFranceTravail: true, microEntrepreneur: null }, 'microEntrepreneur'],
    [{ inscritFranceTravail: null, microEntrepreneur: null }, 'inscritFranceTravail'],
    [{ ageBeneficiaire: 30 }],
    [{ isHandicap: true }],
    [{}],
    ...PROJETS.map((projet): [Partial<ChampsProfil>] => [champsDepuisProjet(vides, projet)]),
  ];

  test('chaque mise à jour donne au profil les réponses de reponsesInconnuesApres, et rend le même objet quand elle rend le même ensemble', () => {
    const departs: (QuestionDeProfil[] | null)[] = [
      null,
      [],
      ['inscritFranceTravail'],
      ['microEntrepreneur'],
      ['inscritFranceTravail', 'microEntrepreneur'],
    ];
    for (const depart of departs) {
      const ensemble: ReadonlySet<QuestionAvecInconnu> = new Set(depart ?? []);
      const autre: ReadonlySet<QuestionAvecInconnu> = new Set(['microEntrepreneur']);
      const registre: InconnuesParProfil = depart === null ? { 'profil-3': autre } : { 'profil-2': ensemble, 'profil-3': autre };
      etapes.forEach(([maj, inconnue], i) => {
        const contexte = `départ ${depart === null ? 'sans entrée' : depart.join('+') || 'vide'}, étape ${i}`;
        const attendu = reponsesInconnuesApres(ensemble, maj, inconnue);
        const obtenu = inconnuesApresMaj(registre, 'profil-2', maj, inconnue);
        assert.deepEqual([...(obtenu['profil-2'] ?? [])].sort(), [...attendu].sort(), contexte);
        assert.equal(obtenu === registre, attendu === ensemble, contexte);
        assert.equal(obtenu['profil-3'], autre, `${contexte} : profil-3`);
      });
    }
  });

  test('3 000 mises à jour et retraits tirés au hasard (graine 12) sur trois profils : chacun suit reponsesInconnuesApres, aucune entrée de trop', () => {
    const hasard = hasardFixe(12);
    const choisir = <T>(valeurs: readonly T[]): T => valeurs[Math.floor(hasard() * valeurs.length)];
    const ids = ['profil-2', 'profil-3', 'profil-4'];
    const aucune: ReadonlySet<QuestionAvecInconnu> = new Set();
    // Le modèle : l'ensemble de chaque profil, mis à jour par reponsesInconnuesApres seul, et son entrée quand elle existe.
    const modele = new Map<string, ReadonlySet<QuestionAvecInconnu>>();
    let registre: InconnuesParProfil = {};
    const vus = { ajout: false, efface: false, sansEffet: false, creation: false, retrait: false, retraitSansEffet: false };
    for (let pas = 0; pas < 3000; pas++) {
      const avant = registre;
      const id = choisir(ids);
      const contexte = `pas ${pas}, ${id}`;
      if (hasard() < 0.1) {
        registre = inconnuesSansProfil(avant, id);
        assert.equal(registre === avant, !(id in avant), contexte);
        if (id in avant) vus.retrait = true;
        else vus.retraitSansEffet = true;
        modele.delete(id);
      } else {
        const [maj, inconnue] = choisir(etapes);
        const ensembleAvant = modele.get(id) ?? aucune;
        const ensembleApres = reponsesInconnuesApres(ensembleAvant, maj, inconnue);
        registre = inconnuesApresMaj(avant, id, maj, inconnue);
        assert.equal(registre === avant, ensembleApres === ensembleAvant, contexte);
        if (ensembleApres !== ensembleAvant) modele.set(id, ensembleApres);
        if (ensembleApres.size > ensembleAvant.size) vus.ajout = true;
        if (ensembleApres.size < ensembleAvant.size) vus.efface = true;
        if (ensembleApres === ensembleAvant) vus.sansEffet = true;
        if (!(id in avant) && id in registre) vus.creation = true;
      }
      assert.deepEqual(Object.keys(registre).sort(), [...modele.keys()].sort(), `${contexte} : entrées du registre`);
      for (const profil of ids) {
        assert.deepEqual([...(registre[profil] ?? [])].sort(), [...(modele.get(profil) ?? [])].sort(), `${contexte} : ${profil}`);
        if (profil !== id) assert.equal(registre[profil], avant[profil], `${contexte} : ${profil} gardé tel quel`);
      }
    }
    const tous = { ajout: true, efface: true, sansEffet: true, creation: true, retrait: true, retraitSansEffet: true };
    assert.deepEqual(vus, tous, 'la suite doit visiter chaque cas');
  });
});
