// Garde de non-régression : pour UNE personne, le moteur de l'OPCO rend ce qu'il rendait avant l'évolution « plusieurs
// personnes ». L'empreinte (SHA-256) porte sur le JSON de 3 072 calculs : les onze OPCO, leurs branches, quatre tailles,
// quatre types de formation, sans frais puis avec frais, deux coûts, un budget déjà consommé sur trois. Elle a été relevée
// au commit c21b924, avant toute modification du moteur ; le champ `personnes` que l'évolution ajoute en est retiré.
// Elle ne couvre que cette grille (présentiel, un seul mode de transport, deux durées) : le reste repose sur les autres
// tests du cœur.
// Les barèmes embarqués sont une entrée du calcul : une mise à jour légitime des données change l'empreinte des résultats
// sans qu'aucune régression du moteur n'existe. La garde ne s'applique donc que tant que les barèmes sont ceux du commit de
// référence (empreinte des données ci-dessous, dates de vérification exclues : le contrôle de fraîcheur les renouvelle
// chaque année et le moteur ne les lit pas) ; dès que les barèmes changent, le test est ignoré (« skipped » dans la
// sortie), et celui qui met les données à jour décide de retirer cette garde ou d'en relever une nouvelle avec un moteur de
// référence. Un « skipped » n'est pas un succès : les tâches du plan exigent « 1 passed ».
// Si ce test échoue, relire d'abord la différence : une personne seule ne doit changer ni un montant ni un caractère.
// Ne remplacer l'empreinte qu'après accord de l'utilisateur, jamais pour « faire passer » la suite.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { calculateFunding } from '../src/calculator';
import { EMBEDDED_OPCOS } from '../src/data';
import type { CompanySize, FundingResult, OpcoData, TrainingType, WizardState } from '../src/types';
import { makeFormationState } from './fixtures';

const EMPREINTE_AU_COMMIT_C21B924 = '18d94f9697450f9bec1467cbdecaec8bd5ac1bb933e540be4fd3b9f7f9548430';
const EMPREINTE_DES_BAREMES_AU_COMMIT_C21B924 = 'd235ee3fbd615390ba7a46c55b7ca7e9e9b4e6950789b27383970916e1cfab2e';
const NOMBRE_DE_CALCULS = 3072;

/** Dates de vérification des barèmes : renouvelées chaque année par le contrôle de fraîcheur, jamais lues par le moteur. */
const DATES_DE_VERIFICATION = new Set(['derniere_verification', 'derniere_mise_a_jour']);
const empreinte = (valeur: unknown, ignorees: ReadonlySet<string> = new Set()): string =>
  createHash('sha256')
    .update(JSON.stringify(valeur, (cle, v: unknown) => (ignorees.has(cle) ? undefined : v)))
    .digest('hex');
/** Vrai tant que les barèmes embarqués (`EMBEDDED_OPCOS`) sont ceux du commit de référence, dates de vérification mises à part. */
const BAREMES_DE_REFERENCE = empreinte(EMBEDDED_OPCOS, DATES_DE_VERIFICATION) === EMPREINTE_DES_BAREMES_AU_COMMIT_C21B924;

const TAILLES: CompanySize[] = ['less_11', '11_49', '50_299', '300_plus'];
const TYPES: { formationType: TrainingType; certificationLevel: WizardState['certificationLevel'] }[] = [
  { formationType: 'non_certifiante', certificationLevel: 'aucune' },
  { formationType: 'cqp', certificationLevel: 'cqp' },
  { formationType: 'certification', certificationLevel: 'rncp' },
  { formationType: 'habilitation', certificationLevel: 'habilitation' },
];
const FRAIS: Partial<WizardState>[] = [
  {},
  {
    needsTransport: true,
    transportMode: 'train',
    trainingDays: 5,
    needsAccommodation: true,
    accommodationNights: 4,
    accommodationCostPerNight: 120,
    needsMeals: true,
    mealCostPerDay: 15,
  },
];
const COUTS = [
  { durationHours: 35, pedagogyCostTotal: 1400 },
  { durationHours: 140, pedagogyCostTotal: 9800 },
];

function casDeReference(): { opco: OpcoData; state: WizardState }[] {
  const cas: { opco: OpcoData; state: WizardState }[] = [];
  for (const opco of EMBEDDED_OPCOS) {
    const idccs = [null, ...(opco.variantes_branche ?? []).map((v) => v.idcc[0] ?? null)];
    for (const idcc of idccs) {
      for (const companySize of TAILLES) {
        for (const type of TYPES) {
          for (const frais of FRAIS) {
            for (const cout of COUTS) {
              const i = cas.length;
              cas.push({
                opco,
                state: makeFormationState({
                  selectedOpcoSlug: opco.slug,
                  detectedIdcc: idcc,
                  companySize,
                  trainingMode: 'presentiel',
                  ...type,
                  ...frais,
                  durationHours: cout.durationHours,
                  pedagogyCostTotal: cout.pedagogyCostTotal,
                  pedagogyCostPerHour: cout.pedagogyCostTotal / cout.durationHours,
                  budgetDejaConsomme: i % 3 === 0 ? 3000 : null,
                }),
              });
            }
          }
        }
      }
    }
  }
  return cas;
}

describe("une personne : le moteur de l'OPCO rend ce qu'il rendait avant l'évolution", () => {
  // Délai de 30 s : le calcul prend de 1 à 5 secondes selon la machine, et Vitest coupe un test à 5 secondes par défaut.
  it.skipIf(!BAREMES_DE_REFERENCE)(
    `empreinte de ${NOMBRE_DE_CALCULS} calculs`,
    () => {
      const cas = casDeReference();
      expect(cas).toHaveLength(NOMBRE_DE_CALCULS);
      const sortie = cas.map(({ opco, state }) => {
        // `personnes` n'existait pas au commit de référence : il est retiré avant de calculer l'empreinte.
        const { personnes: _personnes, ...reste } = calculateFunding(opco, state) as FundingResult & { personnes?: number };
        return reste;
      });
      expect(empreinte(sortie)).toBe(EMPREINTE_AU_COMMIT_C21B924);
    },
    30_000,
  );
});
