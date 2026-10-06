import { describe, it, expect } from 'vitest';
import {
  normaliserIdcc,
  resolveIdccToOpco,
  resoudreOpco,
  suggestionParNaf,
  titreConvention,
  type IdccTable,
  type SuggestionNaf,
} from '../src/opco-resolver';
import { IdccTableSchema, SuggestionNafSchema } from '../src/schema';
import { EMBEDDED_IDCC, EMBEDDED_NAF } from '../src/data';

// Table fictive (codes inventés sauf 1516/1486/3248) : seule la logique est testée ici.
const TABLE: IdccTable = {
  '1516': { idcc: '1516', titre: 'Organismes de formation', opco: 'akto', statut: 'actif', source: 'https://x.fr' },
  '1486': { idcc: '1486', titre: "Bureaux d'études techniques", opco: 'atlas', statut: 'actif', source: 'https://x.fr' },
  '3248': { idcc: '3248', titre: 'Métallurgie', opco: 'opco2i', statut: 'actif', source: 'https://x.fr' },
  '8001': { idcc: '8001', titre: 'Ancienne convention fusionnée', opco: 'opco2i', statut: 'fusionne', idcc_cible: '3248', source: 'https://x.fr' },
  '8002': { idcc: '8002', titre: 'Convention fictive B', opco: 'akto', statut: 'actif', source: 'https://x.fr' },
  // Fusion vers un IDCC (8999) qui ne figure pas dans la table.
  '8003': { idcc: '8003', titre: 'Convention fusionnée vers un code absent', opco: 'atlas', statut: 'fusionne', idcc_cible: '8999', source: 'https://x.fr' },
  '7777': {
    idcc: '7777', titre: 'Convention partagée', opco: null, statut: 'partage',
    opcos_possibles: ['ocapiat', 'akto'], note: "Selon le secteur d'activité", source: 'https://x.fr',
  },
  '7778': {
    idcc: '7778', titre: 'Convention partagée sans note', opco: null, statut: 'partage',
    opcos_possibles: ['ocapiat', 'akto'], source: 'https://x.fr',
  },
  '9999': { idcc: '9999', titre: 'Absence de convention collective', opco: null, statut: 'echappatoire', source: 'https://x.fr' },
};
const NAF: SuggestionNaf[] = [
  { prefixe: '85.59', opco: 'akto', part: 0.8, libelle: 'Autres enseignements', source: 'test' },
  { prefixe: '47', opco: 'opcommerce', part: null, libelle: 'Commerce de détail', source: 'test' },
  { prefixe: '47.11F', opco: 'opcommerce', part: 0.9, libelle: 'Hypermarchés', source: 'test' },
];

// Début du motif quand plusieurs OPCO restent possibles (la phrase de présélection éventuelle s'y ajoute).
const MOTIF_PLUSIEURS_OPCO =
  'Plusieurs OPCO possibles selon les conventions collectives déclarées. Une entreprise relève en principe ' +
  "d'une seule convention, déterminée par son activité principale (sauf établissement autonome) : choisissez " +
  "celle de l'établissement du salarié concerné.";

