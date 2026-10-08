// Étape « Entreprise » : cohérence de l'état du parcours quand une entreprise est choisie ou écartée, et quand
// l'effectif exact change. Les entreprises viennent de réponses réelles de l'API recherche-entreprises (fixtures), lues
// par le vrai `parseResultatRechercheEntreprises` et résolues par le vrai `resoudreOpco` de @opco/core.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  EMBEDDED_IDCC,
  EMBEDDED_NAF,
  bornesEffectif,
  createInitialWizardState,
  parseResultatRechercheEntreprises,
  profilDepuisWizard,
  resoudreOpco,
} from '@opco/core';
import type { CompanySize, EntreeResolution, EntrepriseInfo, WizardState } from '@opco/core';
import {
  entreeDeResolution,
  etatDepuisEffectif,
  etatDepuisEntreprise,
  etatSansEntreprise,
  opcoRequis,
  ouvreBudgetOpco,
  preselectionParNaf,
  texteDuResolveur,
  trancheDepuisEffectif,
} from '../src/lib/entreprise';
import { texteFr } from '../src/lib/format';

const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');

const reponses = (JSON.parse(lire('./fixtures/recherche-entreprises.json')) as { results: Record<string, unknown>[] })
  .results;
const ENTREPRISES: EntrepriseInfo[] = reponses.map(parseResultatRechercheEntreprises);
const parSiren = (siren: string): EntrepriseInfo => {
  const e = ENTREPRISES.find((x) => x.siren === siren);
  assert.ok(e, `entreprise ${siren} absente des fixtures`);
  return e;
};
const resoudre = (e: EntrepriseInfo) =>
  resoudreOpco(
    { idccs: e.idccs, idccSiege: e.idccSiege, codeNaf: e.codeNaf, natureJuridique: e.natureJuridique },
    EMBEDDED_IDCC,
    EMBEDDED_NAF,
  );
const appliquer = (etat: WizardState, maj: Partial<WizardState>): WizardState => ({ ...etat, ...maj });
const choisir = (etat: WizardState, e: EntrepriseInfo): WizardState => appliquer(etat, etatDepuisEntreprise(e, resoudre(e)));

// ------------------------------------------------------------------------------------------------------------------
// Classement de chaque champ de l'étape Entreprise. La liste des champs est lue dans le bloc « Étape 1 » de WizardState
// (packages/core/src/types.ts) : un champ ajouté plus tard à ce bloc fait échouer la garde tant qu'il n'est pas classé.
// ------------------------------------------------------------------------------------------------------------------
const sourceTypes = lire('../../../packages/core/src/types.ts');
const blocEtape1 = sourceTypes.slice(
  sourceTypes.indexOf('// Étape 1 : entreprise et OPCO'),
  sourceTypes.indexOf('// Étape 2 : bénéficiaire'),
);
const CHAMPS_ETAPE_ENTREPRISE = [...blocEtape1.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);

/** Établis par la recherche : posés ensemble à la sélection, effacés ensemble quand l'entreprise est écartée. */
const ETABLIS_PAR_LA_RECHERCHE = [
  'companyName',
  'detectedCompanyName',
  'sirenNumber',
  'siret',
  'detectedOpcoSlug',
  'detectedIdcc',
  'opcoCertitude',
  'idccEtablissements',
  'idccSiege',
  'codeNaf',
  'natureJuridique',
  'trancheEffectifInsee',
  'structures',
  'selectedBrancheId',
];
/** Posés (ou effacés) à la sélection, mais que l'utilisateur peut choisir lui-même : gardés quand l'entreprise est écartée. */
const POSES_A_LA_SELECTION_PUIS_GARDES = ['regionCode', 'departementCode', 'companySize', 'effectif', 'selectedOpcoSlug'];
/** Saisis par l'utilisateur seulement : ni la sélection ni la réinitialisation n'y touchent. */
const SAISIS_PAR_L_UTILISATEUR = ['opcoKnown', 'budgetDejaConsomme'];

