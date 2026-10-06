import { describe, it, expect } from 'vitest';
import {
  normaliserIdcc,
  resoudreOpco,
  suggestionParNaf,
  titreConvention,
  type IdccTable,
  type SuggestionNaf,
} from '../src/opco-resolver';
import { IdccTableSchema, SuggestionNafSchema } from '../src/schema';
import { EMBEDDED_IDCC, EMBEDDED_NAF } from '../src/data';

// Table fictive (codes inventes sauf 1516/1486/3248) : seule la logique est testee ici.
const TABLE: IdccTable = {
  '1516': { idcc: '1516', titre: 'Organismes de formation', opco: 'akto', statut: 'actif', source: 'https://x.fr' },
  '1486': { idcc: '1486', titre: 'Bureaux d\'etudes techniques', opco: 'atlas', statut: 'actif', source: 'https://x.fr' },
  '3248': { idcc: '3248', titre: 'Metallurgie', opco: 'opco2i', statut: 'actif', source: 'https://x.fr' },
  '8001': { idcc: '8001', titre: 'Ancienne convention fusionnee', opco: 'opco2i', statut: 'fusionne', idcc_cible: '3248', source: 'https://x.fr' },
  '7777': {
    idcc: '7777', titre: 'Convention partagee', opco: null, statut: 'partage',
    opcos_possibles: ['ocapiat', 'akto'], note: 'Selon le secteur d\'activite', source: 'https://x.fr',
  },
  '9999': { idcc: '9999', titre: 'Absence de convention collective', opco: null, statut: 'echappatoire', source: 'https://x.fr' },
};
const NAF: SuggestionNaf[] = [
  { prefixe: '85.59', opco: 'akto', part: 0.8, libelle: 'Autres enseignements', source: 'test' },
  { prefixe: '47', opco: 'opcommerce', part: null, libelle: 'Commerce de detail', source: 'test' },
  { prefixe: '47.11F', opco: 'opcommerce', part: 0.9, libelle: 'Hypermarches', source: 'test' },
];

describe('normaliserIdcc', () => {
  it('complete a 4 chiffres et ignore les valeurs invalides', () => {
    expect(normaliserIdcc('2')).toBe('0002');
    expect(normaliserIdcc(' 1516 ')).toBe('1516');
    expect(normaliserIdcc('0000')).toBeNull();
    expect(normaliserIdcc('abc')).toBeNull();
  });
});

describe('resoudreOpco', () => {
  it('un IDCC connu → OPCO fiable', () => {
    const r = resoudreOpco({ idccs: ['1516'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'fiable', idccRetenu: '1516' });
    expect(r.motif).toContain('IDCC 1516');
    expect(r.urlVerificationOfficielle).toContain('francecompetences');
  });

  it('plusieurs IDCC du meme OPCO → fiable', () => {
    const r = resoudreOpco({ idccs: ['3248', '8001'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'opco2i', certitude: 'fiable' });
  });

  it('IDCC d\'OPCO differents → a confirmer, preselection du siege', () => {
    const r = resoudreOpco({ idccs: ['1516', '1486'], idccSiege: ['1486'] }, TABLE);
    expect(r.certitude).toBe('a_confirmer');
    expect(r.opcoSlug).toBe('atlas');
    expect(r.idccRetenu).toBe('1486');
    expect(r.candidats.map((c) => c.opcoSlug).sort()).toEqual(['akto', 'atlas']);
  });

  it('IDCC fusionne → redige avec avertissement', () => {
    const r = resoudreOpco({ idccs: ['8001'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'opco2i', certitude: 'fiable', idccRetenu: '3248' });
    expect(r.avertissements.some((a) => a.includes('fusionnee'))).toBe(true);
  });

  it('IDCC partage → plusieurs candidats a confirmer', () => {
    const r = resoudreOpco({ idccs: ['7777'] }, TABLE);
    expect(r.certitude).toBe('a_confirmer');
    expect(r.candidats).toHaveLength(2);
  });

  it('code echappatoire + NAF → suggestion a confirmer', () => {
    const r = resoudreOpco({ idccs: ['9999'], codeNaf: '85.59A' }, TABLE, NAF);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer', idccRetenu: null });
    expect(r.motif).toContain('80 %');
    expect(r.avertissements.some((a) => a.includes('9999'))).toBe(true);
  });

  it('rien d\'exploitable → inconnu', () => {
    const r = resoudreOpco({ idccs: ['4242'] }, TABLE);
    expect(r.certitude).toBe('inconnu');
    expect(r.opcoSlug).toBeNull();
    expect(r.avertissements.some((a) => a.includes('4242'))).toBe(true);
  });
});

describe('suggestionParNaf', () => {
  it('retient la suggestion la plus precise', () => {
    expect(suggestionParNaf('47.11F', NAF)?.prefixe).toBe('47.11F');
    expect(suggestionParNaf('47.19B', NAF)?.prefixe).toBe('47');
    expect(suggestionParNaf('01.11Z', NAF)).toBeNull();
    expect(suggestionParNaf(null, NAF)).toBeNull();
  });
});

describe('titreConvention', () => {
  it('renvoie le titre officiel ou un libelle generique', () => {
    expect(titreConvention('1516', TABLE)).toBe('Organismes de formation');
    expect(titreConvention('4242', TABLE)).toBe('Convention IDCC 4242');
  });
});

describe('donnees IDCC embarquees', () => {
  it('respectent le schema et contiennent les codes echappatoires', () => {
    expect(IdccTableSchema.safeParse(EMBEDDED_IDCC).success).toBe(true);
    for (const code of ['5501', '5100', '9998', '9999']) {
      expect(EMBEDDED_IDCC[code]?.statut).toBe('echappatoire');
    }
    for (const s of EMBEDDED_NAF) expect(SuggestionNafSchema.safeParse(s).success).toBe(true);
  });
});
