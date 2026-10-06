import { describe, it, expect } from 'vitest';
import {
  DEPARTEMENT_REGION,
  REGIONS,
  REGIONS_TRIEES,
  departementDuCodePostal,
  estCodeRegion,
  regionDuDepartement,
} from '../src/geo';

describe('référentiel géographique', () => {
  it('compte 18 régions et 101 départements', () => {
    expect(Object.keys(REGIONS)).toHaveLength(18);
    expect(Object.keys(DEPARTEMENT_REGION)).toHaveLength(101);
    expect(REGIONS_TRIEES).toHaveLength(18);
  });

  it('rattache chaque département à une région connue', () => {
    for (const region of Object.values(DEPARTEMENT_REGION)) {
      expect(REGIONS[region]).toBeDefined();
    }
  });

  it('déduit le département du code postal', () => {
    expect(departementDuCodePostal('75001')).toBe('75');
    expect(departementDuCodePostal('95870')).toBe('95');
    expect(departementDuCodePostal('20090')).toBe('2A');
    expect(departementDuCodePostal('20200')).toBe('2B');
    expect(departementDuCodePostal('97400')).toBe('974');
    expect(departementDuCodePostal('97600')).toBe('976');
    expect(departementDuCodePostal('98000')).toBeNull();
    expect(departementDuCodePostal('7500')).toBeNull();
    expect(departementDuCodePostal(null)).toBeNull();
  });

  it('déduit la région du département', () => {
    expect(regionDuDepartement('95')).toBe('11');
    expect(regionDuDepartement('2a')).toBe('94');
    expect(regionDuDepartement('974')).toBe('04');
    expect(regionDuDepartement('99')).toBeNull();
  });

  it('reconnaît les codes région INSEE', () => {
    expect(estCodeRegion('11')).toBe(true);
    expect(estCodeRegion('06')).toBe(true);
    expect(estCodeRegion('99')).toBe(false);
    expect(estCodeRegion(null)).toBe(false);
  });

  it('ordonne les régions : métropole puis outre-mer', () => {
    expect(REGIONS_TRIEES[0]).toEqual({ code: '84', nom: 'Auvergne-Rhône-Alpes' });
    expect(REGIONS_TRIEES[13].code).toBe('01');
    expect(REGIONS_TRIEES[17].code).toBe('06');
  });
});
