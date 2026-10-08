// Parcours du simulateur en 6 étapes : ce qui manque pour continuer, saut de l'étape Frais, cohérence de l'état quand
// le projet ou le mode de formation change, plafond horaire indicatif de la formation.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import {
  EMBEDDED_OPCOS,
  STATUT_PAR_PROJET,
  calculateFunding,
  createInitialWizardState,
  getEmbeddedOpcoBySlug,
  moisDepuisSaisie,
  profilDepuisWizard,
} from '@opco/core';
import type {
  ContractType,
  DispositifComplementaire,
  OpcoData,
  ProjetType,
  TrainingMode,
  TrainingType,
  WizardState,
} from '@opco/core';
import {
  ETAPES,
  champsManquants,
  enumeration,
  etapeSautee,
  indexPrecedent,
  indexSuivant,
} from '../src/lib/etapes';
import type { EtapeSite } from '../src/lib/etapes';
import {
  QUESTIONS_AVEC_INCONNU,
  QUESTIONS_COMMUNES,
  QUESTIONS_PAR_STATUT,
  coutsDeFormation,
  depassePlafondHoraire,
  erreurDuMoisDeDebut,
  etatDepuisModeFormation,
  etatDepuisProjet,
  plafondHoraireIndicatif,
  reponsesInconnuesApres,
} from '../src/lib/parcours';
import type { QuestionAvecInconnu } from '../src/lib/parcours';
import { texteDonnees } from '../src/lib/format';

/** Champs de l'app mobile que le site ne pose plus : ils restent à leur valeur initiale. */
const CHAMPS_NON_POSES = ['isReconversion', 'isSortieChomage'];

const PROJETS: ProjetType[] = [
  'formation_salarie',
  'reconversion_salarie',
  'recrutement_demandeur_emploi',
  'alternance',
  'formation_dirigeant',
];
const MODES: TrainingMode[] = ['presentiel', 'distance', 'hybride'];
const etat = (maj: Partial<WizardState> = {}): WizardState => ({ ...createInitialWizardState(), ...maj });
const opco = (slug: string): OpcoData => {
  const o = getEmbeddedOpcoBySlug(slug);
  assert.ok(o, `OPCO ${slug} absent des données`);
  return o;
};

/**
 * Règles de la brief (étape 1, `canGoNext`), recopiées telles quelles comme oracle indépendant. Seul ajout, documenté
 * dans lib/etapes.ts : un contrat « alternance » ne compte pas pour un salarié (ce n'est pas un choix proposé).
 */
function peutContinuerSelonLaBrief(etape: EtapeSite, state: WizardState): boolean {
  const projet = state.projetType;
  switch (etape) {
    case 'projet':
      return projet != null;
    case 'identification': {
      const opcoOk = !!(state.selectedOpcoSlug || state.detectedOpcoSlug) || projet === 'formation_dirigeant';
      return opcoOk && state.regionCode != null && state.companySize != null;
    }
    case 'situation':
      switch (projet) {
        case 'formation_salarie':
          return state.contractType != null && state.contractType !== 'alternance';
        case 'reconversion_salarie':
          return state.contractType != null && state.contractType !== 'alternance' && state.anciennete_mois != null;
        case 'recrutement_demandeur_emploi':
          return state.inscritFranceTravail != null;
        case 'alternance':
          return state.typeAlternance != null && state.ageBeneficiaire != null;
        case 'formation_dirigeant':
          return state.statutDirigeant != null;
        default:
          return false;
      }
    case 'formation':
      return !!(state.durationHours && state.pedagogyCostTotal && state.trainingMode && state.formationType);
    case 'frais':
    case 'recap':
      return true;
  }
}

describe('étapes du parcours', () => {
  test("six étapes dans l'ordre : Projet, Entreprise, Bénéficiaire, Formation, Frais, Récapitulatif", () => {
    assert.deepEqual(
      ETAPES.map((e) => [e.key, e.label]),
      [
        ['projet', 'Projet'],
        ['identification', 'Entreprise'],
        ['situation', 'Bénéficiaire'],
        ['formation', 'Formation'],
        ['frais', 'Frais'],
        ['recap', 'Récapitulatif'],
      ],
    );
  });

  test("l'étape Frais est sautée pour une formation à distance, dans les deux sens", () => {
    const frais = ETAPES.findIndex((e) => e.key === 'frais');
    const formation = frais - 1;
    const recap = frais + 1;
    const distance = { trainingMode: 'distance' as const };
    assert.equal(indexSuivant(formation, distance), recap);
    assert.equal(indexPrecedent(recap, distance), formation);
    for (const trainingMode of ['presentiel', 'hybride', null] as const) {
      assert.equal(indexSuivant(formation, { trainingMode }), frais);
      assert.equal(indexPrecedent(recap, { trainingMode }), frais);
      assert.equal(etapeSautee('frais', { trainingMode }), false);
    }
    assert.equal(etapeSautee('frais', distance), true);
    for (const e of ETAPES) if (e.key !== 'frais') assert.equal(etapeSautee(e.key, distance), false, e.key);
  });

  test('la première et la dernière étape sont des bornes', () => {
    assert.equal(indexPrecedent(0, { trainingMode: null }), 0);
    assert.equal(indexSuivant(ETAPES.length - 1, { trainingMode: 'distance' }), ETAPES.length - 1);
  });
});

