// ============================================================
// Salaires et forfait de frais annexes réservés aux actions qualifiantes (indicateurs `prise_en_charge_salaires_qualifiant`
// d'une taille d'entreprise et `frais_annexes_pourcentage_qualifiant` d'un barème). Une action qualifiante est, selon
// l'article L. 6314-1 du code du travail et les fiches de Constructys (« qualification CCN Bâtiment / certification RNCP /
// blocs de compétences / CQP inscrits ou non au RNCP »), une certification enregistrée au RNCP (diplôme d'État compris) ou
// un CQP ; une certification du répertoire spécifique, une habilitation, une « certification » sans répertoire précisé et
// un type inconnu ne le sont pas : l'incertitude ne s'additionne jamais.
// ============================================================

import { describe, it, expect } from 'vitest';
import { applyVarianteBranche, calculateFunding } from '../src/calculator';
import { OpcoDataSchema, PlafondTailleSchema, VarianteBrancheSchema } from '../src/schema';
import type { FundingResult, OpcoData, PlafondTaille, VarianteBranche, WizardState } from '../src/types';
import { makeFormationState, makeOpco } from './fixtures';

/** Espace insécable (U+00A0), construite par son code : entre un nombre et son unité dans les textes du moteur. */
const NBSP = String.fromCharCode(0xa0);

const DEFINITION =
  'certification enregistrée au RNCP (diplôme, titre ou bloc de compétences), CQP ou qualification reconnue par une convention collective de branche';
const NON_DECLAREE = "Votre formation n'est pas déclarée comme telle : aucun montant n'est compté sur ce poste";

/** Déclarations du parcours qui ne font pas une action qualifiante (type de formation et certification visée). */
const NON_QUALIFIANTES: [string, Partial<WizardState>][] = [
  ['formation non certifiante', { formationType: 'non_certifiante', certificationLevel: null }],
  ['habilitation', { formationType: 'habilitation', certificationLevel: 'habilitation' }],
  ['type inconnu', { formationType: null, certificationLevel: null }],
  ['qualification professionnelle sans certification', { formationType: 'qualification', certificationLevel: null }],
  ['certification sans répertoire précisé', { formationType: 'certification', certificationLevel: null }],
  ['certification du répertoire spécifique', { formationType: 'certification', certificationLevel: 'rs' }],
  ['certification « autre »', { formationType: 'certification', certificationLevel: 'autre' }],
  ['aucune certification', { formationType: 'non_certifiante', certificationLevel: 'aucune' }],
  ['reconversion sans certification', { formationType: 'reconversion', certificationLevel: null }],
  ['VAE sans certification précisée', { formationType: 'vae', certificationLevel: null }],
];

/** Déclarations qui font une action qualifiante : certification enregistrée au RNCP (diplôme compris) ou CQP. */
const QUALIFIANTES: [string, Partial<WizardState>][] = [
  ['certification RNCP', { formationType: 'certification', certificationLevel: 'rncp' }],
  ["diplôme d'État", { formationType: 'certification', certificationLevel: 'diplome' }],
  ['CQP (type de formation)', { formationType: 'cqp', certificationLevel: null }],
  ['CQP (certification visée)', { formationType: 'qualification', certificationLevel: 'cqp' }],
  ['titre RNCP visé par une reconversion', { formationType: 'reconversion', certificationLevel: 'rncp' }],
];

const sourcee = (value: number | null, confidence: 'exact' | 'estimated' = 'exact') => ({
  value,
  confidence,
  source_url: 'https://exemple.fr/criteres',
});

const taille = (t: PlafondTaille['taille'], over: Partial<PlafondTaille> = {}): PlafondTaille => ({
  taille: t,
  cout_horaire_max: null,
  budget_annuel_max: null,
  quota_horaire_max: null,
  description: `Plafond ${t}`,
  ...over,
});

