import { describe, it, expect } from 'vitest';
import { OpcoDataSchema, validateDataset, sanityCheckOpco } from '../src/schema';
import { EMBEDDED_OPCOS } from '../src/data';
import { resolveIdccToOpco } from '../src/opco-resolver';

describe('schéma — dataset embarqué', () => {
  it('contient bien 11 OPCO', () => {
    expect(EMBEDDED_OPCOS).toHaveLength(11);
  });

  it('chaque OPCO embarqué respecte le schéma Zod', () => {
    for (const o of EMBEDDED_OPCOS) {
      expect(() => OpcoDataSchema.parse(o)).not.toThrow();
    }
  });

  it('chaque OPCO embarqué passe les bornes de cohérence', () => {
    for (const o of EMBEDDED_OPCOS) {
      expect(sanityCheckOpco(o as never)).toEqual([]);
    }
  });

  it('validateDataset accepte le dataset embarqué', () => {
    const ds = { version: 1, generatedAt: new Date().toISOString(), opcos: EMBEDDED_OPCOS };
    expect(() => validateDataset(ds)).not.toThrow();
  });

  it('validateDataset rejette un dataset incomplet', () => {
    const ds = { version: 1, generatedAt: new Date().toISOString(), opcos: EMBEDDED_OPCOS.slice(0, 3) };
    expect(() => validateDataset(ds)).toThrow();
  });

  it('sanityCheck détecte un coût horaire hors bornes', () => {
    const bad = { ...EMBEDDED_OPCOS[0], cout_horaire_inter: { value: 999, confidence: 'exact', source_url: 'x' } };
    expect(sanityCheckOpco(bad as never).length).toBeGreaterThan(0);
  });
});

describe('résolution IDCC → OPCO', () => {
  it('mappe un IDCC connu vers le bon OPCO', () => {
    // 0002 → opco2i (Industrie) d'après idcc-opco-map.json
    const res = resolveIdccToOpco(['0002']);
    expect(res[0]?.opcoSlug).toBe('opco2i');
  });

  it('normalise les codes courts (padding 4 chiffres)', () => {
    const res = resolveIdccToOpco(['2']);
    expect(res[0]?.opcoSlug).toBe('opco2i');
  });

  it('ignore les IDCC inconnus', () => {
    expect(resolveIdccToOpco(['9999'])).toEqual([]);
  });
});
