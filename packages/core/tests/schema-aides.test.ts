import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import {
  AideSchema,
  CriteresAideSchema,
  DatasetSchema,
  IdccTableSchema,
  OpcoDataSchema,
  PlafondsParTailleSchema,
  PortailRegionalSchema,
  sanityCheckAides,
  sanityCheckOpco,
  validateDataset,
} from '../src/schema';
import { FINANCEUR_LABELS, type Aide } from '../src/aides/types';
import { EMBEDDED_OPCOS } from '../src/data';
import { makeAide } from './fixtures-aides';

// Vérification à la compilation : le schéma Zod produit bien des `Aide`.
const versAide = (a: z.infer<typeof AideSchema>): Aide => a;
// Sens inverse : toute `Aide` est acceptée en entrée du schéma.
const depuisAide = (a: Aide): z.input<typeof AideSchema> => a;

/** Problèmes remontés par un schéma sur une donnée (liste vide = valide). */
function problemes(schema: z.ZodTypeAny, donnee: unknown) {
  const r = schema.safeParse(donnee);
  return r.success ? [] : r.error.issues;
}

describe('schéma du catalogue d’aides', () => {
  it('accepte une aide complète', () => {
    expect(versAide(AideSchema.parse(depuisAide(makeAide()))).id).toBe('nat-test');
  });

  it('refuse un forfait sans valeur', () => {
    const aide = makeAide({ montant: { ...makeAide().montant, valeur: null } });
    expect(AideSchema.safeParse(aide).success).toBe(false);
  });

  it('refuse un pourcentage sans base', () => {
    const aide = makeAide({ montant: { ...makeAide().montant, mode: 'pourcentage', valeur: null, pourcentage: 50, base: null } });
    expect(AideSchema.safeParse(aide).success).toBe(false);
  });

  it('refuse une source non https', () => {
    const aide = makeAide({ sources: [{ url: 'http://exemple.fr', titre: 't', extrait: 'e' }] });
    expect(AideSchema.safeParse(aide).success).toBe(false);
  });

  it('refuse un identifiant mal formé', () => {
    expect(AideSchema.safeParse(makeAide({ id: 'Nat Test' })).success).toBe(false);
  });

  it('sanityCheckAides détecte doublons et alternatives inconnues', () => {
    const a = makeAide({ id: 'nat-a', cumul: { cumulable: true, alternatives: ['nat-z'] } });
    const issues = sanityCheckAides([a, makeAide({ id: 'nat-a' })]);
    expect(issues.some((i) => i.includes('en double'))).toBe(true);
    expect(issues.some((i) => i.includes('nat-z'))).toBe(true);
  });

  it('sanityCheckAides détecte des bornes incohérentes', () => {
    const a = makeAide({ criteres: { age_min: 30, age_max: 20 } });
    expect(sanityCheckAides([a])).toEqual(['aide nat-test : age_min > age_max']);
  });

  it('sanityCheckAides détecte une période de validité incohérente', () => {
    const a = makeAide({ validite: { debut: '2026-12-01', fin: '2026-01-01' } });
    expect(sanityCheckAides([a])).toEqual(['aide nat-test : validité incohérente']);
  });

  it('valide un portail régional', () => {
    const portail = {
      region: '11',
      nom_region: 'Île-de-France',
      liens: [{ titre: 'Région', url: 'https://www.iledefrance.fr', type: 'region' }],
      derniere_verification: '2026-10-05',
    };
    expect(PortailRegionalSchema.safeParse(portail).success).toBe(true);
    expect(PortailRegionalSchema.safeParse({ ...portail, region: '99' }).success).toBe(false);
  });

  it('valide une table IDCC', () => {
    const table = {
      '1516': { idcc: '1516', titre: 'Organismes de formation', opco: 'akto', statut: 'actif', source: 'https://x.fr' },
      '9999': { idcc: '9999', titre: 'Absence de convention collective', opco: null, statut: 'echappatoire', source: 'https://x.fr' },
    };
    expect(IdccTableSchema.safeParse(table).success).toBe(true);
  });

  it.each(['2026-13-45', '2026-02-30', '2026-02-29', '2026-04-31', '2026-00-10'])(
    'refuse la date impossible %s',
    (date) => {
      expect(AideSchema.safeParse(makeAide({ derniere_verification: date })).success).toBe(false);
    },
  );

  it.each(['2026-02-28', '2028-02-29', '2026-12-31'])('accepte la date réelle %s', (date) => {
    expect(AideSchema.safeParse(makeAide({ derniere_verification: date })).success).toBe(true);
  });

  it('applique le même contrôle aux dates de validité', () => {
    expect(AideSchema.safeParse(makeAide({ validite: { debut: '2026-02-30', fin: null } })).success).toBe(false);
    expect(AideSchema.safeParse(makeAide({ validite: { debut: null, fin: '2026-13-45' } })).success).toBe(false);
  });
});