/**
 * Barème de type Constructys Bâtiment : 19 €/h, salaires 15 €/h sous 11 salariés (toute formation) et 10 €/h de 11 à 49
 * salariés (actions qualifiantes seulement), forfait de frais annexes de 8 % réservé aux actions qualifiantes.
 */
const opcoReserve = (over: Partial<OpcoData> = {}): OpcoData =>
  makeOpco({
    cout_horaire_inter: sourcee(19),
    cout_horaire_metier: sourcee(19),
    prise_en_charge_salaires: sourcee(15, 'estimated'),
    prise_en_charge_salaires_mode: 'euro_par_heure',
    frais_annexes_pourcentage: sourcee(8, 'estimated'),
    frais_annexes_pourcentage_qualifiant: true,
    plafonds_par_taille: [
      taille('less_11', { cout_horaire_max: 24, confidence: 'exact', source_url: 'https://exemple.fr/criteres', prise_en_charge_salaires_horaire: 15 }),
      taille('11_49', { prise_en_charge_salaires_horaire: 10, prise_en_charge_salaires_qualifiant: true }),
    ],
    ...over,
  });

/** Le même barème sans aucun indicateur : le calcul d'avant la règle. */
const sansIndicateur = (o: OpcoData): OpcoData => {
  const copie = structuredClone(o);
  delete copie.frais_annexes_pourcentage_qualifiant;
  for (const p of copie.plafonds_par_taille ?? []) delete p.prise_en_charge_salaires_qualifiant;
  for (const v of copie.variantes_branche ?? []) {
    delete v.frais_annexes_pourcentage_qualifiant;
    for (const p of v.plafonds_par_taille ?? []) delete p.prise_en_charge_salaires_qualifiant;
  }
  return copie;
};

/** Profil du constat : 11 à 49 salariés, 21 h, 1 200 € (57,14 €/h, au-dessus du plafond de 19 €/h : 399 € de pédagogie). */
const etat = (over: Partial<WizardState> = {}): WizardState =>
  makeFormationState({ companySize: '11_49', durationHours: 21, pedagogyCostTotal: 1200, pedagogyCostPerHour: 1200 / 21, ...over });

const poste = (r: FundingResult, p: string) => r.lines.find((l) => l.poste === p);
const avertissementsQualifiants = (r: FundingResult) => r.warnings.filter((w) => w.includes('actions qualifiantes'));