describe('ce qui manque pour continuer (champsManquants)', () => {
  test("suit les règles de la brief sur des milliers d'états tirés au hasard", () => {
    // mulberry32 : tirages indépendants (un générateur congruentiel simple corrèle ses bits faibles).
    let graine = 3;
    const hasard = (n: number) => {
      graine = (graine + 0x6d2b79f5) | 0;
      let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
    };
    const parmi = <T,>(valeurs: T[]): T => valeurs[hasard(valeurs.length)];
    let verifies = 0;
    for (let i = 0; i < 4000; i++) {
      const state = etat({
        projetType: parmi([null, ...PROJETS]),
        selectedOpcoSlug: parmi([null, 'akto']),
        detectedOpcoSlug: parmi([null, 'atlas']),
        regionCode: parmi([null, '11']),
        companySize: parmi([null, 'less_11']),
        contractType: parmi([null, 'cdi', 'alternance']),
        anciennete_mois: parmi([null, 0, 24]),
        inscritFranceTravail: parmi([null, true, false]),
        typeAlternance: parmi([null, 'apprentissage']),
        ageBeneficiaire: parmi([null, 19]),
        statutDirigeant: parmi([null, 'artisan']),
        durationHours: parmi([null, 0, 140]),
        pedagogyCostTotal: parmi([null, 0, 4200]),
        trainingMode: parmi([null, ...MODES]),
        formationType: parmi([null, 'certification']),
      });
      for (const { key } of ETAPES) {
        verifies++;
        const manquants = champsManquants(key, state);
        assert.equal(manquants.length === 0, peutContinuerSelonLaBrief(key, state), `${key} ${JSON.stringify(state)}`);
        assert.equal(new Set(manquants).size, manquants.length, 'un champ manquant est cité deux fois');
      }
    }
    assert.equal(verifies, 4000 * ETAPES.length);
  });

  test("le texte dit précisément ce qui manque, dans l'ordre de l'écran", () => {
    assert.deepEqual(champsManquants('projet', etat()), ['votre projet']);
    assert.deepEqual(champsManquants('identification', etat({ projetType: 'formation_salarie' })), [
      "l'OPCO",
      'la région',
      "la taille de l'entreprise",
    ]);
    assert.deepEqual(champsManquants('identification', etat({ projetType: 'formation_dirigeant', regionCode: '11' })), [
      "la taille de l'entreprise",
    ]);
    assert.deepEqual(champsManquants('situation', etat({ projetType: 'reconversion_salarie' })), [
      'le type de contrat',
      "l'ancienneté",
    ]);
    assert.deepEqual(champsManquants('situation', etat({ projetType: 'alternance', typeAlternance: 'apprentissage' })), [
      "l'âge de l'alternant",
    ]);
    assert.deepEqual(champsManquants('formation', etat({ trainingMode: 'presentiel', durationHours: 35 })), [
      'le type de formation',
      'le coût total',
    ]);
    // Une durée ou un coût à zéro ne suffit pas (règle de la brief : valeurs non nulles).
    const complete = { formationType: 'certification', trainingMode: 'presentiel', durationHours: 35, pedagogyCostTotal: 900 } as const;
    assert.deepEqual(champsManquants('formation', etat(complete)), []);
    assert.deepEqual(champsManquants('formation', etat({ ...complete, durationHours: 0 })), ['la durée']);
    assert.deepEqual(champsManquants('formation', etat({ ...complete, pedagogyCostTotal: 0 })), ['le coût total']);
    assert.deepEqual(champsManquants('frais', etat()), []);
    assert.deepEqual(champsManquants('recap', etat()), []);
  });

  test('énumération à la française', () => {
    assert.equal(enumeration([]), '');
    assert.equal(enumeration(['la région']), 'la région');
    assert.equal(enumeration(['la région', 'la taille']), 'la région et la taille');
    assert.equal(enumeration(["l'OPCO", 'la région', 'la taille']), "l'OPCO, la région et la taille");
  });
});

