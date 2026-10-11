// Garde de non-régression : pour UNE personne, le moteur de l'OPCO rend ce qu'il rendait avant l'évolution « plusieurs
// personnes ». L'empreinte (SHA-256) porte sur le JSON de 3 072 calculs : les onze OPCO, leurs branches, quatre tailles,
// quatre types de formation, sans frais puis avec frais, deux coûts, un budget déjà consommé sur trois. Elle a été relevée
// au commit c21b924, avant toute modification du moteur ; le champ `personnes`, ajouté depuis, en est retiré.
// Si ce test échoue, relire d'abord la différence : une personne seule ne doit changer ni un montant ni un caractère.
// Ne remplacer l'empreinte qu'après accord de l'utilisateur, jamais pour « faire passer » la suite.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { calculateFunding } from '../src/calculator';
import { EMBEDDED_OPCOS } from '../src/data';
import type { CompanySize, FundingResult, OpcoData, TrainingType, WizardState } from '../src/types';
import { makeFormationState } from './fixtures';

const EMPREINTE_AU_COMMIT_C21B924 = '18d94f9697450f9bec1467cbdecaec8bd5ac1bb933e540be4fd3b9f7f9548430';
const NOMBRE_DE_CALCULS = 3072;

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

describe('une personne : le moteur de l’OPCO rend ce qu’il rendait avant l’évolution', () => {
  it(`empreinte de ${NOMBRE_DE_CALCULS} calculs`, () => {
    const cas = casDeReference();
    expect(cas).toHaveLength(NOMBRE_DE_CALCULS);
    const sortie = cas.map(({ opco, state }) => {
      // `personnes` n'existait pas au commit de référence : il est retiré avant de calculer l'empreinte.
      const { personnes: _personnes, ...reste } = calculateFunding(opco, state) as FundingResult & { personnes?: number };
      return reste;
    });
    expect(createHash('sha256').update(JSON.stringify(sortie)).digest('hex')).toBe(EMPREINTE_AU_COMMIT_C21B924);
  });
});