describe('schémas du catalogue stricts', () => {
  // Une clé mal orthographiée ne doit pas disparaître en silence : elle retirerait une condition de l'aide.
  const aide = makeAide();
  const majoration = { criteres: { age_max: 25 }, valeur: 6000, libelle: 'Moins de 26 ans' };
  const avecMontant = (champs: object) => ({ ...aide, montant: { ...aide.montant, ...champs } });
  const avecMajoration = (champs: object) => avecMontant({ majorations: [{ ...majoration, ...champs }] });
  const portail = {
    region: '11',
    nom_region: 'Île-de-France',
    liens: [{ titre: 'Région', url: 'https://www.iledefrance.fr', type: 'region' }],
    derniere_verification: '2026-10-05',
  };

  const cas: [string, z.ZodTypeAny, unknown, string, (string | number)[]][] = [
    ['l’aide', AideSchema, { ...aide, region: '11' }, 'region', []],
    ['les critères', AideSchema, { ...aide, criteres: { age_maxi: 30 } }, 'age_maxi', ['criteres']],
    ['le montant', AideSchema, avecMontant({ plafon: 500 }), 'plafon', ['montant']],
    ['une majoration', AideSchema, avecMajoration({ plafon: 1 }), 'plafon', ['montant', 'majorations', 0]],
    ['les critères d’une majoration', AideSchema, avecMajoration({ criteres: { age_maxi: 25 } }), 'age_maxi', ['montant', 'majorations', 0, 'criteres']],
    ['une source', AideSchema, { ...aide, sources: [{ ...aide.sources[0], titr: 'x' }] }, 'titr', ['sources', 0]],
    ['la règle de cumul', AideSchema, { ...aide, cumul: { cumulable: true, alternative: ['nat-z'] } }, 'alternative', ['cumul']],
    ['la période de validité', AideSchema, { ...aide, validite: { debut: null, fin: null, jusque: null } }, 'jusque', ['validite']],
    ['le portail régional', PortailRegionalSchema, { ...portail, regions: ['11'] }, 'regions', []],
    ['un lien de portail', PortailRegionalSchema, { ...portail, liens: [{ ...portail.liens[0], libelle: 'x' }] }, 'libelle', ['liens', 0]],
  ];

  it.each(cas)('refuse une clé inconnue dans %s', (_objet, schema, donnee, cle, chemin) => {
    expect(problemes(schema, donnee)).toMatchObject([{ code: 'unrecognized_keys', keys: [cle], path: chemin }]);
  });

  it('accepte une aide qui renseigne toutes les clés facultatives', () => {
    const complete = makeAide({
      criteres: {
        regions: ['11'],
        perimetre_region: 'beneficiaire',
        departements: ['75', '2A'],
        effectif_min: 1,
        effectif_max: 49,
        age_min: 16,
        age_max: 29,
        rqth: true,
        niveaux_diplome: ['bac'],
        niveau_certification_max: 5,
        niveau_certification_min: 3,
        contrats: ['cdi'],
        types_alternance: ['apprentissage'],
        anciennete_min_mois: 6,
        inscrit_france_travail: true,
        statuts_dirigeant: ['artisan'],
        micro_entrepreneur: false,
        certifications: ['rncp'],
        eligible_cpf: true,
        duree_min_heures: 10,
        duree_max_heures: 500,
        opcos: ['akto'],
        idcc: ['1516'],
        naf_prefixes: ['85'],
        structures: ['ess'],
        qualiopi_requis: true,
      },
      montant: {
        ...aide.montant,
        majorations: [{ criteres: { age_max: 25 }, valeur: 6000, pourcentage: null, plafond: null, libelle: 'Moins de 26 ans' }],
      },
      cumul: { cumulable: false, alternatives: ['nat-b'], note: 'Au choix avec nat-b.' },
      liens_par_region: { '11': 'https://www.iledefrance.fr' },
      validite: { debut: '2026-01-01', fin: '2026-12-31' },
      ordre_empilement: 40,
    });
    expect(problemes(AideSchema, complete)).toEqual([]);
    // La fixture exerce toutes les clés connues du schéma : un oubli futur ferait échouer ces deux lignes.
    expect(Object.keys(complete).sort()).toEqual(Object.keys(AideSchema.shape).sort());
    expect(Object.keys(complete.criteres).sort()).toEqual(Object.keys(CriteresAideSchema.shape).sort());
  });
});