describe('changement de projet (etatDepuisProjet)', () => {
  // Classement de chaque champ du bloc « Étape 2 : bénéficiaire » de WizardState, lu dans types.ts : un champ ajouté
  // plus tard fait échouer la garde tant qu'il n'est pas classé.
  const sourceTypes = readFileSync(fileURLToPath(new URL('../../../packages/core/src/types.ts', import.meta.url)), 'utf8');
  const bloc = sourceTypes.slice(
    sourceTypes.indexOf('// Étape 2 : bénéficiaire'),
    sourceTypes.indexOf('// Étape 3 : formation'),
  );
  const CHAMPS_BENEFICIAIRE = [...bloc.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);

  /**
   * Questions propres à chaque statut, recopiées de la brief W4 (étape 3) indépendamment de lib/parcours.ts : salarié,
   * contrat, ancienneté et solde CPF ; demandeur d'emploi, inscription à France Travail et région de résidence ;
   * alternant, type de contrat (qui fixe le contrat « alternance »), inscription et région de résidence ; dirigeant,
   * statut, micro-entrepreneur et solde CPF.
   */
  const SELON_LA_BRIEF: Record<string, string[]> = {
    salarie: ['contractType', 'anciennete_mois', 'soldeCpf'],
    demandeur_emploi: ['inscritFranceTravail', 'regionBeneficiaireCode'],
    alternant: ['typeAlternance', 'contractType', 'inscritFranceTravail', 'regionBeneficiaireCode'],
    dirigeant: ['statutDirigeant', 'microEntrepreneur', 'soldeCpf'],
  };
  const PROPRES = [...new Set(Object.values(SELON_LA_BRIEF).flat())] as (keyof WizardState)[];

  test('les questions de chaque statut sont celles de la brief', () => {
    for (const [statut, questions] of Object.entries(SELON_LA_BRIEF)) {
      assert.deepEqual([...QUESTIONS_PAR_STATUT[statut as keyof typeof QUESTIONS_PAR_STATUT]].sort(), [...questions].sort(), statut);
    }
    assert.deepEqual([...QUESTIONS_COMMUNES].sort(), ['ageBeneficiaire', 'isHandicap', 'niveauDiplome']);
  });

  test('garde : chaque champ du bénéficiaire est commun, propre à un statut, ou non posé par le site', () => {
    assert.ok(CHAMPS_BENEFICIAIRE.length >= 10, `seulement ${CHAMPS_BENEFICIAIRE.length} champs lus`);
    const classes = [...QUESTIONS_COMMUNES, ...PROPRES, ...CHAMPS_NON_POSES];
    assert.equal(new Set(classes).size, classes.length, 'un champ est classé deux fois');
    assert.deepEqual([...classes].sort(), [...CHAMPS_BENEFICIAIRE].sort());
  });

  /** Un état où toutes les questions du bénéficiaire ont une réponse (y compris celles d'autres projets). */
  const plein = (projetType: ProjetType, contractType: WizardState['contractType']) =>
    etat({
      projetType,
      contractType,
      anciennete_mois: 30,
      soldeCpf: 800,
      inscritFranceTravail: true,
      regionBeneficiaireCode: '84',
      typeAlternance: 'apprentissage',
      statutDirigeant: 'artisan',
      microEntrepreneur: false,
      ageBeneficiaire: 19,
      niveauDiplome: 'bac',
      isHandicap: true,
      formationType: 'certification',
      regionCode: '11',
    });

  test('de tout projet vers tout projet : seules les réponses du nouveau statut et les questions communes restent', () => {
    const initial = createInitialWizardState();
    for (const de of PROJETS) {
      for (const vers of PROJETS) {
        for (const contrat of ['cdi', 'alternance', null] as const) {
          const avant = plein(de, contrat);
          const apres = { ...avant, ...etatDepuisProjet(avant, vers) };
          const statut = STATUT_PAR_PROJET[vers];
          const contexte = `${de} (${contrat}) -> ${vers}`;
          assert.equal(apres.projetType, vers, contexte);
          for (const champ of PROPRES) {
            if (champ === 'contractType') continue;
            const attendu = SELON_LA_BRIEF[statut].includes(champ) ? avant[champ] : initial[champ];
            assert.deepEqual(apres[champ], attendu, `${contexte} : ${champ}`);
          }
          for (const champ of QUESTIONS_COMMUNES) assert.deepEqual(apres[champ], avant[champ], `${contexte} : ${champ}`);
          // Les autres étapes ne sont pas touchées.
          assert.equal(apres.formationType, 'certification', contexte);
          assert.equal(apres.regionCode, '11', contexte);
          // Contrat : « alternance » pour l'alternant qui a choisi son type de contrat, jamais pour un autre statut.
          if (statut === 'alternant') assert.equal(apres.contractType, 'alternance', contexte);
          else if (statut === 'salarie') assert.equal(apres.contractType, contrat === 'alternance' ? null : contrat, contexte);
          else assert.equal(apres.contractType, null, contexte);
        }
      }
    }
  });

  test("un alternant sans type de contrat n'a pas encore de contrat", () => {
    const apres = etatDepuisProjet(etat({ projetType: 'formation_salarie', contractType: 'cdi' }), 'alternance');
    assert.equal(apres.contractType, null);
  });

  test("le moteur d'aides ne voit plus les réponses d'un autre projet", () => {
    const avant = plein('alternance', 'alternance');
    const profil = profilDepuisWizard({ ...avant, ...etatDepuisProjet(avant, 'formation_salarie') }, 'akto');
    assert.equal(profil.typeAlternance, null);
    assert.equal(profil.inscritFranceTravail, null);
    assert.equal(profil.regionBeneficiaire, null);
    assert.equal(profil.statutDirigeant, null);
    assert.equal(profil.microEntrepreneur, null);
    assert.equal(profil.contrat, null);
    assert.equal(profil.age, 19);
  });

  test('choisir de nouveau le même projet ne change rien', () => {
    for (const p of PROJETS) {
      const avant = plein(p, STATUT_PAR_PROJET[p] === 'alternant' ? 'alternance' : 'cdi');
      const deja = { ...avant, ...etatDepuisProjet(avant, p) };
      const encore = { ...deja, ...etatDepuisProjet(deja, p) };
      assert.deepEqual(encore, deja, p);
    }
  });
});