describe('normaliserIdcc', () => {
  it('complète à 4 chiffres et ignore les valeurs invalides', () => {
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

  it('plusieurs IDCC du même OPCO → fiable', () => {
    const r = resoudreOpco({ idccs: ['3248', '8001'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'opco2i', certitude: 'fiable' });
  });

  it("une convention inconnue à côté d'une convention connue → à confirmer", () => {
    const r = resoudreOpco({ idccs: ['1516', '4242'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer', idccRetenu: '1516' });
    expect(r.candidats).toHaveLength(1);
    expect(r.motif).toBe(
      "Identifié via la convention collective IDCC 1516 (Organismes de formation) ; la convention IDCC 4242 ne figure pas dans notre table : vérifiez qu'elle ne désigne pas un autre OPCO.",
    );
    expect(r.avertissements.some((a) => a.includes('4242'))).toBe(true);
  });

  it("plusieurs conventions inconnues à côté d'une convention connue → motif au pluriel", () => {
    const r = resoudreOpco({ idccs: ['1516', '4242', '4243'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer' });
    expect(r.motif).toBe(
      "Identifié via la convention collective IDCC 1516 (Organismes de formation) ; les conventions IDCC 4242, 4243 ne figurent pas dans notre table : vérifiez qu'elles ne désignent pas un autre OPCO.",
    );
  });

  it("un code échappatoire à côté d'une convention connue reste fiable", () => {
    const r = resoudreOpco({ idccs: ['1516', '9999'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'fiable' });
    expect(r.motif).toBe('Identifié via la convention collective IDCC 1516 (Organismes de formation).');
  });

  it("un seul OPCO → IDCC retenu : celui du siège s'il en fait partie, sinon le premier", () => {
    const duSiege = resoudreOpco({ idccs: ['1516', '8002'], idccSiege: ['8002'] }, TABLE);
    expect(duSiege).toMatchObject({ opcoSlug: 'akto', certitude: 'fiable', idccRetenu: '8002' });
    // IDCC du siège étranger aux conventions du candidat : on retient la première convention.
    const horsCandidat = resoudreOpco({ idccs: ['1516', '8002'], idccSiege: ['3248'] }, TABLE);
    expect(horsCandidat).toMatchObject({ opcoSlug: 'akto', certitude: 'fiable', idccRetenu: '1516' });
  });

  it("IDCC d'OPCO différents → à confirmer, présélection du siège", () => {
    const r = resoudreOpco({ idccs: ['1516', '1486'], idccSiege: ['1486'] }, TABLE);
    expect(r.certitude).toBe('a_confirmer');
    expect(r.opcoSlug).toBe('atlas');
    expect(r.idccRetenu).toBe('1486');
    expect(r.candidats.map((c) => c.opcoSlug).sort()).toEqual(['akto', 'atlas']);
    expect(r.motif).toBe(`${MOTIF_PLUSIEURS_OPCO} Présélection : convention du siège.`);
  });

  it("IDCC d'OPCO différents sans siège → présélection d'après le code NAF", () => {
    // akto (désigné par le NAF) n'est pas le premier candidat : la présélection n'est pas arbitraire.
    const r = resoudreOpco({ idccs: ['1486', '1516'], codeNaf: '85.59A' }, TABLE, NAF);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer', idccRetenu: '1516' });
    expect(r.candidats.map((c) => c.opcoSlug)).toEqual(['atlas', 'akto']);
    expect(r.motif).toBe(
      `${MOTIF_PLUSIEURS_OPCO} Présélection d'après le code NAF 85.59 (Autres enseignements), à confirmer.`,
    );
  });

  it("IDCC d'OPCO différents sans siège ni NAF exploitable → aucune présélection", () => {
    const r = resoudreOpco({ idccs: ['1516', '1486'] }, TABLE, NAF);
    expect(r).toMatchObject({ opcoSlug: null, certitude: 'a_confirmer', idccRetenu: null });
    expect(r.candidats.map((c) => c.opcoSlug).sort()).toEqual(['akto', 'atlas']);
    expect(r.motif).toBe(MOTIF_PLUSIEURS_OPCO);
  });

  it('IDCC du siège rattachés à plusieurs candidats → pas de présélection par le siège', () => {
    const r = resoudreOpco({ idccs: ['1516', '1486'], idccSiege: ['1516', '1486'] }, TABLE, NAF);
    expect(r).toMatchObject({ opcoSlug: null, certitude: 'a_confirmer', idccRetenu: null });
    expect(r.motif).toBe(MOTIF_PLUSIEURS_OPCO);
  });

  it('le siège est prioritaire sur le code NAF', () => {
    const r = resoudreOpco({ idccs: ['1516', '1486'], idccSiege: ['1486'], codeNaf: '85.59A' }, TABLE, NAF);
    expect(r.opcoSlug).toBe('atlas');
    expect(r.motif).toBe(`${MOTIF_PLUSIEURS_OPCO} Présélection : convention du siège.`);
  });

  it("suggestion NAF d'un OPCO étranger aux candidats → aucune présélection", () => {
    // 47.11F → opcommerce, qui ne figure pas parmi les candidats (akto, atlas).
    const r = resoudreOpco({ idccs: ['1516', '1486'], codeNaf: '47.11F' }, TABLE, NAF);
    expect(r).toMatchObject({ opcoSlug: null, certitude: 'a_confirmer', idccRetenu: null });
    expect(r.motif).toBe(MOTIF_PLUSIEURS_OPCO);
  });

  it("convention partagée + convention d'un seul OPCO : le siège sur cette dernière présélectionne son OPCO", () => {
    // Candidats : ocapiat [7777] et akto [7777, 1516] ; seul akto contient l'IDCC du siège (1516).
    const r = resoudreOpco({ idccs: ['7777', '1516'], idccSiege: ['1516'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer', idccRetenu: '1516' });
    expect(r.motif).toBe(`${MOTIF_PLUSIEURS_OPCO} Présélection : convention du siège.`);
  });

  it('IDCC fusionné → redirigé avec avertissement', () => {
    const r = resoudreOpco({ idccs: ['8001'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'opco2i', certitude: 'fiable', idccRetenu: '3248' });
    expect(r.avertissements.some((a) => a.includes("rattachement à l'IDCC 3248"))).toBe(true);
  });

  it("IDCC fusionné vers un IDCC absent de la table → pas de redirection, OPCO de l'ancienne convention", () => {
    const r = resoudreOpco({ idccs: ['8003'] }, TABLE);
    expect(r.opcoSlug).toBe('atlas');
    expect(r.idccRetenu).toBe('8003');
    expect(r.candidats).toEqual([{ opcoSlug: 'atlas', idccs: [{ idcc: '8003', titre: 'Convention fusionnée vers un code absent' }] }]);
    expect(r.avertissements).toContain(
      "IDCC 8003 (Convention fusionnée vers un code absent) : convention fusionnée dans l'IDCC 8999, absent de notre table ; rattachement d'après l'ancienne convention.",
    );
    // Aucun avertissement de redirection vers l'IDCC 8999 ni de « non référencé ».
    expect(r.avertissements).toHaveLength(1);
  });

  it('IDCC fusionné répété → un seul avertissement de fusion', () => {
    const r = resoudreOpco({ idccs: ['8001', '8001', ' 8001 '] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'opco2i', certitude: 'fiable', idccRetenu: '3248' });
    expect(r.avertissements.filter((a) => a.includes("rattachement à l'IDCC 3248"))).toHaveLength(1);
  });

  it('IDCC fusionné déclaré avec sa convention cible → une seule convention retenue', () => {
    const r = resoudreOpco({ idccs: ['8001', '3248'] }, TABLE);
    expect(r.candidats).toEqual([{ opcoSlug: 'opco2i', idccs: [{ idcc: '3248', titre: 'Métallurgie' }] }]);
    expect(r.avertissements.filter((a) => a.includes("rattachement à l'IDCC 3248"))).toHaveLength(1);
  });

  it('IDCC partagé → plusieurs candidats à confirmer', () => {
    const r = resoudreOpco({ idccs: ['7777'] }, TABLE);
    expect(r.certitude).toBe('a_confirmer');
    expect(r.candidats).toHaveLength(2);
    // Convention partagée seule, sans code NAF : aucune présélection.
    expect(r.opcoSlug).toBeNull();
    expect(r.idccRetenu).toBeNull();
    expect(r.motif).toBe(
      "La convention collective IDCC 7777 (Convention partagée) relève de plusieurs OPCO : Selon le secteur d'activité. Choisissez l'OPCO correspondant à votre activité.",
    );
  });

  it("IDCC partagé seul + code NAF d'un des OPCO → présélection d'après le code NAF", () => {
    const r = resoudreOpco({ idccs: ['7777'], codeNaf: '85.59A' }, TABLE, NAF);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer', idccRetenu: '7777' });
    expect(r.motif).toBe(
      "La convention collective IDCC 7777 (Convention partagée) relève de plusieurs OPCO : Selon le secteur d'activité. Choisissez l'OPCO correspondant à votre activité. Présélection d'après le code NAF 85.59 (Autres enseignements), à confirmer.",
    );
  });

  it("IDCC partagé seul : le siège n'apporte rien (tous les candidats ont le même IDCC)", () => {
    const r = resoudreOpco({ idccs: ['7777'], idccSiege: ['7777'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: null, certitude: 'a_confirmer', idccRetenu: null });
    expect(r.motif).not.toContain('Présélection');
  });

  it("IDCC partagé sans note → motif avec l'activité principale de l'entreprise", () => {
    const r = resoudreOpco({ idccs: ['7778'] }, TABLE);
    expect(r.opcoSlug).toBeNull();
    expect(r.motif).toBe(
      "La convention collective IDCC 7778 (Convention partagée sans note) relève de plusieurs OPCO : selon l'activité principale de l'entreprise. Choisissez l'OPCO correspondant à votre activité.",
    );
  });

  it('code échappatoire + NAF → suggestion à confirmer', () => {
    const r = resoudreOpco({ idccs: ['9999'], codeNaf: '85.59A' }, TABLE, NAF);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer', idccRetenu: null });
    expect(r.motif).toContain('80 %');
    expect(r.avertissements.some((a) => a.includes('9999'))).toBe(true);
  });

  it("rien d'exploitable → inconnu", () => {
    const r = resoudreOpco({ idccs: ['4242'] }, TABLE);
    expect(r.certitude).toBe('inconnu');
    expect(r.opcoSlug).toBeNull();
    expect(r.avertissements.some((a) => a.includes('4242'))).toBe(true);
  });
});

describe('suggestionParNaf', () => {
  it('retient la suggestion la plus précise', () => {
    expect(suggestionParNaf('47.11F', NAF)?.prefixe).toBe('47.11F');
    expect(suggestionParNaf('47.19B', NAF)?.prefixe).toBe('47');
    expect(suggestionParNaf('01.11Z', NAF)).toBeNull();
    expect(suggestionParNaf(null, NAF)).toBeNull();
  });

  it('accepte un code NAF sans point (4711F → 47.11F)', () => {
    expect(suggestionParNaf('4711F', NAF)?.prefixe).toBe('47.11F');
    expect(suggestionParNaf(' 4711f ', NAF)?.prefixe).toBe('47.11F');
    expect(suggestionParNaf('8559A', NAF)?.prefixe).toBe('85.59');
    expect(suggestionParNaf('4719B', NAF)?.prefixe).toBe('47');
    expect(suggestionParNaf('0111Z', NAF)).toBeNull();
  });
});

describe('titreConvention', () => {
  it('renvoie le titre officiel ou un libellé générique', () => {
    expect(titreConvention('1516', TABLE)).toBe('Organismes de formation');
    expect(titreConvention('4242', TABLE)).toBe('Convention IDCC 4242');
  });

  it('le libellé générique utilise le code normalisé sur 4 chiffres', () => {
    expect(titreConvention('42', TABLE)).toBe('Convention IDCC 0042');
    expect(titreConvention(' 42 ', TABLE)).toBe('Convention IDCC 0042');
    // Valeur non numérique : reprise telle quelle, sans espaces superflus.
    expect(titreConvention(' abc ', TABLE)).toBe('Convention IDCC abc');
  });
});

describe('données IDCC embarquées', () => {
  it('respectent le schéma et contiennent les codes échappatoires', () => {
    expect(IdccTableSchema.safeParse(EMBEDDED_IDCC).success).toBe(true);
    for (const code of ['5501', '5100', '9998', '9999']) {
      expect(EMBEDDED_IDCC[code]?.statut).toBe('echappatoire');
    }
    for (const s of EMBEDDED_NAF) expect(SuggestionNafSchema.safeParse(s).success).toBe(true);
  });
});

// resolveIdccToOpco est conservée pour l'app mobile (StepIdentification) : elle lit la table embarquée.
describe('resolveIdccToOpco (app mobile)', () => {
  it('rattache un IDCC connu à son OPCO', () => {
    expect(resolveIdccToOpco(['1516'])[0]?.opcoSlug).toBe('akto');
  });

  it('normalise les codes courts : 44 donne le même résultat que 0044', () => {
    const court = resolveIdccToOpco(['44']);
    expect(court).toHaveLength(1);
    expect(court).toEqual(resolveIdccToOpco(['0044']));
    expect(court[0]?.idcc).toBe('0044');
  });

  it('ignore les codes échappatoires (aucun OPCO)', () => {
    expect(resolveIdccToOpco(['9999', '5501', '5100', '9998'])).toEqual([]);
  });

  it("ne renvoie qu'un résultat pour deux conventions du même OPCO", () => {
    // 1516 (organismes de formation) et 1979 (hôtels, cafés, restaurants) relèvent d'AKTO dans la table embarquée.
    expect(resolveIdccToOpco(['1516', '1979'])).toHaveLength(1);
  });

  it('ignore les valeurs invalides', () => {
    expect(resolveIdccToOpco(['abc', '0000', '12345', ''])).toEqual([]);
  });
});
