// ============================================================
// Catalogue d'aides embarqué : corrections décidées à la revue du moteur
// (table CORRECTIONS de scripts/integrer-recherches.mjs). Trois contrôles :
//   1. catégories : une aide qui paie une dépense de la personne (permis, transport, hébergement, restauration,
//      équipement, mobilité, fonds social, aide aux apprentis) n'est jamais déduite du coût de la formation, et une aide
//      versée à une entreprise ou à une structure qui ne paie pas la formation elle-même est une aide à l'employeur ;
//   2. modes : seule la rémunération de formation de France Travail reste en `par_mois`, une majoration RQTH
//      n'estime jamais un travailleur handicapé en dessous d'un autre demandeur d'emploi, et seul le coût de la formation
//      peut servir de base à un pourcentage ;
//   3. forfaits : une aide versée sur une période sans lien avec la durée de la formation est un forfait.
// ============================================================

import { describe, it, expect } from 'vitest';
import { estimerMontant } from '../src/aides/evaluer';
import type { Aide, CriteresAide, ProfilAides } from '../src/aides/types';
import { EMBEDDED_AIDES } from '../src/data';
import { makeProfil } from './fixtures-aides';

const aideParId = new Map<string, Aide>(EMBEDDED_AIDES.map((a) => [a.id, a]));

function aide(id: string): Aide {
  const trouvee = aideParId.get(id);
  if (!trouvee) throw new Error(`Aide absente du catalogue embarqué : ${id}`);
  return trouvee;
}

/** Demandeur d'emploi inscrit à France Travail : le public du barème de la rémunération de formation. */
function profilDemandeurEmploi(over: Partial<ProfilAides> = {}): ProfilAides {
  return makeProfil({
    projet: 'recrutement_demandeur_emploi',
    statutBeneficiaire: 'demandeur_emploi',
    inscritFranceTravail: true,
    contrat: null,
    ancienneteMois: null,
    ...over,
  });
}

/** Apprenti : le public de la reprise après rupture de contrat et de l'aide au logement des alternants. */
function profilAlternant(over: Partial<ProfilAides> = {}): ProfilAides {
  return makeProfil({
    projet: 'alternance',
    statutBeneficiaire: 'alternant',
    contrat: 'alternance',
    typeAlternance: 'apprentissage',
    ...over,
  });
}

function montantEstime(id: string, profil: ProfilAides): number | null {
  return estimerMontant(aide(id).montant, profil).montant;
}

/** Critères réduits à `{ rqth: true }` : une majoration réservée aux travailleurs handicapés, sans autre condition. */
const estRqthSeul = (criteres: CriteresAide): boolean => Object.keys(criteres).length === 1 && criteres.rqth === true;

const AGES = [30, 24];
const DUREES_HEURES = [7, 140, 1350];

// --- 1. Catégories ----------------------------------------------------------

/**
 * Aides qui paient une dépense de la personne et non la formation : décision prise une par une sur la description,
 * les conditions et le libellé du montant (revue des 115 aides `cout_formation`, tâche 17b). Les aides qui paient la
 * formation en plus d'une dépense de la personne (prise en charge de la formation et frais annexes, rémunération,
 * transport ou hébergement du stagiaire) restent `cout_formation`.
 */