describe('audit : aucun champ invisible ne pèse sur le résultat', () => {
  /**
   * Champs de WizardState affichés pour certains projets seulement, relevés dans les étapes (liste écrite ici,
   * indépendamment de lib/parcours.ts) : le budget déjà consommé (étape Entreprise, projets qui ouvrent le budget de
   * l'OPCO) et les questions propres au statut (étape Bénéficiaire). Les étapes Formation et Frais posent les mêmes
   * questions à tous les projets ; l'étape Frais disparaît pour une formation à distance (dernier test).
   */
  const VISIBLES_PAR_PROJET: Record<ProjetType, (keyof WizardState)[]> = {
    formation_salarie: ['budgetDejaConsomme', 'contractType', 'anciennete_mois', 'soldeCpf'],
    reconversion_salarie: ['budgetDejaConsomme', 'contractType', 'anciennete_mois', 'soldeCpf'],
    recrutement_demandeur_emploi: ['inscritFranceTravail', 'regionBeneficiaireCode'],
    alternance: ['typeAlternance', 'inscritFranceTravail', 'regionBeneficiaireCode'],
    formation_dirigeant: ['statutDirigeant', 'microEntrepreneur', 'soldeCpf'],
  };
  const CONDITIONNELS = [...new Set(Object.values(VISIBLES_PAR_PROJET).flat())];
  const CONTRATS_SALARIE: (ContractType | null)[] = ['cdi', 'cdd', 'interim'];

  /** Réponses visibles dans tous les projets (entreprise, âge, diplôme, RQTH, formation) : le calcul a de quoi travailler. */
  const COMMUN: Partial<WizardState> = {
    selectedOpcoSlug: 'akto',
    regionCode: '11',
    companySize: 'less_11',
    ageBeneficiaire: 19,
    niveauDiplome: 'bac',
    isHandicap: true,
    formationType: 'certification',
    trainingMode: 'presentiel',
    durationHours: 140,
    pedagogyCostTotal: 4200,
    pedagogyCostPerHour: 30,
  };

  /** Chaque champ conditionnel a une valeur, quel que soit le projet de départ. */
  const toutRempli = (projetType: ProjetType): WizardState =>
    etat({
      ...COMMUN,
      projetType,
      budgetDejaConsomme: 2000,
      contractType: projetType === 'alternance' ? 'alternance' : 'cdi',
      anciennete_mois: 30,
      soldeCpf: 800,
      inscritFranceTravail: true,
      regionBeneficiaireCode: '84',
      typeAlternance: 'apprentissage',
      statutDirigeant: 'artisan',
      microEntrepreneur: false,
    });

  /** L'état d'un utilisateur parti de zéro sur `projet` qui aurait donné les réponses visibles de `avant`. */
  const propre = (projet: ProjetType, avant: WizardState): WizardState => {
    const visibles = Object.fromEntries(VISIBLES_PAR_PROJET[projet].map((champ) => [champ, avant[champ]]));
    const s: WizardState = { ...etat({ ...COMMUN, projetType: projet }), ...visibles };
    // Contrat : un contrat de salarié pour un salarié ; « alternance » découle du type de contrat d'alternance.
    if (STATUT_PAR_PROJET[projet] === 'salarie') {
      s.contractType = CONTRATS_SALARIE.includes(avant.contractType) ? avant.contractType : null;
    } else {
      s.contractType = projet === 'alternance' && s.typeAlternance ? 'alternance' : null;
    }
    return s;
  };

  test("garde : l'étape Entreprise n'a qu'un champ propre à certains projets, le budget déjà consommé", () => {
    const sourceTypes = readFileSync(fileURLToPath(new URL('../../../packages/core/src/types.ts', import.meta.url)), 'utf8');
    const bloc = sourceTypes.slice(
      sourceTypes.indexOf('// Étape 1 : entreprise et OPCO'),
      sourceTypes.indexOf('// Étape 2 : bénéficiaire'),
    );
    const champs = [...bloc.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
    // Affichés ou établis pour tous les projets (l'OPCO n'est que facultatif pour le dirigeant, il reste affiché).
    const pourTous = [
      'opcoKnown', 'selectedOpcoSlug', 'companyName', 'sirenNumber', 'siret', 'detectedOpcoSlug', 'detectedIdcc',
      'detectedCompanyName', 'selectedBrancheId', 'opcoCertitude', 'idccEtablissements', 'idccSiege', 'regionCode',
      'departementCode', 'codeNaf', 'natureJuridique', 'trancheEffectifInsee', 'companySize', 'effectif', 'structures',
    ];
    assert.deepEqual([...champs].sort(), [...pourTous, 'budgetDejaConsomme'].sort());
  });

  test("le budget déjà consommé disparaît avec un projet qui ne l'affiche pas", () => {
    for (const de of PROJETS) {
      for (const vers of PROJETS) {
        const avant = etat({ projetType: de, budgetDejaConsomme: 2000 });
        const apres = { ...avant, ...etatDepuisProjet(avant, vers) };
        const affiche = vers === 'formation_salarie' || vers === 'reconversion_salarie';
        assert.equal(apres.budgetDejaConsomme, affiche ? 2000 : null, `${de} -> ${vers}`);
      }
    }
  });

  test('chaque champ conditionnel pèse sur le calcul AKTO ou sur le profil des aides (le test suivant prouve donc quelque chose)', () => {
    const akto = opco('akto');
    const base = toutRempli('formation_salarie');
    for (const champ of CONDITIONNELS) {
      const sans = { ...base, [champ]: createInitialWizardState()[champ] };
      const pese =
        !isDeepStrictEqual(calculateFunding(akto, base), calculateFunding(akto, sans)) ||
        !isDeepStrictEqual(profilDepuisWizard(base, 'akto'), profilDepuisWizard(sans, 'akto'));
      assert.ok(pese, `${champ} ne change ni le calcul ni le profil`);
    }
  });

  test("25 transitions de projet : calcul AKTO et profil des aides égaux à ceux d'un état propre équivalent", () => {
    const akto = opco('akto');
    let transitions = 0;
    for (const de of PROJETS) {
      for (const vers of PROJETS) {
        const avant = toutRempli(de);
        const apres = { ...avant, ...etatDepuisProjet(avant, vers) };
        const attendu = propre(vers, avant);
        const contexte = `${de} -> ${vers}`;
        assert.deepEqual(calculateFunding(akto, apres), calculateFunding(akto, attendu), contexte);
        assert.deepEqual(profilDepuisWizard(apres, 'akto'), profilDepuisWizard(attendu, 'akto'), contexte);
        transitions++;
      }
    }
    assert.equal(transitions, 25);
  });

  test("passage à distance : les réponses de l'étape Frais, qui disparaît, ne pèsent plus sur le calcul ni sur le profil", () => {
    const akto = opco('akto');
    // Dispositif compté par jour de formation (aucun dans les données d'aujourd'hui) : le nombre de jours y pèserait.
    const parJour: DispositifComplementaire = {
      id: 'essai-par-jour',
      nom: 'Essai par jour',
      cumul: 'additif',
      montant_max: 10,
      unite: 'par_jour',
      pourcentage_couts: null,
      description: '',
      conditions: [],
      demarches: '',
      tailles_eligibles: null,
      publics: null,
      confidence: 'estimated',
      source_url: akto.url_finance_page,
    };
    const aktoParJour: OpcoData = { ...akto, dispositifs_complementaires: [...(akto.dispositifs_complementaires ?? []), parJour] };
    const salarie: Partial<WizardState> = { ...COMMUN, projetType: 'formation_salarie', contractType: 'cdi' };
    const avant = etat({
      ...salarie,
      needsTransport: true,
      transportMode: 'train',
      transportDistanceKm: 250,
      needsAccommodation: true,
      accommodationNights: 4,
      accommodationCostPerNight: 90,
      needsMeals: true,
      mealCostPerDay: 18,
      trainingDays: 3,
    });
    const apres = { ...avant, ...etatDepuisModeFormation('distance') };
    const attendu = etat({ ...salarie, trainingMode: 'distance' });
    // Le nombre de jours pèse bien sur un dispositif compté par jour (sinon la comparaison ne prouverait rien).
    assert.notDeepEqual(
      calculateFunding(aktoParJour, avant).dispositifsComplementaires,
      calculateFunding(aktoParJour, { ...avant, trainingDays: null }).dispositifsComplementaires,
    );
    for (const o of [akto, aktoParJour]) {
      assert.deepEqual(calculateFunding(o, apres), calculateFunding(o, attendu), o.dispositifs_complementaires?.at(-1)?.id);
    }
    assert.deepEqual(profilDepuisWizard(apres, 'akto'), profilDepuisWizard(attendu, 'akto'));
  });
});

describe('réponses « Je ne sais pas » retenues par le site (reponsesInconnuesApres)', () => {
  const aucune: ReadonlySet<QuestionAvecInconnu> = new Set();

  test('les questions sont celles qui proposent « Je ne sais pas » ou « Ne sait pas » dans les étapes', () => {
    assert.deepEqual(
      [...QUESTIONS_AVEC_INCONNU].sort(),
      ['certificationLevel', 'eligibleCpf', 'inscritFranceTravail', 'microEntrepreneur', 'niveauFormationVise', 'organismeQualiopi'],
    );
  });

  test('« Je ne sais pas » est retenu ; une autre réponse le remplace', () => {
    const jeNeSaisPas = reponsesInconnuesApres(aucune, { microEntrepreneur: null }, 'microEntrepreneur');
    assert.deepEqual([...jeNeSaisPas], ['microEntrepreneur']);
    assert.deepEqual([...reponsesInconnuesApres(jeNeSaisPas, { microEntrepreneur: true })], []);
    assert.deepEqual([...reponsesInconnuesApres(jeNeSaisPas, { microEntrepreneur: false })], []);
    // « Ne sait pas » dans une liste, puis un choix de la liste.
    const certification = reponsesInconnuesApres(aucune, { certificationLevel: null }, 'certificationLevel');
    assert.deepEqual([...certification], ['certificationLevel']);
    assert.deepEqual([...reponsesInconnuesApres(certification, { certificationLevel: 'rncp' })], []);
  });

  test("une mise à jour qui ne touche pas la question la garde, sans créer d'ensemble neuf", () => {
    const avant = reponsesInconnuesApres(aucune, { eligibleCpf: null }, 'eligibleCpf');
    const apres = reponsesInconnuesApres(avant, { durationHours: 35, organismeQualiopi: true });
    assert.equal(apres, avant);
    assert.equal(reponsesInconnuesApres(aucune, { regionCode: '11' }), aucune);
  });

  test('un changement de projet qui remet la question à vide efface la réponse ; un projet qui la garde la garde', () => {
    let inconnues = reponsesInconnuesApres(aucune, { microEntrepreneur: null }, 'microEntrepreneur');
    inconnues = reponsesInconnuesApres(inconnues, { inscritFranceTravail: null }, 'inscritFranceTravail');
    const dirigeant = etat({ projetType: 'formation_dirigeant', statutDirigeant: 'artisan' });
    // Dirigeant -> salarié : micro-entrepreneur disparaît avec sa réponse.
    const versSalarie = reponsesInconnuesApres(inconnues, etatDepuisProjet(dirigeant, 'formation_salarie'));
    assert.equal(versSalarie.has('microEntrepreneur'), false);
    // Alternant -> demandeur d'emploi : l'inscription à France Travail est posée aux deux, sa réponse reste.
    const alternant = etat({ projetType: 'alternance', typeAlternance: 'apprentissage', contractType: 'alternance' });
    const versDemandeur = reponsesInconnuesApres(inconnues, etatDepuisProjet(alternant, 'recrutement_demandeur_emploi'));
    assert.equal(versDemandeur.has('inscritFranceTravail'), true);
    // Alternant -> salarié : l'inscription n'est plus posée, sa réponse disparaît.
    assert.equal(reponsesInconnuesApres(inconnues, etatDepuisProjet(alternant, 'formation_salarie')).has('inscritFranceTravail'), false);
  });

  test("l'ensemble reçu n'est jamais modifié", () => {
    const avant = reponsesInconnuesApres(aucune, { eligibleCpf: null }, 'eligibleCpf');
    reponsesInconnuesApres(avant, { eligibleCpf: true });
    reponsesInconnuesApres(avant, { organismeQualiopi: null }, 'organismeQualiopi');
    assert.deepEqual([...avant], ['eligibleCpf']);
    assert.equal(aucune.size, 0);
  });
});

describe('changement de mode de formation (etatDepuisModeFormation)', () => {
  test('à distance, les besoins de frais sont décochés ; les montants restent', () => {
    const avant = etat({ needsTransport: true, needsAccommodation: true, needsMeals: true, transportMode: 'train', mealCostPerDay: 15 });
    const apres = { ...avant, ...etatDepuisModeFormation('distance') };
    assert.equal(apres.trainingMode, 'distance');
    assert.equal(apres.needsTransport, false);
    assert.equal(apres.needsAccommodation, false);
    assert.equal(apres.needsMeals, false);
    assert.equal(apres.transportMode, 'train');
    assert.equal(apres.mealCostPerDay, 15);
  });

  test('en présentiel ou en hybride, seul le mode change', () => {
    for (const mode of ['presentiel', 'hybride'] as const) assert.deepEqual(etatDepuisModeFormation(mode), { trainingMode: mode });
  });
});

describe('plafond horaire indicatif (plafondHoraireIndicatif)', () => {
  const sans = { selectedBrancheId: null, detectedIdcc: null, formationType: null as TrainingType | null };

  test('barème général : plafond inter, ou plafond des certifiantes pour un CQP, une certification, une habilitation', () => {
    const afdas = opco('afdas');
    assert.equal(plafondHoraireIndicatif(afdas, sans), afdas.cout_horaire_inter.value);
    assert.equal(plafondHoraireIndicatif(opco('akto'), sans), 30);
  });

  test('la branche appliquée prime : choisie à la main, sinon détectée par la convention collective', () => {
    const akto = opco('akto');
    assert.equal(plafondHoraireIndicatif(akto, { ...sans, detectedIdcc: '1516' }), 60);
    const ep = opco('opco-ep');
    assert.equal(plafondHoraireIndicatif(ep, { ...sans, selectedBrancheId: 'coiffure', formationType: 'non_certifiante' }), 25);
    for (const t of ['cqp', 'certification', 'habilitation'] as const) {
      assert.equal(plafondHoraireIndicatif(ep, { ...sans, selectedBrancheId: 'coiffure', formationType: t }), 15, t);
    }
    const afdas = opco('afdas');
    assert.equal(plafondHoraireIndicatif(afdas, { ...sans, selectedBrancheId: 'sport', formationType: 'certification' }), 10);
    assert.equal(plafondHoraireIndicatif(afdas, { ...sans, selectedBrancheId: 'sport', formationType: 'qualification' }), 32);
  });

  test("repli sur l'autre plafond quand le premier n'a pas de valeur", () => {
    const akto = opco('akto');
    const sansMetier: OpcoData = { ...akto, variantes_branche: [], cout_horaire_metier: { ...akto.cout_horaire_metier, value: null } };
    assert.equal(plafondHoraireIndicatif(sansMetier, { ...sans, formationType: 'cqp' }), akto.cout_horaire_inter.value);
    const sansInter: OpcoData = { ...akto, variantes_branche: [], cout_horaire_inter: { ...akto.cout_horaire_inter, value: null } };
    assert.equal(plafondHoraireIndicatif(sansInter, sans), akto.cout_horaire_metier.value);
  });

  test('aucun plafond publié : null ; enveloppe épuisée : 0 ; aucun OPCO : null', () => {
    assert.equal(plafondHoraireIndicatif(opco('atlas'), sans), null);
    assert.equal(plafondHoraireIndicatif(opco('opco-sante'), sans), null);
    assert.equal(plafondHoraireIndicatif(opco('akto'), { ...sans, selectedBrancheId: 'akto-pdc-2026-epuise' }), 0);
    assert.equal(plafondHoraireIndicatif(undefined, sans), null);
  });

  test("pour chaque OPCO et chaque branche, le plafond est celui d'un des deux champs du barème appliqué", () => {
    for (const o of EMBEDDED_OPCOS) {
      for (const brancheId of [null, ...(o.variantes_branche ?? []).map((v) => v.id)]) {
        for (const formationType of [null, 'non_certifiante', 'cqp'] as const) {
          const plafond = plafondHoraireIndicatif(o, { selectedBrancheId: brancheId, detectedIdcc: null, formationType });
          const variante = (o.variantes_branche ?? []).find((v) => v.id === brancheId);
          const valeurs = [
            variante?.cout_horaire_inter?.value ?? o.cout_horaire_inter.value,
            variante?.cout_horaire_metier?.value ?? o.cout_horaire_metier.value,
          ];
          assert.ok(plafond === null ? valeurs.every((v) => v == null) : valeurs.includes(plafond), `${o.slug} ${brancheId}`);
        }
      }
    }
  });
});

describe('coût horaire de la formation (coutsDeFormation, saisie de la durée et du coût total)', () => {
  /** Montant au centime : les montants du moteur sont des nombres à virgule flottante. */
  const centimes = (montant: number) => Math.round(montant * 100);
  /** Salarié en CDI d'un organisme de formation (AKTO, IDCC 1516 : plafond de 60 €/h), formation certifiante. */
  const salarieAkto = (total: number, heures: number): WizardState =>
    etat({
      projetType: 'formation_salarie',
      selectedOpcoSlug: 'akto',
      detectedIdcc: '1516',
      regionCode: '11',
      companySize: 'less_11',
      contractType: 'cdi',
      formationType: 'certification',
      trainingMode: 'presentiel',
      ...coutsDeFormation(total, heures),
    });

  test('le coût horaire est le coût total divisé par la durée, sans arrondi ; rien sans total ni durée', () => {
    assert.deepEqual(coutsDeFormation(4250, 140), {
      pedagogyCostTotal: 4250,
      durationHours: 140,
      pedagogyCostPerHour: 4250 / 140,
    });
    assert.equal(coutsDeFormation(4200, 140).pedagogyCostPerHour, 30);
    assert.deepEqual(coutsDeFormation(null, 140), { pedagogyCostTotal: null, durationHours: 140, pedagogyCostPerHour: null });
    assert.deepEqual(coutsDeFormation(4250, null), { pedagogyCostTotal: 4250, durationHours: null, pedagogyCostPerHour: null });
    assert.equal(coutsDeFormation(4250, 0).pedagogyCostPerHour, null);
    assert.equal(coutsDeFormation(0, 140).pedagogyCostPerHour, null);
  });

  test("4 250 € sur 140 h : l'OPCO finance 4 250 €, pas 4 250,40 € (30,36 €/h × 140 h), et le total tous postes vaut 6 350 €", () => {
    const r = calculateFunding(opco('akto'), salarieAkto(4250, 140));
    const pedagogie = r.lines.find((l) => l.poste === 'pedagogie');
    assert.ok(pedagogie);
    assert.equal(centimes(pedagogie.requestedAmount), 425000);
    assert.equal(centimes(pedagogie.fundedAmount), 425000);
    assert.ok(centimes(pedagogie.remainder) === 0, `reste ${pedagogie.remainder}`);
    // Salaires : 15 €/h × 140 h = 2 100 €.
    assert.equal(centimes(r.totalFunded), 635000);
    // Le détail du calcul garde un coût horaire arrondi à l'affichage (formatEuro, par texteDonnees).
    const details = (pedagogie.details ?? []).map((d) => texteDonnees(d).replace(/\s/g, ' '));
    assert.ok(details.includes('Votre coût horaire : 30,36 €/h × 140 h = 4 250 €'), details.join(' | '));
  });

  test('900 € sur 21 h : financé 900 €, pas 900,06 € (42,86 €/h × 21 h)', () => {
    const pedagogie = calculateFunding(opco('akto'), salarieAkto(900, 21)).lines.find((l) => l.poste === 'pedagogie');
    assert.ok(pedagogie);
    assert.equal(centimes(pedagogie.fundedAmount), 90000);
    assert.equal(centimes(pedagogie.requestedAmount), 90000);
  });

  test('500 coûts tirés au hasard (graine 47) : sous le plafond horaire, la pédagogie est financée au centime près du coût demandé', () => {
    // mulberry32 : tirages reproductibles.
    let graine = 47;
    const hasard = (n: number) => {
      graine = (graine + 0x6d2b79f5) | 0;
      let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
    };
    let verifies = 0;
    for (let i = 0; i < 500; i++) {
      const heures = 1 + hasard(400);
      // Coût horaire sous le plafond de 60 €/h, total au centime.
      const total = (1 + hasard(heures * 5999)) / 100;
      const r = calculateFunding(opco('akto'), salarieAkto(total, heures));
      const pedagogie = r.lines.find((l) => l.poste === 'pedagogie');
      assert.ok(pedagogie);
      // Un plafond annuel appliqué réduit légitimement le financement : ces tirages ne prouvent rien ici.
      if (r.budgetCapApplied) continue;
      assert.equal(centimes(pedagogie.fundedAmount), centimes(total), `${total} € sur ${heures} h`);
      verifies++;
    }
    assert.ok(verifies >= 300, `seulement ${verifies} tirages sans plafond annuel`);
  });

  test("dépassement du plafond indicatif jugé au centime affiché : jamais « 30 €/h dépasse le plafond de 30 €/h »", () => {
    // 4 200,50 € sur 140 h : 30,0036 €/h, affiché 30 €/h.
    assert.equal(depassePlafondHoraire(4200.5 / 140, 30), false);
    assert.equal(depassePlafondHoraire(30.006, 30), true);
    assert.equal(depassePlafondHoraire(31, 30), true);
    assert.equal(depassePlafondHoraire(30, 30), false);
    // Sans coût horaire, sans plafond publié ou enveloppe épuisée (0) : pas d'encadré de dépassement.
    assert.equal(depassePlafondHoraire(null, 30), false);
    assert.equal(depassePlafondHoraire(45, null), false);
    assert.equal(depassePlafondHoraire(45, 0), false);
  });
});

describe('mois de début de la formation (erreurDuMoisDeDebut)', () => {
  const nb = String.fromCharCode(0xa0);

  test('vide ou mois valide : aucune erreur', () => {
    for (const saisie of ['', '   ', '03/2027', '3/2027', '12/2026', ' 01/2027 ']) {
      assert.equal(erreurDuMoisDeDebut(saisie), null, JSON.stringify(saisie));
    }
  });

  test('« 13/2026 » : au format MM/AAAA, mais le mois 13 n’existe pas, et l’erreur le dit', () => {
    const attendu = `Ce mois n'existe pas${nb}: écrivez un mois de 01 à 12, par exemple 03/2027.`;
    assert.equal(erreurDuMoisDeDebut('13/2026'), attendu);
    assert.equal(erreurDuMoisDeDebut('00/2027'), attendu);
    assert.equal(erreurDuMoisDeDebut('99/2027'), attendu);
  });

  test('autre forme : le format attendu', () => {
    const attendu = `Format attendu${nb}: MM/AAAA, par exemple 03/2027.`;
    for (const saisie of ['2027-03', 'mars 2027', '03/27', '3', '03/2027/1', '123/2027']) {
      assert.equal(erreurDuMoisDeDebut(saisie), attendu, saisie);
    }
  });

  test('chaque saisie refusée par le moteur porte une erreur, et seulement elle', () => {
    for (let mois = 0; mois <= 13; mois++) {
      for (const saisie of [`${mois}/2027`, `${String(mois).padStart(2, '0')}/2027`]) {
        assert.equal(erreurDuMoisDeDebut(saisie) == null, moisDepuisSaisie(saisie) != null, saisie);
      }
    }
  });
});