describe('schéma OPCO v4', () => {
  it('refuse une taille en double dans plafonds_par_taille', () => {
    const p = { taille: 'less_11', cout_horaire_max: null, budget_annuel_max: 1000, quota_horaire_max: null, description: 'x' };
    expect(PlafondsParTailleSchema.safeParse([p, p]).success).toBe(false);
  });

  it('refuse une date de vérification impossible', () => {
    const opco = { ...EMBEDDED_OPCOS[0], derniere_verification: '2026-02-28' };
    expect(OpcoDataSchema.safeParse(opco).success).toBe(true);
    expect(OpcoDataSchema.safeParse({ ...opco, derniere_verification: '2026-02-30' }).success).toBe(false);
  });
});

describe('sanityCheckOpco : barèmes par tranche', () => {
  const opco = () => OpcoDataSchema.parse(EMBEDDED_OPCOS[0]);
  const variante = (seuils: { max_heures: number | null; valeur: number }[]) => ({
    id: 'v1',
    branche_nom: 'Branche de test',
    idcc: ['1234'],
    source_url: 'https://example.test/branche',
    confidence: 'exact' as const,
    cout_horaire_seuils: seuils,
  });
  const DERNIERE_TRANCHE = 'cout_horaire_seuils : la dernière tranche doit avoir max_heures null';

  it('accepte une dernière tranche sans limite, quel que soit l’ordre de saisie', () => {
    const o = opco();
    o.cout_horaire_seuils = [{ max_heures: null, valeur: 20 }, { max_heures: 100, valeur: 30 }];
    o.variantes_branche = [variante([{ max_heures: null, valeur: 10 }, { max_heures: 50, valeur: 25 }])];
    expect(sanityCheckOpco(o).filter((i) => i.includes('cout_horaire_seuils'))).toEqual([]);
  });

  it('signale un barème de l’OPCO dont la dernière tranche est limitée', () => {
    const o = opco();
    o.cout_horaire_seuils = [{ max_heures: 200, valeur: 20 }, { max_heures: 100, valeur: 30 }];
    expect(sanityCheckOpco(o)).toContain(`${o.slug}: ${DERNIERE_TRANCHE}`);
  });

  it('signale un barème de variante dont la dernière tranche est limitée', () => {
    const o = opco();
    o.variantes_branche = [variante([{ max_heures: 100, valeur: 30 }, { max_heures: 200, valeur: 20 }])];
    expect(sanityCheckOpco(o)).toContain(`${o.slug}: variante[v1].${DERNIERE_TRANCHE}`);
  });

  it('contrôle les bornes des tranches de l’OPCO et celles de chaque variante', () => {
    const o = opco();
    o.cout_horaire_seuils = [{ max_heures: null, valeur: 250 }];
    o.variantes_branche = [variante([{ max_heures: 100, valeur: 250 }, { max_heures: null, valeur: 10 }])];
    const issues = sanityCheckOpco(o);
    expect(issues).toContain(`${o.slug}: cout_horaire_seuils.valeur=250 hors bornes [0, 200]`);
    expect(issues).toContain(`${o.slug}: variante[v1].cout_horaire_seuils.valeur=250 hors bornes [0, 200]`);
  });
});