describe('salaires et forfait réservés aux actions qualifiantes : formation non qualifiante', () => {
  it.each(NON_QUALIFIANTES)('%s, 11 à 49 salariés : salaires et forfait à 0 €, la pédagogie ne change pas', (_, declaration) => {
    const r = calculateFunding(opcoReserve(), etat(declaration));
    expect(poste(r, 'pedagogie')!.fundedAmount).toBe(399);
    expect(poste(r, 'salaires')).toMatchObject({ requestedAmount: 0, fundedAmount: 0, remainder: 0 });
    expect(poste(r, 'frais_annexes')).toMatchObject({ requestedAmount: 0, fundedAmount: 0, remainder: 0 });
    expect(r.totalFunded).toBe(399);
  });

  it('11 à 49 salariés : les deux lignes disent la règle et la définition d’une action qualifiante', () => {
    const r = calculateFunding(opcoReserve(), etat({ formationType: 'non_certifiante' }));
    const salaires = poste(r, 'salaires')!;
    expect(salaires.note).toBe(`Réservée aux actions qualifiantes (10${NBSP}€/h) : votre formation n'est pas déclarée comme telle`);
    expect(salaires.details).toEqual([
      'Mode de calcul Test OPCO : forfait horaire',
      `Taux propre à votre taille d'entreprise : 10${NBSP}€/h, réservé aux actions qualifiantes`,
      `Action qualifiante : ${DEFINITION}`,
      NON_DECLAREE,
    ]);
    expect(salaires.confidence).toBe('estimated');
    const forfait = poste(r, 'frais_annexes')!;
    expect(forfait.label).toBe('Frais annexes (forfait %)');
    expect(forfait.note).toBe(`Réservé aux actions qualifiantes (8${NBSP}% des coûts pédagogiques) : votre formation n'est pas déclarée comme telle`);
    expect(forfait.details).toEqual([
      'Test OPCO utilise un forfait global pour les frais annexes, réservé aux actions qualifiantes',
      `Action qualifiante : ${DEFINITION}`,
      NON_DECLAREE,
      'Ce forfait couvre transport, hébergement et restauration : ces frais restent à votre charge',
    ]);
    expect(forfait.confidence).toBe('estimated');
    expect(forfait.sourceUrl).toBe('https://exemple.fr/criteres');
  });

  it('11 à 49 salariés : un point d’attention nomme les deux postes, leurs taux et la condition', () => {
    const r = calculateFunding(opcoReserve(), etat({ formationType: 'habilitation' }));
    expect(avertissementsQualifiants(r)).toEqual([
      `Test OPCO réserve la prise en charge des salaires (10${NBSP}€/h) et le forfait de frais annexes (8${NBSP}% des coûts pédagogiques) ` +
        `aux actions qualifiantes : ${DEFINITION}. Votre formation n'est pas déclarée comme telle : ces postes ne sont pas comptés.`,
    ]);
  });

  it('moins de 11 salariés : les salaires restent dus à toute formation (15 €/h), seul le forfait est retiré', () => {
    for (const [nom, declaration] of NON_QUALIFIANTES) {
      const r = calculateFunding(opcoReserve(), etat({ companySize: 'less_11', ...declaration }));
      expect(poste(r, 'pedagogie')!.fundedAmount, nom).toBe(504); // 24 €/h × 21 h
      expect(poste(r, 'salaires')!.fundedAmount, nom).toBe(315); // 15 €/h × 21 h
      expect(poste(r, 'frais_annexes')!.fundedAmount, nom).toBe(0);
      expect(r.totalFunded, nom).toBe(819);
      expect(avertissementsQualifiants(r), nom).toEqual([
        `Test OPCO réserve le forfait de frais annexes (8${NBSP}% des coûts pédagogiques) aux actions qualifiantes : ${DEFINITION}. ` +
          "Votre formation n'est pas déclarée comme telle : ce poste n'est pas compté.",
      ]);
    }
  });

  it('salaires seuls réservés (forfait valable pour toutes les formations) : le point d’attention ne nomme que les salaires', () => {
    const r = calculateFunding(opcoReserve({ frais_annexes_pourcentage_qualifiant: false }), etat({ formationType: null }));
    expect(poste(r, 'salaires')!.fundedAmount).toBe(0);
    expect(poste(r, 'frais_annexes')!.fundedAmount).toBe(31.92);
    expect(avertissementsQualifiants(r)).toEqual([
      `Test OPCO réserve la prise en charge des salaires (10${NBSP}€/h) aux actions qualifiantes : ${DEFINITION}. ` +
        "Votre formation n'est pas déclarée comme telle : ce poste n'est pas compté.",
    ]);
  });

  it('frais déclarés dans un forfait réservé : transport, hébergement et restauration ne sont plus « inclus dans le forfait »', () => {
    const avecFrais = etat({
      formationType: 'non_certifiante',
      needsTransport: true,
      needsAccommodation: true,
      accommodationNights: 2,
      accommodationCostPerNight: 80,
      needsMeals: true,
      mealCostPerDay: 15,
      trainingDays: 3,
    });
    const r = calculateFunding(opcoReserve(), avecFrais);
    for (const p of ['transport', 'hebergement', 'restauration']) {
      expect(poste(r, p), p).toMatchObject({
        requestedAmount: 0,
        fundedAmount: 0,
        note: 'Non pris en charge : le forfait de frais annexes est réservé aux actions qualifiantes',
      });
    }
    const qualifiante = calculateFunding(opcoReserve(), { ...avecFrais, certificationLevel: 'rncp' });
    for (const p of ['transport', 'hebergement', 'restauration']) {
      expect(poste(qualifiante, p)!.note, p).toBe('Inclus dans le forfait frais annexes (%)');
    }
  });
});

