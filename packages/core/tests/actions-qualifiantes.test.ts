// ============================================================
// Salaires et forfait de frais annexes réservés aux actions qualifiantes (indicateurs `prise_en_charge_salaires_qualifiant`
// d'une taille d'entreprise et `frais_annexes_pourcentage_qualifiant` d'un barème). Une action qualifiante est, selon
// l'article L. 6314-1 du code du travail et les fiches de Constructys (« qualification CCN Bâtiment / certification RNCP /
// blocs de compétences / CQP inscrits ou non au RNCP »), une certification enregistrée au RNCP (diplôme d'État compris) ou
// un CQP ; une certification du répertoire spécifique, une habilitation, une « certification » sans répertoire précisé et
// un type inconnu ne le sont pas : l'incertitude ne s'additionne jamais.
// ============================================================

import { describe, it, expect } from 'vitest';
import { construirePlan } from '../src/aides/plan';
import { profilDepuisWizard } from '../src/aides/profil';
import { applyVarianteBranche, calculateFunding } from '../src/calculator';
import { EMBEDDED_OPCOS, getEmbeddedOpcoBySlug } from '../src/data';
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

// ---------------------------------------------------------------------------
// Données réelles. Fiche officielle « Modalites_Batiment_PDC_2026.pdf » (Constructys, septembre 2026, archive
// https://www.constructys.fr/wp-content/uploads/BATIMENT-Modalites-2026.zip), relue le 2026-10-08 :
// « Entreprises de moins de 11 salariés Plafond : 15 € HT / heure / stagiaire. Sauf FEEBAT plafond : 100 € HT / jour / stagiaire. »
// « Entreprises de 11 à moins de 50 salariés Plafond : 10 € HT / heure / stagiaire uniquement pour les actions qualifiantes. »
// « Frais annexes (uniquement pour les actions qualifiantes) : Plafond : 8 % des coûts pédagogiques financés par Constructys
// dans la limite de 1 500 € HT / stagiaire. »
// ---------------------------------------------------------------------------