describe('dataset v4', () => {
  const portail = {
    region: '11',
    nom_region: 'Île-de-France',
    liens: [{ titre: 'Région', url: 'https://www.iledefrance.fr', type: 'region' }],
    derniere_verification: '2026-10-05',
  };
  // Sections non vides et valides : un schéma qui les ignorerait ne les restituerait pas.
  const datasetV4 = (over: Record<string, unknown> = {}) => ({
    version: 4,
    generatedAt: '2026-10-05T00:00:00.000Z',
    opcos: EMBEDDED_OPCOS,
    aides: [makeAide()],
    idcc: {
      '1516': { idcc: '1516', titre: 'Organismes de formation', opco: 'akto', statut: 'actif', source: 'https://x.fr' },
    },
    naf: [{ prefixe: '85', opco: 'akto', part: 0.6, libelle: 'Enseignement', source: 'https://x.fr' }],
    portails: [portail],
    ...over,
  });

  it('accepte les sections facultatives', () => {
    const ds = validateDataset(datasetV4());
    expect(ds.aides?.map((a) => a.id)).toEqual(['nat-test']);
    expect(Object.keys(ds.idcc ?? {})).toEqual(['1516']);
    expect(ds.naf?.map((n) => n.prefixe)).toEqual(['85']);
    expect(ds.portails?.map((p) => p.region)).toEqual(['11']);
  });

  it('rejette un dataset dont un portail est invalide', () => {
    const http = { ...portail, liens: [{ ...portail.liens[0], url: 'http://www.iledefrance.fr' }] };
    expect(() => validateDataset(datasetV4({ portails: [http] }))).toThrow(/portails/);
  });

  it('un ancien dataset sans aides reste valide', () => {
    const ds = { version: 3, generatedAt: '2026-06-11T00:00:00.000Z', opcos: EMBEDDED_OPCOS };
    expect(DatasetSchema.parse(ds).aides).toBeUndefined();
  });

  it('rejette un dataset dont les aides sont incohérentes', () => {
    const ds = {
      version: 4,
      generatedAt: '2026-10-05T00:00:00.000Z',
      opcos: EMBEDDED_OPCOS,
      aides: [makeAide({ id: 'nat-a' }), makeAide({ id: 'nat-a' })],
    };
    expect(() => validateDataset(ds)).toThrow(/en double/);
  });

  it('rejette avec un message accentué qui liste chaque problème', () => {
    const ds = datasetV4({ aides: [makeAide({ id: 'nat-a' }), makeAide({ id: 'nat-a' })] });
    expect(() => validateDataset(ds)).toThrow('Dataset rejeté :\n- aide nat-a : identifiant en double');
  });
});

describe('libellés des financeurs', () => {
  it('conservent leurs accents', () => {
    expect(FINANCEUR_LABELS).toMatchObject({
      etat: 'État',
      region: 'Région',
      departement: 'Département',
      europe: 'Union européenne',
      faf: 'Fonds de formation des non-salariés',
      fiscal: 'Fiscalité',
    });
  });
});