const AIDES_A_LA_PERSONNE = [
  // permis de conduire
  'r24-aide-permis-combo-parfait',
  'r28-aide-permis',
  'r32-aide-permis',
  'r75-permis-b',
  'r84-permis-b',
  // transport, hébergement, restauration
  'nat-aide-mobilite-france-travail',
  'r24-aide-transport-hebergement',
  'r27-aide-transport-hebergement',
  'r32-apprentis-transport',
  'r32-apprentis-restauration',
  'r32-apprentis-hebergement',
  'r32-apprentis-transports-regionaux',
  'r76-hebergement-afpa',
  'r93-pass-zou-etudes',
  'r94-mobilite-apprentis',
  'r94-train-gratuit-apprentis',
  'r04-reunipass-stagiaires',
  // équipement
  'r28-aide-equipement-professionnel',
  'r32-apprentis-equipement',
  // mobilité internationale (bourses et billets)
  'ue-erasmus-mobilite-alternants',
  'nat-ladom-passeport-mobilite-formation',
  'r28-pass-monde',
  'r32-mermoz-apprentis',
  'r75-stages-etranger-infra-bac',
  'r75-stages-etranger-post-bac',
  'r84-mobilite-internationale-apprentis-superieur',
  'r93-prame-mobilite-internationale',
  // fonds social, aides aux apprentis qui ne paient pas la formation
  'r52-fonds-social-urgence',
  'nat-opco-frais-annexes-apprentis',
  'r11-aide-regionale-apprentissage',
  'r27-aide-apprentis-difficulte',
  'r93-fonds-aide-apprentis',
  // autres aides à la personne
  'nat-agefiph-parcours-vers-emploi',
  'r11-daeu',
];

/**
 * Aides versées à une entreprise ou à une structure, qui ne paient pas la formation elle-même (audit de la tâche 17b,
 * corrigé à la tâche 17c) : r75-aiei-ingefor (50 % des salaires d'ingénierie interne préalable à une formation),
 * r53-pass-transitions (conseil et diagnostic pour les entreprises de 50 salariés au plus), r01-iae-formation-salaries-insertion
 * (subvention de fonctionnement d'une structure d'insertion).
 */
const AIDES_A_L_EMPLOYEUR = ['r75-aiei-ingefor', 'r53-pass-transitions', 'r01-iae-formation-salaries-insertion'];

/** Subventions aux entreprises qui financent des coûts de formation (dépenses pédagogiques, heures de formation) : `cout_formation`. */
const SUBVENTIONS_QUI_FINANCENT_LA_FORMATION = [
  'r32-dvrh', // subvention régionale aux actions de formation du plan de formation de l'entreprise
  'r27-arefe', // coûts pédagogiques et ingénierie de formation de programmes de développement des compétences
  'r75-afest-former-pour-recruter', // jusqu'à 70 % des dépenses d'AFEST (ingénierie, coûts pédagogiques)
  'r75-aiei-formation', // 40 à 60 % des coûts pédagogiques des formations du plan de développement des compétences
  'r28-formation-salaries-insertion', // jusqu'à 70 % des coûts pédagogiques de la formation des salariés en insertion
  'r84-pacte-region-emploi-apres-embauche', // 5 € par heure de formation versés à l'entreprise qui forme
];

const EVOQUE_UNE_AIDE_A_LA_PERSONNE = /permis|transport|h[ée]bergement|restauration|[ée]quipement|mobilit[ée]|billet|fonds social|train gratuit/i;

/** Aides restées `cout_formation` bien que leur nom évoque une aide à la personne : elles paient réellement la formation. */
const PAIENT_LA_FORMATION_MALGRE_LEUR_NOM: Record<string, string> = {
  'r02-aide-formation-mobilite-france':
    "« mobilité » désigne le lieu de la formation (Hexagone, Guadeloupe, Guyane) : l'aide prend en charge le coût pédagogique et les frais annexes de cette formation qualifiante",
  'r02-aide-formation-mobilite-reste-du-monde':
    "« mobilité » désigne une formation suivie hors de France : l'aide prend en charge le coût pédagogique et les frais annexes, jusqu'à 15 000 €",
};

