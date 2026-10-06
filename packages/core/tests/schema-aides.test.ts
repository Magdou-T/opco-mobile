import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import {
  AideSchema,
  DatasetSchema,
  IdccTableSchema,
  PlafondsParTailleSchema,
  PortailRegionalSchema,
  sanityCheckAides,
  validateDataset,
} from '../src/schema';
import type { Aide } from '../src/aides/types';
import { EMBEDDED_OPCOS } from '../src/data';
import { makeAide } from './fixtures-aides';

// Vérification à la compilation : le schéma Zod produit bien des `Aide`.
const versAide = (a: z.infer<typeof AideSchema>): Aide => a;

describe('schema du catalogue d\'aides', () => {
  it('accepte une aide complete', () => {
    expect(versAide(AideSchema.parse(makeAide())).id).toBe('nat-test');
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

  it('refuse un identifiant mal forme', () => {
    expect(AideSchema.safeParse(makeAide({ id: 'Nat Test' })).success).toBe(false);
  });

  it('sanityCheckAides detecte doublons et alternatives inconnues', () => {
    const a = makeAide({ id: 'nat-a', cumul: { cumulable: true, alternatives: ['nat-z'] } });
    const issues = sanityCheckAides([a, makeAide({ id: 'nat-a' })]);
    expect(issues.some((i) => i.includes('en double'))).toBe(true);
    expect(issues.some((i) => i.includes('nat-z'))).toBe(true);
  });

  it('sanityCheckAides detecte des bornes incoherentes', () => {
    const a = makeAide({ criteres: { age_min: 30, age_max: 20 } });
    expect(sanityCheckAides([a]).length).toBeGreaterThan(0);
  });

  it('valide un portail regional', () => {
    const portail = {
      region: '11',
      nom_region: 'Ile-de-France',
      liens: [{ titre: 'Region', url: 'https://www.iledefrance.fr', type: 'region' }],
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
});

describe('schema OPCO v4', () => {
  it('refuse une taille en double dans plafonds_par_taille', () => {
    const p = { taille: 'less_11', cout_horaire_max: null, budget_annuel_max: 1000, quota_horaire_max: null, description: 'x' };
    expect(PlafondsParTailleSchema.safeParse([p, p]).success).toBe(false);
  });
});

describe('dataset v4', () => {
  it('accepte les sections facultatives', () => {
    const ds = {
      version: 4,
      generatedAt: '2026-10-05T00:00:00.000Z',
      opcos: EMBEDDED_OPCOS,
      aides: [makeAide()],
      idcc: {},
      naf: [],
      portails: [],
    };
    expect(() => validateDataset(ds)).not.toThrow();
  });

  it('un ancien dataset sans aides reste valide', () => {
    const ds = { version: 3, generatedAt: '2026-06-11T00:00:00.000Z', opcos: EMBEDDED_OPCOS };
    expect(DatasetSchema.parse(ds).aides).toBeUndefined();
  });

  it('rejette un dataset dont les aides sont incoherentes', () => {
    const ds = {
      version: 4,
      generatedAt: '2026-10-05T00:00:00.000Z',
      opcos: EMBEDDED_OPCOS,
      aides: [makeAide({ id: 'nat-a' }), makeAide({ id: 'nat-a' })],
    };
    expect(() => validateDataset(ds)).toThrow(/en double/);
  });
});