describe('Constructys (données réelles) : salaires et forfait réservés aux actions qualifiantes', () => {
  const constructys = getEmbeddedOpcoBySlug('constructys')!;
  /** Profil du constat : formation de 21 h à 1 200 € (57,14 €/h). */
  const profil = (over: Partial<WizardState>): WizardState =>
    makeFormationState({
      selectedOpcoSlug: 'constructys',
      companySize: '11_49',
      trainingMode: 'presentiel',
      durationHours: 21,
      pedagogyCostTotal: 1200,
      pedagogyCostPerHour: 1200 / 21,
      ...over,
    });
  const montants = (r: FundingResult) => ({
    pedagogie: poste(r, 'pedagogie')!.fundedAmount,
    salaires: poste(r, 'salaires')!.fundedAmount,
    forfait: poste(r, 'frais_annexes')?.fundedAmount ?? null,
    total: r.totalFunded,
  });
  /** Le barème par défaut de Constructys est celui du Bâtiment ; la variante le répète (choisie ou détectée par l'IDCC 1597). */
  const BATIMENT: [string, Partial<WizardState>][] = [
    ['barème par défaut', {}],
    ['Bâtiment choisi', { selectedBrancheId: 'batiment' }],
    ['IDCC 1597 détecté', { detectedIdcc: '1597' }],
  ];

  it.each(BATIMENT)('%s, 11 à 49 salariés : 0 € de salaires et de forfait pour une formation non qualifiante (399 € au lieu de 640,92 €)', (_, branche) => {
    for (const [nom, declaration] of NON_QUALIFIANTES) {
      expect(montants(calculateFunding(constructys, profil({ ...branche, ...declaration }))), nom).toEqual({
        pedagogie: 399,
        salaires: 0,
        forfait: 0,
        total: 399,
      });
    }
  });

  it.each(BATIMENT)('%s, 11 à 49 salariés : 210 € de salaires et 31,92 € de forfait pour une certification RNCP, un diplôme ou un CQP', (_, branche) => {
    for (const [nom, declaration] of QUALIFIANTES) {
      expect(montants(calculateFunding(constructys, profil({ ...branche, ...declaration }))), nom).toEqual({
        pedagogie: 399,
        salaires: 210,
        forfait: 31.92,
        total: 640.92,
      });
    }
  });

  it.each(BATIMENT)('%s, moins de 11 salariés : 15 €/h de salaires pour toute formation, forfait pour une action qualifiante seulement', (_, branche) => {
    for (const [nom, declaration] of NON_QUALIFIANTES) {
      expect(montants(calculateFunding(constructys, profil({ companySize: 'less_11', ...branche, ...declaration }))), nom).toEqual({
        pedagogie: 504,
        salaires: 315,
        forfait: 0,
        total: 819,
      });
    }
    for (const [nom, declaration] of QUALIFIANTES) {
      expect(montants(calculateFunding(constructys, profil({ companySize: 'less_11', ...branche, ...declaration }))), nom).toEqual({
        pedagogie: 504,
        salaires: 315,
        forfait: 40.32,
        total: 859.32,
      });
    }
  });

  it('50 salariés et plus : plan fermé quel que soit le type (aucune enveloppe publiée pour le Bâtiment de 50 à 299 salariés)', () => {
    for (const companySize of ['50_299', '300_plus'] as const) {
      for (const [nom, declaration] of [...NON_QUALIFIANTES, ...QUALIFIANTES]) {
        const r = calculateFunding(constructys, profil({ companySize, ...declaration }));
        expect([r.pdcFerme, r.totalFunded], `${companySize} ${nom}`).toEqual([true, 0]);
      }
    }
  });

  it('Travaux publics et Négoce : le type de formation ne change rien (aucune réserve), le Négoce ne finance ni salaires ni forfait', () => {
    for (const [branche, companySize] of [
      ['travaux-publics', 'less_11'],
      ['travaux-publics', '11_49'],
      ['negoce-materiaux', 'less_11'],
      ['negoce-materiaux', '11_49'],
    ] as const) {
      const resultats = [...NON_QUALIFIANTES, ...QUALIFIANTES].map(([, d]) =>
        calculateFunding(constructys, profil({ selectedBrancheId: branche, companySize, ...d })),
      );
      expect(new Set(resultats.map((r) => JSON.stringify(montants(r)))).size, `${branche} ${companySize}`).toBe(1);
      expect(resultats.flatMap(avertissementsQualifiants), `${branche} ${companySize}`).toEqual([]);
      expect(poste(resultats[0], 'frais_annexes'), `${branche} ${companySize}`).toBeUndefined();
    }
    expect(montants(calculateFunding(constructys, profil({ selectedBrancheId: 'travaux-publics', companySize: 'less_11' })))).toEqual({
      pedagogie: 672,
      salaires: 315,
      forfait: null,
      total: 987,
    });
    for (const companySize of ['less_11', '11_49'] as const) {
      expect(montants(calculateFunding(constructys, profil({ selectedBrancheId: 'negoce-materiaux', companySize }))), companySize).toEqual({
        pedagogie: 630,
        salaires: 0,
        forfait: null,
        total: 630,
      });
    }
  });

  it('le point d’attention affiché nomme les deux postes, leurs taux et la condition (Bâtiment, 11 à 49 salariés, formation courte)', () => {
    const r = calculateFunding(constructys, profil({ formationType: 'non_certifiante' }));
    expect(avertissementsQualifiants(r)).toEqual([
      `Constructys réserve la prise en charge des salaires (10${NBSP}€/h) et le forfait de frais annexes (8${NBSP}% des coûts pédagogiques) ` +
        `aux actions qualifiantes : ${DEFINITION}. Votre formation n'est pas déclarée comme telle : ces postes ne sont pas comptés.`,
    ]);
    expect(poste(r, 'salaires')!.sourceUrl).toBe('https://www.constructys.fr/conditions-de-prise-en-charge-2/');
    expect(poste(r, 'frais_annexes')!.sourceUrl).toBe('https://www.constructys.fr/conditions-de-prise-en-charge-2/');
  });

  it('les indicateurs sont posés là où la fiche Bâtiment 2026 les écrit, et nulle part ailleurs', () => {
    const batiment = constructys.variantes_branche!.find((v) => v.id === 'batiment')!;
    // Forfait : barème par défaut (le Bâtiment) et variante Bâtiment, qui le répète.
    expect([constructys.frais_annexes_pourcentage_qualifiant, batiment.frais_annexes_pourcentage_qualifiant]).toEqual([true, true]);
    // Salaires : 11 à 49 salariés seulement (sous 11 salariés, 15 €/h pour toute formation).
    const tailles = (plafonds: PlafondTaille[] | undefined) =>
      Object.fromEntries((plafonds ?? []).map((p) => [p.taille, p.prise_en_charge_salaires_qualifiant ?? null]));
    const attendu = { less_11: null, '11_49': true, '50_299': null, '300_plus': null };
    expect(tailles(constructys.plafonds_par_taille)).toEqual(attendu);
    expect(tailles(batiment.plafonds_par_taille)).toEqual(attendu);
    // Travaux publics et Négoce : aucun forfait (8 % propre au Bâtiment) ni réserve sur les salaires.
    for (const id of ['travaux-publics', 'negoce-materiaux']) {
      const v = constructys.variantes_branche!.find((x) => x.id === id)!;
      expect(v.frais_annexes_pourcentage!.value, id).toBeNull();
      expect(v.frais_annexes_pourcentage_qualifiant, id).toBeUndefined();
      expect(Object.values(tailles(v.plafonds_par_taille)).every((x) => x === null), id).toBe(true);
    }
    // Aucun autre OPCO ne porte ces indicateurs (balayage des 11 OPCO du 2026-10-08).
    const porteurs = EMBEDDED_OPCOS.filter((o) =>
      JSON.stringify(o).match(/"(?:frais_annexes_pourcentage|prise_en_charge_salaires)_qualifiant"/),
    ).map((o) => o.slug);
    expect(porteurs).toEqual(['constructys']);
  });
});