describe('catégories : aide à la personne ou paiement de la formation', () => {
  it('classe en remuneration_beneficiaire les aides qui paient une dépense de la personne et non la formation', () => {
    expect(new Set(AIDES_A_LA_PERSONNE).size).toBe(AIDES_A_LA_PERSONNE.length);
    expect(AIDES_A_LA_PERSONNE.filter((id) => !aideParId.has(id))).toEqual([]);
    expect(AIDES_A_LA_PERSONNE.filter((id) => aideParId.get(id)?.categorie !== 'remuneration_beneficiaire')).toEqual([]);
  });

  it('ne laisse en cout_formation aucune aide dont le nom évoque une aide à la personne, hors exceptions justifiées', () => {
    const suspectes = EMBEDDED_AIDES.filter(
      (a) =>
        a.categorie === 'cout_formation' &&
        EVOQUE_UNE_AIDE_A_LA_PERSONNE.test(a.nom) &&
        !(a.id in PAIENT_LA_FORMATION_MALGRE_LEUR_NOM),
    ).map((a) => `${a.id} : ${a.nom}`);
    expect(suspectes).toEqual([]);
  });

  it("n'admet que des exceptions qui existent, restent cout_formation et correspondent encore à l'expression", () => {
    for (const id of Object.keys(PAIENT_LA_FORMATION_MALGRE_LEUR_NOM)) {
      expect(aide(id).categorie).toBe('cout_formation');
      expect(EVOQUE_UNE_AIDE_A_LA_PERSONNE.test(aide(id).nom)).toBe(true);
    }
  });

  it('classe en aide_employeur les trois aides versées à une entreprise ou à une structure qui ne paient pas la formation', () => {
    expect(new Set(AIDES_A_L_EMPLOYEUR).size).toBe(AIDES_A_L_EMPLOYEUR.length);
    expect(AIDES_A_L_EMPLOYEUR.filter((id) => !aideParId.has(id))).toEqual([]);
    expect(AIDES_A_L_EMPLOYEUR.filter((id) => aideParId.get(id)?.categorie !== 'aide_employeur')).toEqual([]);
  });

  it('laisse en cout_formation les autres subventions aux entreprises : elles financent des coûts de formation', () => {
    expect(new Set(SUBVENTIONS_QUI_FINANCENT_LA_FORMATION).size).toBe(SUBVENTIONS_QUI_FINANCENT_LA_FORMATION.length);
    expect(SUBVENTIONS_QUI_FINANCENT_LA_FORMATION.filter((id) => !aideParId.has(id))).toEqual([]);
    expect(SUBVENTIONS_QUI_FINANCENT_LA_FORMATION.filter((id) => aideParId.get(id)?.categorie !== 'cout_formation')).toEqual([]);
  });
});

// --- 2. Modes de calcul -----------------------------------------------------

describe('modes de calcul : par_mois réservé à la rémunération de formation', () => {
  it("n'a plus en mode par_mois que nat-rfft", () => {
    expect(EMBEDDED_AIDES.filter((a) => a.montant.mode === 'par_mois').map((a) => a.id)).toEqual(['nat-rfft']);
  });

  it("n'estime jamais un travailleur handicapé en dessous d'un autre demandeur d'emploi (majorations RQTH seules)", () => {
    const concernees = EMBEDDED_AIDES.filter((a) => (a.montant.majorations ?? []).some((m) => estRqthSeul(m.criteres)));
    expect(concernees.map((a) => a.id)).toContain('nat-rfft');

    const ecarts: string[] = [];
    for (const a of concernees) {
      for (const age of AGES) {
        for (const dureeHeures of DUREES_HEURES) {
          // soldeCpf : seul le mode `solde_cpf` (nat-cpf) en dépend ; sans solde connu, il n'y a rien à comparer.
          for (const soldeCpf of [null, 6000]) {
            const commun = { age, dureeHeures, soldeCpf };
            const avec = estimerMontant(a.montant, profilDemandeurEmploi({ ...commun, rqth: true })).montant;
            const sans = estimerMontant(a.montant, profilDemandeurEmploi({ ...commun, rqth: false })).montant;
            if ((avec ?? -1) < (sans ?? -1)) {
              ecarts.push(`${a.id} (${age} ans, ${dureeHeures} h, solde CPF ${soldeCpf}) : ${avec} € avec RQTH, ${sans} € sans`);
            }
          }
        }
      }
    }
    expect(ecarts).toEqual([]);
  });

  it("nat-rfft : un demandeur d'emploi RQTH est estimé à 2 188,27 € par mois de formation à temps plein, au-dessus des autres", () => {
    const rfft = aide('nat-rfft');
    const majorationRqth = rfft.montant.majorations?.find((m) => estRqthSeul(m.criteres));
    expect(majorationRqth).toMatchObject({ valeur: 2188.27, plafond: null });
    expect(majorationRqth?.libelle).toContain("de 775,65 € à 2 188,27 € par mois selon l'activité salariée antérieure");

    const rqth = montantEstime('nat-rfft', profilDemandeurEmploi({ age: 30, dureeHeures: 140, rqth: true }));
    const autre = montantEstime('nat-rfft', profilDemandeurEmploi({ age: 30, dureeHeures: 140, rqth: false }));
    expect(rqth).toBe(Math.round(((2188.27 * 140) / 151.67) * 100) / 100);
    expect(rqth).toBeGreaterThan(autre ?? Infinity);
  });
});

