// Écran « Votre plan de financement », Constructys : salaires et forfait de frais annexes réservés aux actions qualifiantes
// (fiche Bâtiment 2026 : « Plafond : 10 € HT / heure / stagiaire uniquement pour les actions qualifiantes. » ; « Frais
// annexes (uniquement pour les actions qualifiantes) »). Ce que l'écran calcule et affiche, par son propre code : `calculer`,
// `lignesDuDetail` (tableau « Détail par poste »), `texteMoteur` (points d'attention, notes et détail du calcul).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CERTIFICATION_LABELS, TRAINING_TYPE_LABELS, createInitialWizardState } from '@opco/core';
import type { CertificationType, FundingResult, TrainingType, WizardState } from '@opco/core';
import { texteMoteur } from '../src/lib/format';
import { coutsDeFormation } from '../src/lib/parcours';
import { calculer, chapeauDetailOpco, lignesDuDetail } from '../src/lib/resultats';

/** Date du jour fixe : le résultat ne dépend pas du jour du test. */
const DATE = '2026-10-08';

/** Scénario du constat : entreprise du Bâtiment (IDCC 1597) de 11 à 49 salariés, formation de 21 h à 1 200 €. */
const etat = (over: Partial<WizardState>): WizardState => ({
  ...createInitialWizardState(),
  projetType: 'formation_salarie',
  selectedOpcoSlug: 'constructys',
  detectedIdcc: '1597',
  regionCode: '84',
  companySize: '11_49',
  contractType: 'cdi',
  trainingMode: 'presentiel',
  ...coutsDeFormation(1200, 21),
  ...over,
});

/** Un texte du moteur tel que l'écran l'affiche (`texteMoteur`), espaces insécables ramenées à l'espace. */
const affiche = (s: string): string => texteMoteur(s).replace(/\s/g, ' ');
const ligne = (funding: FundingResult, poste: string) => funding.lines.find((l) => l.poste === poste);

const REGLE =
  'Constructys réserve la prise en charge des salaires (10 €/h) et le forfait de frais annexes (8 % des coûts pédagogiques) ' +
  'aux actions qualifiantes : certification enregistrée au RNCP (diplôme, titre ou bloc de compétences), CQP ou ' +
  "qualification reconnue par une convention collective de branche. Votre formation n'est pas déclarée comme telle : " +
  'ces postes ne sont pas comptés.';