const trie = (cles: Iterable<string>) => [...cles].sort();

describe("garde de complétude des champs de l'étape Entreprise", () => {
  test('le bloc « Étape 1 » de WizardState est lu dans types.ts', () => {
    assert.ok(CHAMPS_ETAPE_ENTREPRISE.length >= 20, `seulement ${CHAMPS_ETAPE_ENTREPRISE.length} champs lus`);
    for (const champ of CHAMPS_ETAPE_ENTREPRISE) assert.ok(champ in createInitialWizardState(), champ);
  });

  test("chaque champ est posé par la sélection, remis à zéro par la réinitialisation ou saisi par l'utilisateur", () => {
    const classes = [...ETABLIS_PAR_LA_RECHERCHE, ...POSES_A_LA_SELECTION_PUIS_GARDES, ...SAISIS_PAR_L_UTILISATEUR];
    assert.equal(new Set(classes).size, classes.length, 'un champ est classé deux fois');
    assert.deepEqual(trie(classes), trie(CHAMPS_ETAPE_ENTREPRISE));
  });

  test('la sélection écrit exactement les champs déclarés, la réinitialisation exactement ceux de la recherche', () => {
    const sfg = parSiren('814739728');
    assert.deepEqual(
      trie(Object.keys(etatDepuisEntreprise(sfg, resoudre(sfg)))),
      trie([...ETABLIS_PAR_LA_RECHERCHE, ...POSES_A_LA_SELECTION_PUIS_GARDES]),
    );
    assert.deepEqual(trie(Object.keys(etatSansEntreprise())), trie(ETABLIS_PAR_LA_RECHERCHE));
  });
});