describe('salaires et forfait réservés aux actions qualifiantes : action qualifiante', () => {
  it.each(QUALIFIANTES)('%s, 11 à 49 salariés : 210 € de salaires et 31,92 € de forfait, comme sans la règle', (_, declaration) => {
    const r = calculateFunding(opcoReserve(), etat(declaration));
    const avant = calculateFunding(sansIndicateur(opcoReserve()), etat(declaration));
    expect(poste(r, 'salaires')).toMatchObject({ requestedAmount: 210, fundedAmount: 210, note: `10${NBSP}€/h × 21${NBSP}h` });
    expect(poste(r, 'frais_annexes')).toMatchObject({ requestedAmount: 31.92, fundedAmount: 31.92, note: `8${NBSP}% des coûts pédagogiques` });
    expect(r.totalFunded).toBe(640.92);
    // Le calcul est celui d'avant la règle : mêmes montants, mêmes points d'attention ; le détail nomme la condition remplie.
    expect(r.lines.map((l) => [l.poste, l.requestedAmount, l.fundedAmount, l.note])).toEqual(
      avant.lines.map((l) => [l.poste, l.requestedAmount, l.fundedAmount, l.note]),
    );
    expect(r.warnings).toEqual(avant.warnings);
    expect(avertissementsQualifiants(r)).toEqual([]);
    expect(poste(r, 'salaires')!.details).toContain('Taux réservé aux actions qualifiantes : votre formation est déclarée comme telle');
    expect(poste(r, 'frais_annexes')!.details).toContain('Forfait réservé aux actions qualifiantes : votre formation est déclarée comme telle');
  });

  it('moins de 11 salariés : 315 € de salaires et 40,32 € de forfait (8 % de 504 €)', () => {
    const r = calculateFunding(opcoReserve(), etat({ companySize: 'less_11', formationType: 'cqp' }));
    expect([poste(r, 'salaires')!.fundedAmount, poste(r, 'frais_annexes')!.fundedAmount, r.totalFunded]).toEqual([315, 40.32, 859.32]);
  });
});