describe('modes de calcul : un pourcentage ne porte que sur le coût de la formation', () => {
  it("aucune aide qui ne réduit pas le coût de la formation n'est en mode pourcentage", () => {
    const fautives = EMBEDDED_AIDES.filter((a) => a.categorie !== 'cout_formation' && a.montant.mode === 'pourcentage');
    expect(fautives.map((a) => a.id)).toEqual([]);
  });

  it("r32-aide-permis : le pourcentage porte sur le contrat d'enseignement à la conduite, l'aide n'est pas chiffrée (libellé conservé)", () => {
    const { categorie, montant } = aide('r32-aide-permis');
    expect(categorie).toBe('remuneration_beneficiaire');
    expect(montant).toMatchObject({ mode: 'non_chiffre', valeur: null, pourcentage: null, base: null, plafond: null, duree_max_mois: null });
    expect('majorations' in montant).toBe(false);
    expect(montant.libelle).toContain("jusqu'à 90 % du coût du contrat d'enseignement à la conduite ; total plafonné à 1 200 €");
    // Avant la correction : 90 % du coût total de la formation (450 € pour une formation de 500 €).
    for (const coutPedagogique of [500, 4200]) {
      expect(montantEstime('r32-aide-permis', profilAlternant({ coutPedagogique }))).toBeNull();
    }
  });
});

// --- 3. Forfaits corrigés ---------------------------------------------------

describe('forfaits des aides versées sur une période sans lien avec la durée de la formation', () => {
  it('r32-reprise-apprentis : 1 500 € (500 € × 3 mois), 600 € avant 18 ans, quelle que soit la durée de la formation', () => {
    const { montant } = aide('r32-reprise-apprentis');
    expect(montant).toMatchObject({ mode: 'forfait', valeur: 1500, plafond: null, duree_max_mois: null });
    expect(montant.majorations).toHaveLength(1);
    expect(montant.majorations?.[0]).toMatchObject({ criteres: { age_max: 17 }, valeur: 600 });
    expect(montant.libelle).toContain('500 € par mois (200 € si moins de 18 ans au moment de la rupture)');
    expect(montant.majorations?.[0]?.libelle).toContain('200 € par mois');

    for (const dureeHeures of DUREES_HEURES) {
      for (const age of [18, 20, 25]) {
        expect(montantEstime('r32-reprise-apprentis', profilAlternant({ age, dureeHeures }))).toBe(1500);
      }
      expect(montantEstime('r32-reprise-apprentis', profilAlternant({ age: 17, dureeHeures }))).toBe(600);
    }
  });

  it('nat-mobili-jeune : 1 100 € (plafond annuel publié) pour tout profil éligible, quelle que soit la durée de la formation', () => {
    const { montant } = aide('nat-mobili-jeune');
    expect(montant).toMatchObject({ mode: 'forfait', valeur: 1100, plafond: null, duree_max_mois: null });
    expect(montant.libelle).toContain('De 10 € à 100 € par mois, dans la limite de 1 100 € par année de formation');

    for (const typeAlternance of ['apprentissage', 'professionnalisation'] as const) {
      for (const age of [18, 22, 29]) {
        for (const dureeHeures of DUREES_HEURES) {
          expect(montantEstime('nat-mobili-jeune', profilAlternant({ typeAlternance, age, dureeHeures }))).toBe(1100);
        }
      }
    }
  });
});