describe("sélection d'une entreprise (etatDepuisEntreprise)", () => {
  test('SFG DEVELOPPEMENT : la mise à jour complète, valeur par valeur', () => {
    const sfg = parSiren('814739728');
    assert.deepEqual(etatDepuisEntreprise(sfg, resoudre(sfg)), {
      companyName: 'SFG DEVELOPPEMENT',
      detectedCompanyName: 'SFG DEVELOPPEMENT',
      sirenNumber: '814739728',
      siret: '81473972800024',
      detectedOpcoSlug: 'akto',
      detectedIdcc: '1516',
      opcoCertitude: 'fiable',
      idccEtablissements: ['1516'],
      idccSiege: ['1516'],
      regionCode: '11',
      departementCode: '95',
      codeNaf: '85.59A',
      natureJuridique: '5710',
      trancheEffectifInsee: '01',
      structures: [],
      companySize: 'less_11',
      effectif: null,
      selectedOpcoSlug: null,
      selectedBrancheId: null,
    });
  });

  test('chaque entreprise des fixtures : valeurs tirées de la réponse et de la résolution, sans rien muter', () => {
    for (const e of ENTREPRISES) {
      const r = resoudre(e);
      const copieE = structuredClone(e);
      const copieR = structuredClone(r);
      const maj = etatDepuisEntreprise(e, r);
      assert.deepEqual(e, copieE, `${e.siren} : l'entreprise a été modifiée`);
      assert.deepEqual(r, copieR, `${e.siren} : la résolution a été modifiée`);
      assert.equal(maj.sirenNumber, e.siren);
      assert.equal(maj.siret, e.siege.siret === '' ? null : e.siege.siret, `${e.siren} : siret`);
      assert.equal(maj.detectedOpcoSlug, r.opcoSlug);
      assert.equal(maj.detectedIdcc, r.idccRetenu);
      assert.equal(maj.opcoCertitude, r.certitude);
      assert.deepEqual(maj.idccEtablissements, e.idccs);
      assert.deepEqual(maj.idccSiege, e.idccSiege);
      assert.equal(maj.regionCode, e.siege.region);
      assert.equal(maj.departementCode, e.siege.departement);
      assert.equal(maj.codeNaf, e.codeNaf);
      assert.equal(maj.natureJuridique, e.natureJuridique);
      assert.equal(maj.trancheEffectifInsee, e.trancheEffectif);
      assert.deepEqual(maj.structures, e.structures);
      assert.equal(maj.companySize, e.tailleSuggeree ?? null, `${e.siren} : taille`);
      assert.equal(maj.effectif, null);
    }
  });

  test('SIRET du siège vide ou absent dans la réponse : null, jamais une chaîne vide', () => {
    const sfg = reponses.find((r) => r.siren === '814739728');
    assert.ok(sfg);
    const siegeVide = { ...structuredClone(sfg), siege: { ...(sfg.siege as Record<string, unknown>), siret: '' } };
    const { siret: _absent, ...siegeSansSiret } = sfg.siege as Record<string, unknown>;
    void _absent;
    for (const brute of [siegeVide, { ...structuredClone(sfg), siege: siegeSansSiret }]) {
      const e = parseResultatRechercheEntreprises(brute);
      assert.equal(e.siege.siret, '');
      const maj = etatDepuisEntreprise(e, resoudre(e));
      assert.ok('siret' in maj);
      assert.equal(maj.siret, null);
    }
  });

  test("aucun tableau de l'état n'est partagé avec la réponse de l'API", () => {
    for (const e of ENTREPRISES) {
      const maj = etatDepuisEntreprise(e, resoudre(e));
      const sources: unknown[] = [e.idccs, e.idccSiege, e.structures, e.siege.idccs, ...e.etablissements.map((x) => x.idccs)];
      for (const champ of ['idccEtablissements', 'idccSiege', 'structures'] as const) {
        assert.ok(!sources.includes(maj[champ]), `${e.siren} : ${champ} partagé`);
      }
    }
  });

  test("jamais la taille ni l'effectif d'une entreprise précédente", () => {
    const airbus = parSiren('383474814');
    const precedente = appliquer(choisir(createInitialWizardState(), airbus), etatDepuisEffectif(777));
    assert.equal(precedente.companySize, '300_plus');
    // Tranche INSEE 32 (250 à 499 salariés) : à cheval sur deux tailles, aucune suggestion.
    const voyages = parSiren('379601974');
    assert.equal(voyages.tailleSuggeree, null);
    const apres = choisir(precedente, voyages);
    assert.equal(apres.companySize, null);
    assert.equal(apres.effectif, null);
    // Une entreprise dont l'INSEE suggère une taille la reçoit, quelle que soit la précédente.
    assert.equal(choisir(precedente, parSiren('814739728')).companySize, 'less_11');
  });

  test("le moteur d'aides voit l'entreprise choisie, et rien de la précédente", () => {
    for (const e of ENTREPRISES) {
      const r = resoudre(e);
      const sale = appliquer(createInitialWizardState(), {
        sirenNumber: '000000000',
        idccEtablissements: ['9998', '1234'],
        codeNaf: '00.00Z',
        structures: ['ess', 'siae'],
        detectedIdcc: '1234',
        selectedOpcoSlug: 'atlas',
        selectedBrancheId: 'une-branche',
      });
      const etat = choisir(sale, e);
      const profil = profilDepuisWizard(etat, etat.selectedOpcoSlug || etat.detectedOpcoSlug);
      assert.deepEqual(profil.structures, e.structures, `${e.siren} : statuts`);
      assert.equal(profil.codeNaf, e.codeNaf);
      const idccs = [...e.idccs];
      if (r.idccRetenu && !idccs.includes(r.idccRetenu)) idccs.push(r.idccRetenu);
      assert.deepEqual(profil.idccs, idccs, `${e.siren} : IDCC`);
      assert.equal(profil.regionEntreprise, e.siege.region);
      assert.equal(profil.opco, r.opcoSlug, `${e.siren} : le choix manuel fait pour l'entreprise précédente est annulé`);
    }
  });
});