describe('Constructys, Bâtiment de 11 à 49 salariés, 21 h à 1 200 € : salaires et forfait réservés aux actions qualifiantes', () => {
  test('formation courte non certifiante : ni salaires ni forfait comptés, le point d’attention affiché dit la règle', () => {
    const { funding, plan } = calculer(etat({ formationType: 'non_certifiante' }), DATE);
    assert.ok(funding);
    // Tableau « Détail par poste » : la pédagogie seule (399 € : 19 €/h × 21 h) ; plus de « 210 € » ni de « 31,92 € ».
    assert.deepEqual(
      lignesDuDetail(funding).map((l) => [l.poste, l.fundedAmount]),
      [['pedagogie', 399]],
    );
    assert.equal(funding.totalFunded, 399);
    // Plan : la ligne de l'OPCO ne compte que la pédagogie (430,92 € avant la règle) et aucune aide sur les salaires.
    assert.equal(plan.financements.find((f) => f.id === 'opco-pdc')?.montant, 399);
    assert.equal(plan.aidesEmployeur.some((a) => a.id === 'opco-salaires'), false);
    assert.equal(chapeauDetailOpco(funding), "Le calcul de l'OPCO poste par poste, avec la règle et la source de chaque montant.");
    // « Points d'attention » : la règle, les taux et la condition, tels qu'affichés.
    assert.deepEqual(
      funding.warnings.map(affiche).filter((w) => w.includes('actions qualifiantes')),
      [REGLE],
    );
    // Les deux lignes à 0 € gardent leur règle et leur source, pour tout écran qui les afficherait.
    const salaires = ligne(funding, 'salaires')!;
    assert.deepEqual([salaires.requestedAmount, salaires.fundedAmount], [0, 0]);
    assert.equal(affiche(salaires.note!), "Réservée aux actions qualifiantes (10 €/h) : votre formation n'est pas déclarée comme telle");
    assert.ok(salaires.details!.map(affiche).includes("Votre formation n'est pas déclarée comme telle : aucun montant n'est compté sur ce poste"));
    const forfait = ligne(funding, 'frais_annexes')!;
    assert.deepEqual([forfait.label, forfait.requestedAmount, forfait.fundedAmount], ['Frais annexes (forfait %)', 0, 0]);
    assert.equal(
      affiche(forfait.note!),
      "Réservé aux actions qualifiantes (8 % des coûts pédagogiques) : votre formation n'est pas déclarée comme telle",
    );
    assert.equal(forfait.sourceUrl, 'https://www.constructys.fr/conditions-de-prise-en-charge-2/');
  });

  test('certification RNCP : 210 € de salaires et 31,92 € de forfait comme avant, le détail du calcul nomme la condition remplie', () => {
    const { funding, plan } = calculer(etat({ formationType: 'certification', certificationLevel: 'rncp' }), DATE);
    assert.ok(funding);
    assert.deepEqual(
      lignesDuDetail(funding).map((l) => [l.poste, l.fundedAmount]),
      [
        ['pedagogie', 399],
        ['salaires', 210],
        ['frais_annexes', 31.92],
      ],
    );
    assert.equal(plan.financements.find((f) => f.id === 'opco-pdc')?.montant, 430.92);
    assert.equal(plan.aidesEmployeur.find((a) => a.id === 'opco-salaires')?.montant, 210);
    assert.equal(funding.warnings.some((w) => w.includes('actions qualifiantes')), false);
    assert.equal(affiche(ligne(funding, 'salaires')!.note!), '10 €/h × 21 h');
    assert.ok(
      ligne(funding, 'salaires')!.details!.map(affiche).includes('Taux réservé aux actions qualifiantes : votre formation est déclarée comme telle'),
    );
    assert.ok(
      ligne(funding, 'frais_annexes')!.details!.map(affiche).includes('Forfait réservé aux actions qualifiantes : votre formation est déclarée comme telle'),
    );
    assert.ok(ligne(funding, 'frais_annexes')!.details!.map(affiche).includes('Calcul : 399 € × 8 % = 31,92 €'));
  });

  test('chaque réponse du parcours (type de formation × certification visée) : seuls un titre RNCP, un diplôme ou un CQP ouvrent les deux postes', () => {
    const types = [null, ...(Object.keys(TRAINING_TYPE_LABELS) as TrainingType[])];
    const certifications = [null, ...(Object.keys(CERTIFICATION_LABELS) as CertificationType[])];
    let qualifiantes = 0;
    for (const formationType of types) {
      for (const certificationLevel of certifications) {
        const { funding } = calculer(etat({ formationType, certificationLevel }), DATE);
        assert.ok(funding);
        const qualifiante =
          formationType === 'cqp' || certificationLevel === 'rncp' || certificationLevel === 'diplome' || certificationLevel === 'cqp';
        if (qualifiante) qualifiantes++;
        const contexte = `${formationType} / ${certificationLevel}`;
        assert.deepEqual(
          [ligne(funding, 'salaires')!.fundedAmount, ligne(funding, 'frais_annexes')!.fundedAmount, funding.totalFunded],
          qualifiante ? [210, 31.92, 640.92] : [0, 0, 399],
          contexte,
        );
        assert.equal(funding.warnings.map(affiche).includes(REGLE), !qualifiante, contexte);
      }
    }
    // 8 types (dont « non précisé ») × 8 certifications (dont « Ne sait pas ») : 8 couples CQP par le type, 3 × 7 autres par la certification.
    assert.equal(qualifiantes, 29);
  });
});