describe('salaires et forfait réservés aux actions qualifiantes : portée des indicateurs', () => {
  const TOUTES = [...NON_QUALIFIANTES, ...QUALIFIANTES];

  it('sans indicateur, le type de formation ne change ni les salaires ni le forfait (barèmes inchangés)', () => {
    const opco = sansIndicateur(opcoReserve());
    for (const companySize of ['less_11', '11_49'] as const) {
      const montants = TOUTES.map(([, d]) => {
        const r = calculateFunding(opco, etat({ companySize, ...d }));
        return [poste(r, 'salaires')!.fundedAmount, poste(r, 'frais_annexes')!.fundedAmount];
      });
      expect(new Set(montants.map((m) => m.join('/'))).size, companySize).toBe(1);
      for (const [nom, d] of TOUTES) {
        const r = calculateFunding(opco, etat({ companySize, ...d }));
        expect(avertissementsQualifiants(r), nom).toEqual([]);
        expect(r.lines.flatMap((l) => [l.note ?? '', ...(l.details ?? [])]).filter((t) => t.includes('qualifiante')), nom).toEqual([]);
      }
    }
  });

  it('l’indicateur d’une taille vaut aussi pour le taux de l’OPCO quand la taille n’a pas de taux propre', () => {
    const opco = opcoReserve({ plafonds_par_taille: [taille('11_49', { prise_en_charge_salaires_qualifiant: true })] });
    expect(poste(calculateFunding(opco, etat({ formationType: 'non_certifiante' })), 'salaires')!.fundedAmount).toBe(0);
    const qualifiante = calculateFunding(opco, etat({ formationType: 'cqp' }));
    expect(poste(qualifiante, 'salaires')).toMatchObject({ fundedAmount: 315, note: `15${NBSP}€/h × 21${NBSP}h` });
  });

  it('une taille sans prise en charge des salaires garde sa note, sans point d’attention sur les actions qualifiantes', () => {
    const opco = opcoReserve({
      frais_annexes_pourcentage_qualifiant: false,
      plafonds_par_taille: [taille('11_49', { prise_en_charge_salaires_horaire: null, prise_en_charge_salaires_qualifiant: true })],
    });
    const r = calculateFunding(opco, etat({ formationType: 'non_certifiante' }));
    expect(poste(r, 'salaires')!.note).toBe("Pas de prise en charge des salaires pour cette taille d'entreprise");
    expect(avertissementsQualifiants(r)).toEqual([]);
  });

  it('l’indicateur de taille ne concerne que les salaires à l’heure (mode euro_par_heure)', () => {
    const opco = opcoReserve({
      prise_en_charge_salaires: sourcee(50),
      prise_en_charge_salaires_mode: 'pourcentage_pedagogique',
      frais_annexes_pourcentage_qualifiant: false,
    });
    const r = calculateFunding(opco, etat({ formationType: 'non_certifiante' }));
    expect(poste(r, 'salaires')!.fundedAmount).toBe(199.5); // 50 % de 399 €
    expect(avertissementsQualifiants(r)).toEqual([]);
  });

  it('50 salariés et plus sans enveloppe : plan fermé, aucune ligne ni point d’attention sur les actions qualifiantes', () => {
    for (const companySize of ['50_299', '300_plus'] as const) {
      const r = calculateFunding(opcoReserve(), etat({ companySize, formationType: 'non_certifiante' }));
      expect(r.pdcFerme, companySize).toBe(true);
      expect(r.totalFunded, companySize).toBe(0);
      expect(avertissementsQualifiants(r), companySize).toEqual([]);
    }
  });

  it('plafond annuel global appliqué : les postes retirés restent à 0 € et le total ne dépasse pas le plafond', () => {
    const opco = opcoReserve({ budget_annuel_max: sourcee(300), budget_annuel_portee: 'global' });
    const r = calculateFunding(opco, etat({ formationType: 'non_certifiante' }));
    expect(r.budgetCapApplied).toBe(true);
    expect(r.totalFunded).toBe(300);
    expect([poste(r, 'salaires')!.fundedAmount, poste(r, 'frais_annexes')!.fundedAmount]).toEqual([0, 0]);
  });
});