describe('entreprise écartée (etatSansEntreprise)', () => {
  test("restaure exactement les champs de la recherche et garde les choix de l'utilisateur", () => {
    const initial = createInitialWizardState();
    for (const e of ENTREPRISES) {
      const choisie = appliquer(choisir(createInitialWizardState(), e), {
        selectedOpcoSlug: 'opco-ep',
        selectedBrancheId: 'coiffure',
        regionCode: '84',
        departementCode: '69',
        ...etatDepuisEffectif(42),
        budgetDejaConsomme: 1500.5,
        opcoKnown: false,
      });
      const apres = appliquer(choisie, etatSansEntreprise());
      for (const champ of ETABLIS_PAR_LA_RECHERCHE as (keyof WizardState)[]) {
        assert.deepEqual(apres[champ], initial[champ], `${e.siren} : ${champ} non restauré`);
      }
      for (const champ of [...POSES_A_LA_SELECTION_PUIS_GARDES, ...SAISIS_PAR_L_UTILISATEUR] as (keyof WizardState)[]) {
        assert.deepEqual(apres[champ], choisie[champ], `${e.siren} : ${champ} perdu`);
      }
      const profil = profilDepuisWizard(apres, apres.selectedOpcoSlug || apres.detectedOpcoSlug);
      assert.equal(profil.structures, null, 'statuts inconnus sans entreprise');
      assert.deepEqual(profil.idccs, []);
      assert.equal(profil.codeNaf, null);
    }
  });

  test('deux réinitialisations ne partagent aucun tableau', () => {
    const a = etatSansEntreprise();
    const b = etatSansEntreprise();
    for (const champ of ['idccEtablissements', 'idccSiege', 'structures'] as const) assert.notEqual(a[champ], b[champ]);
    a.idccEtablissements?.push('1516');
    assert.deepEqual(etatSansEntreprise().idccEtablissements, []);
  });
});

describe("taille déduite de l'effectif exact", () => {
  test('bornes de chaque tranche', () => {
    const attendu: [number, CompanySize][] = [
      [0, 'less_11'],
      [10, 'less_11'],
      [11, '11_49'],
      [49, '11_49'],
      [50, '50_299'],
      [299, '50_299'],
      [300, '300_plus'],
      [12000, '300_plus'],
    ];
    for (const [n, taille] of attendu) assert.equal(trancheDepuisEffectif(n), taille, `effectif ${n}`);
  });

  test("de 0 à 1 000 salariés, la tranche déduite contient l'effectif selon bornesEffectif du moteur", () => {
    for (let n = 0; n <= 1000; n++) {
      const { min, max } = bornesEffectif(null, trancheDepuisEffectif(n));
      assert.ok(min != null && min <= n && (max == null || n <= max), `effectif ${n} hors de [${min}, ${max}]`);
    }
  });

  test("saisir l'effectif impose la tranche ; l'effacer garde la dernière tranche", () => {
    assert.deepEqual(etatDepuisEffectif(120), { effectif: 120, companySize: '50_299' });
    assert.deepEqual(etatDepuisEffectif(null), { effectif: null });
  });

  test("après toute suite d'actions, la taille et l'effectif ne se contredisent jamais", () => {
    // mulberry32 : tirages indépendants et reproductibles.
    let graine = 7;
    const hasard = (n: number) => {
      graine = (graine + 0x6d2b79f5) | 0;
      let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
    };
    const TAILLES: CompanySize[] = ['less_11', '11_49', '50_299', '300_plus'];
    for (let partie = 0; partie < 300; partie++) {
      let etat = createInitialWizardState();
      const historique: string[] = [];
      let derniere: EntrepriseInfo | null = null;
      for (let coup = 0; coup < 8; coup++) {
        const action = hasard(5);
        if (action === 0) {
          derniere = ENTREPRISES[hasard(ENTREPRISES.length)];
          etat = choisir(etat, derniere);
          historique.push(`choisir ${derniere.siren}`);
          assert.equal(etat.companySize, derniere.tailleSuggeree ?? null, historique.join(' > '));
        } else if (action === 1) {
          etat = appliquer(etat, etatSansEntreprise());
          derniere = null;
          historique.push('écarter');
        } else if (action === 2) {
          const n = hasard(1200);
          etat = appliquer(etat, etatDepuisEffectif(n));
          historique.push(`effectif ${n}`);
        } else if (action === 3) {
          etat = appliquer(etat, etatDepuisEffectif(null));
          historique.push("effacer l'effectif");
        } else if (etat.effectif == null) {
          // Les boutons de tranche ne sont proposés que sans effectif saisi.
          const taille = TAILLES[hasard(4)];
          etat = appliquer(etat, { companySize: taille });
          historique.push(`taille ${taille}`);
        }
        const contexte = historique.join(' > ');
        if (etat.effectif != null) assert.equal(etat.companySize, trancheDepuisEffectif(etat.effectif), contexte);
        // Ce que lit le moteur d'aides (effectif d'abord) tient dans la tranche que lit le calcul OPCO.
        const profil = profilDepuisWizard(etat, null);
        const bornes = bornesEffectif(null, etat.companySize);
        if (profil.effectifMin != null && bornes.min != null) {
          assert.ok(profil.effectifMin >= bornes.min, contexte);
          assert.ok(bornes.max == null || (profil.effectifMax ?? Infinity) <= bornes.max, contexte);
        }
      }
      if (derniere) {
        // Les champs établis par la recherche ne gardent aucune trace des entreprises précédentes : ils valent ceux
        // d'une sélection faite depuis l'état initial.
        const neuf = choisir(createInitialWizardState(), derniere);
        for (const champ of ETABLIS_PAR_LA_RECHERCHE as (keyof WizardState)[]) {
          assert.deepEqual(etat[champ], neuf[champ], `${historique.join(' > ')} : ${champ}`);
        }
      }
    }
  });
});