// ---------------------------------------------------------------------------
// Balayage des 11 OPCO, toutes branches, à graine fixe.
// ---------------------------------------------------------------------------

/** mulberry32 : tirages indépendants et reproductibles. */
function generateur(graine: number) {
  let etatInterne = graine;
  return (n: number) => {
    etatInterne = (etatInterne + 0x6d2b79f5) | 0;
    let t = Math.imul(etatInterne ^ (etatInterne >>> 15), 1 | etatInterne);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
}

describe('balayage des 11 OPCO et de leurs branches (graine 2026) : la réserve ne fait jamais gagner une formation non qualifiante', () => {
  it('aucun NaN, aucun poste financé au-delà de sa demande, plan dans la limite du coût ; à pédagogie égale, le profil non qualifiant ne reçoit jamais plus', () => {
    const hasard = generateur(2026);
    const un = <T,>(liste: readonly T[]): T => liste[hasard(liste.length)];
    const compte = { paires: 0, comparees: 0, retires: 0, opcos: new Set<string>() };
    const pedagogie = (r: FundingResult) => poste(r, 'pedagogie')!.fundedAmount;
    const montantDe = (r: FundingResult, p: string) => poste(r, p)?.fundedAmount ?? 0;
    for (; compte.paires < 3000; compte.paires++) {
      const opco = un(EMBEDDED_OPCOS);
      const heures = un([7, 21, 35, 140, 400, 1200]);
      const cout = un([150, 600, 1200, 3500, 9000, 24000]);
      const commun: Partial<WizardState> = {
        projetType: 'formation_salarie',
        selectedOpcoSlug: opco.slug,
        selectedBrancheId: un([null, ...(opco.variantes_branche ?? []).map((v) => v.id)]),
        companySize: un(['less_11', '11_49', '50_299', '300_plus'] as const),
        trainingMode: 'presentiel',
        durationHours: heures,
        pedagogyCostTotal: cout,
        pedagogyCostPerHour: cout / heures,
        needsTransport: hasard(2) === 0,
        needsAccommodation: hasard(2) === 0,
        accommodationNights: un([1, 2, 5]),
        accommodationCostPerNight: un([60, 120, 200]),
        needsMeals: hasard(2) === 0,
        mealCostPerDay: un([12, 20, 30]),
        trainingDays: Math.max(1, Math.round(heures / 7)),
        budgetDejaConsomme: un([null, 0, 500]),
      };
      const etats = [
        makeFormationState({ ...commun, ...un(NON_QUALIFIANTES)[1] }),
        makeFormationState({ ...commun, ...un(QUALIFIANTES)[1] }),
      ];
      const [non, qual] = etats.map((e) => calculateFunding(opco, e));
      etats.forEach((e, i) => {
        const r = [non, qual][i];
        const contexte = `${opco.slug} ${JSON.stringify(e)}`;
        const nombres = [
          r.totalRequested,
          r.totalFunded,
          r.totalRemainder,
          r.enveloppeMaxPotentielle,
          ...r.lines.flatMap((l) => [l.requestedAmount, l.fundedAmount, l.remainder]),
          ...r.dispositifsComplementaires.map((d) => d.montantEstime ?? 0),
        ];
        expect(nombres.every(Number.isFinite), contexte).toBe(true);
        for (const l of r.lines) {
          expect(l.fundedAmount, `${contexte} ${l.poste}`).toBeGreaterThanOrEqual(0);
          expect(l.fundedAmount, `${contexte} ${l.poste}`).toBeLessThanOrEqual(l.requestedAmount + 0.005);
        }
        expect(r.totalFunded, contexte).toBeLessThanOrEqual(r.totalRequested + 0.005);
        const plan = construirePlan(r, [], profilDepuisWizard(e, opco.slug));
        expect(plan.totalFinance, contexte).toBeLessThanOrEqual(plan.coutFormation + 0.005);
      });
      // À pédagogie égale et sans plafond annuel appliqué, seule la réserve distingue les deux profils : jamais plus pour
      // le profil non qualifiant, ni sur les salaires, ni sur les frais annexes, ni au total. Ailleurs la pédagogie peut
      // différer selon le type pour d'autres raisons (plafond des certifications plus bas chez OPCO EP, barème dégressif
      // réservé aux certifiantes chez Uniformation) : la comparaison des totaux n'y dirait rien de la réserve.
      if (pedagogie(non) === pedagogie(qual) && !non.budgetCapApplied && !qual.budgetCapApplied) {
        compte.comparees++;
        const contexte = `${opco.slug} ${JSON.stringify(etats[0])}`;
        expect(montantDe(non, 'salaires'), contexte).toBeLessThanOrEqual(montantDe(qual, 'salaires') + 0.005);
        expect(montantDe(non, 'frais_annexes'), contexte).toBeLessThanOrEqual(montantDe(qual, 'frais_annexes') + 0.005);
        expect(non.totalFunded, contexte).toBeLessThanOrEqual(qual.totalFunded + 0.005);
        if (non.totalFunded < qual.totalFunded - 0.005) {
          compte.retires++;
          compte.opcos.add(opco.slug);
        }
      }
    }
    // Le balayage exerce la réserve (Constructys) et compare la plupart des paires.
    expect(compte.comparees, JSON.stringify(compte)).toBeGreaterThan(2000);
    expect(compte.retires, JSON.stringify(compte)).toBeGreaterThan(30);
    expect([...compte.opcos]).toEqual(['constructys']);
  });
});