describe('salaires et forfait réservés aux actions qualifiantes : variantes de branche', () => {
  const variante = (over: Partial<VarianteBranche> = {}): VarianteBranche => ({
    id: 'branche-test',
    branche_nom: 'Branche test',
    idcc: ['1234'],
    source_url: 'https://exemple.fr/branche',
    confidence: 'exact',
    ...over,
  });
  const forfait = (opco: OpcoData, declaration: Partial<WizardState>) =>
    poste(calculateFunding(opco, etat({ detectedIdcc: '1234', ...declaration })), 'frais_annexes')!.fundedAmount;

  it('une variante muette sur le forfait hérite du forfait de l’OPCO et de sa réserve', () => {
    const opco = opcoReserve({ variantes_branche: [variante()] });
    expect(forfait(opco, { formationType: 'non_certifiante' })).toBe(0);
    expect(forfait(opco, { formationType: 'cqp' })).toBe(31.92);
  });

  it('une variante qui publie son forfait sans dire la réserve garde celle de l’OPCO ; false l’ouvre à toutes les formations', () => {
    const propre = opcoReserve({ variantes_branche: [variante({ frais_annexes_pourcentage: sourcee(5) })] });
    expect(forfait(propre, { formationType: 'non_certifiante' })).toBe(0);
    expect(forfait(propre, { formationType: 'cqp' })).toBe(19.95); // 5 % de 399 €
    const ouvert = opcoReserve({ variantes_branche: [variante({ frais_annexes_pourcentage: sourcee(5), frais_annexes_pourcentage_qualifiant: false })] });
    expect(forfait(ouvert, { formationType: 'non_certifiante' })).toBe(19.95);
  });

  it('une variante peut réserver un forfait que l’OPCO ouvre à toutes les formations', () => {
    const opco = opcoReserve({ frais_annexes_pourcentage_qualifiant: undefined, variantes_branche: [variante({ frais_annexes_pourcentage_qualifiant: true })] });
    expect(forfait(opco, { formationType: 'non_certifiante' })).toBe(0);
    expect(poste(calculateFunding(opco, etat({ formationType: 'non_certifiante' })), 'frais_annexes')!.fundedAmount).toBe(31.92);
  });

  it('les salaires réservés suivent les tailles de la variante, qui remplacent celles de l’OPCO', () => {
    const opco = opcoReserve({ variantes_branche: [variante({ plafonds_par_taille: [taille('11_49', { prise_en_charge_salaires_horaire: 12 })] })] });
    const r = calculateFunding(opco, etat({ detectedIdcc: '1234', formationType: 'non_certifiante' }));
    expect(poste(r, 'salaires')!.fundedAmount).toBe(252); // 12 €/h × 21 h, aucune réserve dans la variante
  });

  it('applyVarianteBranche : la réserve du forfait est héritée sans muter l’OPCO', () => {
    const opco = opcoReserve({ variantes_branche: [variante({ frais_annexes_pourcentage_qualifiant: false })] });
    expect(applyVarianteBranche(opco, opco.variantes_branche![0]).frais_annexes_pourcentage_qualifiant).toBe(false);
    expect(applyVarianteBranche(opco, variante()).frais_annexes_pourcentage_qualifiant).toBe(true);
    expect(opco.frais_annexes_pourcentage_qualifiant).toBe(true);
  });
});

describe('schéma : indicateurs des actions qualifiantes', () => {
  const opco = opcoReserve({ variantes_branche: [{ id: 'b', branche_nom: 'B', idcc: ['1234'], source_url: 'https://exemple.fr/b', confidence: 'exact', frais_annexes_pourcentage_qualifiant: false }] });

  it('les trois indicateurs sont conservés par le schéma (Zod ne les retire pas)', () => {
    const lu = OpcoDataSchema.parse(opco);
    expect(lu.frais_annexes_pourcentage_qualifiant).toBe(true);
    expect(lu.variantes_branche![0].frais_annexes_pourcentage_qualifiant).toBe(false);
    expect(lu.plafonds_par_taille!.find((p) => p.taille === '11_49')!.prise_en_charge_salaires_qualifiant).toBe(true);
  });

  it('ils sont facultatifs : un barème publié sans eux reste valide', () => {
    const lu = OpcoDataSchema.parse(sansIndicateur(opco));
    expect(lu.frais_annexes_pourcentage_qualifiant).toBeUndefined();
    expect(lu.plafonds_par_taille!.every((p) => p.prise_en_charge_salaires_qualifiant === undefined)).toBe(true);
  });

  it('une valeur qui n’est pas un booléen est refusée', () => {
    expect(OpcoDataSchema.safeParse({ ...opco, frais_annexes_pourcentage_qualifiant: 'oui' }).success).toBe(false);
    expect(VarianteBrancheSchema.safeParse({ ...opco.variantes_branche![0], frais_annexes_pourcentage_qualifiant: 1 }).success).toBe(false);
    expect(PlafondTailleSchema.safeParse({ ...taille('11_49'), prise_en_charge_salaires_qualifiant: 'true' }).success).toBe(false);
  });
});