describe('règles par projet', () => {
  test("l'OPCO n'est facultatif que pour former le dirigeant", () => {
    assert.equal(opcoRequis('formation_dirigeant'), false);
    for (const p of ['formation_salarie', 'reconversion_salarie', 'recrutement_demandeur_emploi', 'alternance', null] as const) {
      assert.equal(opcoRequis(p), true, String(p));
    }
  });

  test('seuls les projets de salariés (ou un projet non choisi) ouvrent un budget OPCO', () => {
    for (const p of ['formation_salarie', 'reconversion_salarie', null] as const) assert.equal(ouvreBudgetOpco(p), true);
    for (const p of ['recrutement_demandeur_emploi', 'alternance', 'formation_dirigeant'] as const) {
      assert.equal(ouvreBudgetOpco(p), false);
    }
  });
});

describe("entrée du résolveur d'OPCO (entreeDeResolution) : la catégorie juridique suit l'entreprise", () => {
  /** Réponse de l'API pour un EHPAD (NAF 87.10A) sans convention collective, de catégorie juridique `nature`. */
  const ehpad = (nature: string): EntrepriseInfo => {
    const brut = structuredClone(reponses[0]) as Record<string, unknown> & {
      complements: Record<string, unknown>;
      siege: Record<string, unknown>;
      matching_etablissements?: Record<string, unknown>[];
    };
    brut.nature_juridique = nature;
    brut.activite_principale = '87.10A';
    brut.complements.liste_idcc = [];
    brut.siege.liste_idcc = [];
    for (const e of brut.matching_etablissements ?? []) e.liste_idcc = [];
    return parseResultatRechercheEntreprises(brut);
  };
  /** Ce que fait l'étape Entreprise quand elle revient : la résolution recalculée depuis l'état. */
  const depuisLEtat = (etat: WizardState) =>
    resoudreOpco(
      entreeDeResolution({
        idccs: etat.idccEtablissements,
        idccSiege: etat.idccSiege,
        codeNaf: etat.codeNaf,
        natureJuridique: etat.natureJuridique,
      }),
      EMBEDDED_IDCC,
      EMBEDDED_NAF,
    );

  test('conventions, NAF et catégorie juridique de l’entreprise, copiés', () => {
    const sfg = parSiren('814739728');
    const entree = entreeDeResolution(sfg);
    assert.deepEqual(entree, { idccs: ['1516'], idccSiege: ['1516'], codeNaf: '85.59A', natureJuridique: '5710' });
    assert.notEqual(entree.idccs, sfg.idccs);
    assert.equal(entreeDeResolution({ ...sfg, idccSiege: null }).idccSiege, null);
  });

  test('non-régression : un EHPAD public (7366) sans convention ne reçoit aucun OPCO d’après son seul code NAF, une société au même code NAF en reçoit un', () => {
    const publique = ehpad('7366');
    const resolue = resoudreOpco(entreeDeResolution(publique), EMBEDDED_IDCC, EMBEDDED_NAF);
    assert.deepEqual([resolue.opcoSlug, resolue.certitude], [null, 'inconnu']);
    assert.match(resolue.motif, /employeurs publics/);
    const etat = choisir(createInitialWizardState(), publique);
    assert.equal(etat.natureJuridique, '7366');
    assert.equal(etat.detectedOpcoSlug, null);
    assert.equal(etat.opcoCertitude, 'inconnu');
    // Quand l'étape revient, la carte recalcule la même résolution depuis l'état.
    assert.deepEqual([depuisLEtat(etat).opcoSlug, depuisLEtat(etat).certitude], [null, 'inconnu']);

    const societe = choisir(createInitialWizardState(), ehpad('5710'));
    assert.equal(societe.detectedOpcoSlug, 'opco-sante');
    assert.equal(societe.opcoCertitude, 'a_confirmer');
    assert.deepEqual([depuisLEtat(societe).opcoSlug, depuisLEtat(societe).certitude], ['opco-sante', 'a_confirmer']);
  });

  test('entreprise écartée : la catégorie juridique revient à vide avec le reste de la recherche', () => {
    const etat = appliquer(choisir(createInitialWizardState(), ehpad('7366')), etatSansEntreprise());
    assert.equal(etat.natureJuridique, null);
  });
});

