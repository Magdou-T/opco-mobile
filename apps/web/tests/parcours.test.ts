// Parcours du simulateur en 6 étapes : ce qui manque pour continuer, saut de l'étape Frais, cohérence de l'état quand
// le projet ou le mode de formation change, plafond horaire indicatif de la formation.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  EMBEDDED_OPCOS,
  STATUT_PAR_PROJET,
  createInitialWizardState,
  getEmbeddedOpcoBySlug,
  profilDepuisWizard,
} from '@opco/core';
import type { OpcoData, ProjetType, TrainingMode, TrainingType, WizardState } from '@opco/core';
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
  QUESTIONS_COMMUNES,
  QUESTIONS_PAR_STATUT,
  etatDepuisModeFormation,
  etatDepuisProjet,
  plafondHoraireIndicatif,
} from '../src/lib/parcours';

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