describe("textes du résolveur d'OPCO prêts à l'affichage (texteDuResolveur)", () => {
  const NBSP = String.fromCharCode(0xa0);
  // Suggestion par code NAF sans convention (EHPAD privé, 87.10A) : le motif porte un pourcentage et un code NAF à point.
  const motifNaf = resoudreOpco(
    { idccs: [], idccSiege: [], codeNaf: '87.10A', natureJuridique: '5710' },
    EMBEDDED_IDCC,
    EMBEDDED_NAF,
  ).motif;

  test('pourcentage et deux-points attachés par une espace insécable ; le code NAF reste « 87.1 »', () => {
    const t = texteDuResolveur(motifNaf);
    assert.match(t, new RegExp(`\\d+${NBSP}% des établissements`));
    assert.match(t, new RegExp(`\\(Hébergement médicalisé\\)${NBSP}: `));
    assert.match(t, /code NAF 87\.1 \(/);
    assert.doesNotMatch(t, /\d %/);
  });

  test('seules des espaces deviennent insécables : motifs et avertissements des fixtures, avec plusieurs codes NAF', () => {
    const textes = [motifNaf];
    for (const e of ENTREPRISES) {
      for (const codeNaf of [e.codeNaf, '87.10A', '56.10A', null]) {
        const r = resoudreOpco({ ...entreeDeResolution(e), codeNaf }, EMBEDDED_IDCC, EMBEDDED_NAF);
        textes.push(r.motif, ...r.avertissements);
      }
    }
    assert.ok(textes.length >= 40, String(textes.length));
    for (const s of textes) {
      const t = texteDuResolveur(s);
      assert.equal(t.replaceAll(NBSP, ' '), texteFr(s).replaceAll(NBSP, ' '), s);
      assert.doesNotMatch(t, / [:;?!]/, s);
    }
  });
});

describe("présélection d'après le code NAF (preselectionParNaf) : la carte de l'OPCO cite alors la Table SIRET-OPCO", () => {
  const parNaf = (entree: EntreeResolution) =>
    preselectionParNaf(entree, resoudreOpco(entree, EMBEDDED_IDCC, EMBEDDED_NAF), EMBEDDED_IDCC);
  // 1516 : organismes de formation (AKTO) ; 2264 : hospitalisation privée (OPCO Santé) ; 87.10A : hébergement
  // médicalisé, suggéré à OPCO Santé par la Table SIRET-OPCO.
  const deuxOpco = { idccs: ['1516', '2264'], idccSiege: [], codeNaf: '87.10A', natureJuridique: '5710' };

  test('suggestion seule, sans convention : oui ; employeur public au même code NAF : non', () => {
    assert.equal(parNaf({ idccs: [], idccSiege: [], codeNaf: '87.10A', natureJuridique: '5710' }), true);
    assert.equal(parNaf({ idccs: [], idccSiege: [], codeNaf: '87.10A', natureJuridique: '7366' }), false);
    assert.equal(parNaf({ idccs: [], idccSiege: [], codeNaf: null, natureJuridique: '5710' }), false);
  });

  test('plusieurs OPCO possibles : oui si le code NAF départage, non si la convention du siège le fait ou si rien ne départage', () => {
    assert.equal(resoudreOpco(deuxOpco, EMBEDDED_IDCC, EMBEDDED_NAF).opcoSlug, 'opco-sante');
    assert.equal(parNaf(deuxOpco), true);
    assert.equal(parNaf({ ...deuxOpco, idccSiege: ['1516'] }), false);
    assert.equal(parNaf({ ...deuxOpco, idccSiege: ['2264'] }), false);
    assert.equal(parNaf({ ...deuxOpco, codeNaf: '01.11Z' }), false);
  });

  test('convention exploitable : non (SFG DEVELOPPEMENT et chaque entreprise des fixtures dont le motif ne cite pas le code NAF)', () => {
    assert.equal(parNaf(entreeDeResolution(parSiren('814739728'))), false);
    for (const e of ENTREPRISES) {
      const entree = entreeDeResolution(e);
      const r = resoudreOpco(entree, EMBEDDED_IDCC, EMBEDDED_NAF);
      assert.equal(preselectionParNaf(entree, r, EMBEDDED_IDCC), /d'après le code NAF/.test(r.motif), e.siren);
    }
  });

  test('propriété : 1 000 entrées tirées (graine 31), vrai exactement quand le motif du résolveur cite le code NAF', () => {
    let graine = 31;
    const hasard = (n: number) => {
      graine = (graine + 0x6d2b79f5) | 0;
      let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
    };
    // Conventions fermes de deux OPCO, convention inconnue, code échappatoire ; codes NAF suggérés ou non.
    const IDCC = ['1516', '2264', '1311', '1077', '2046', '9876', '9999', '5501'];
    const NAF = ['87.10A', '01.11Z', '56.10A', '85.59A', '99.00Z', null];
    const NATURES = ['5710', '9220', '7366', '7490', null];
    const vus = { oui: 0, non: 0 };
    for (let i = 0; i < 1000; i++) {
      const idccs = IDCC.filter(() => hasard(3) === 0);
      const entree: EntreeResolution = {
        idccs,
        idccSiege: idccs.filter(() => hasard(3) === 0),
        codeNaf: NAF[hasard(NAF.length)],
        natureJuridique: NATURES[hasard(NATURES.length)],
      };
      const r = resoudreOpco(entree, EMBEDDED_IDCC, EMBEDDED_NAF);
      const attendu = /d'après le code NAF/.test(r.motif);
      assert.equal(preselectionParNaf(entree, r, EMBEDDED_IDCC), attendu, JSON.stringify(entree));
      vus[attendu ? 'oui' : 'non']++;
    }
    // Les deux issues sont bien tirées (sinon la propriété ne prouverait rien).
    assert.ok(vus.oui >= 100 && vus.non >= 100, JSON.stringify(vus));
  });
});
