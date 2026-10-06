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
import { IdccEntreeSchema, IdccTableSchema, SuggestionNafSchema } from '../src/schema';
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
  // Convention connue de la table, mais dont aucune source ne confirme l'OPCO.
  '8004': { idcc: '8004', titre: 'Convention fictive sans OPCO', opco: null, statut: 'actif', note: 'OPCO non confirmé.', source: 'https://x.fr' },
  // Fusionnée ou close, sans convention de rattachement connue : l'OPCO est celui de l'ancienne convention.
  '8005': { idcc: '8005', titre: 'Convention fusionnée sans cible', opco: 'atlas', statut: 'fusionne', source: 'https://x.fr' },
  // Fusionnée ou close, sans convention de rattachement ni OPCO.
  '8006': { idcc: '8006', titre: 'Convention close sans OPCO', opco: null, statut: 'fusionne', source: 'https://x.fr' },
  // Conventions en vigueur dont l'OPCO n'est établi par aucune source officielle propre à cet IDCC (a_confirmer).
  '8007': {
    idcc: '8007', titre: 'Convention fictive à confirmer', opco: 'akto', statut: 'actif', a_confirmer: true,
    note: "À confirmer : repris de l'ancienne table.", source: 'https://x.fr',
  },
  '8008': {
    idcc: '8008', titre: 'Seconde convention fictive à confirmer', opco: 'akto', statut: 'actif', a_confirmer: true,
    note: "À confirmer : repris de l'ancienne table.", source: 'https://x.fr',
  },
  // Fusionnée vers une convention marquée à confirmer : la cible fait foi, donc elle n'est pas ferme non plus.
  '8009': {
    idcc: '8009', titre: 'Convention fusionnée vers une convention à confirmer', opco: 'akto', statut: 'fusionne',
    idcc_cible: '8007', source: 'https://x.fr',
  },
  // Fusionnée vers une convention connue mais sans OPCO (8004) : son propre OPCO n'est pas utilisé.
  '8010': {
    idcc: '8010', titre: 'Convention fusionnée vers une convention sans OPCO', opco: 'akto', statut: 'fusionne',
    idcc_cible: '8004', source: 'https://x.fr',
  },
  // Fusionnée ou close sans convention de rattachement, du même OPCO que les conventions marquées (akto).
  '8011': { idcc: '8011', titre: 'Convention fusionnée sans cible AKTO', opco: 'akto', statut: 'fusionne', source: 'https://x.fr' },
  '7777': {
    idcc: '7777', titre: 'Convention partagée', opco: null, statut: 'partage',
    opcos_possibles: ['ocapiat', 'akto'], note: "Selon le secteur d'activité", source: 'https://x.fr',
  },
  '7778': {
    idcc: '7778', titre: 'Convention partagée sans note', opco: null, statut: 'partage',
    opcos_possibles: ['ocapiat', 'akto'], source: 'https://x.fr',
  },
  // Note longue qui se termine par un point (comme les notes des conventions partagées de la table embarquée).
  '7779': {
    idcc: '7779', titre: 'Convention partagée à note longue', opco: null, statut: 'partage',
    opcos_possibles: ['ocapiat', 'akto'],
    note: "Champ partagé selon l'activité principale de l'entreprise : exploitation du bois → AKTO ; sylviculture → OCAPIAT.",
    source: 'https://x.fr',
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
      "Identifié via la convention collective IDCC 1516 (Organismes de formation) ; la convention IDCC 4242 n'a pas pu être rattachée à un OPCO : vérifiez qu'elle ne désigne pas un autre OPCO.",
    );
    expect(r.avertissements).toContain('IDCC non référencé(s) dans notre table : 4242.');
  });

  it("plusieurs conventions inconnues à côté d'une convention connue → motif au pluriel", () => {
    const r = resoudreOpco({ idccs: ['1516', '4242', '4243'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer' });
    expect(r.motif).toBe(
      "Identifié via la convention collective IDCC 1516 (Organismes de formation) ; les conventions IDCC 4242, 4243 n'ont pas pu être rattachées à un OPCO : vérifiez qu'elles ne désignent pas un autre OPCO.",
    );
    expect(r.avertissements).toContain('IDCC non référencé(s) dans notre table : 4242, 4243.');
  });

  // --- Convention connue de la table mais sans OPCO confirmé (≠ convention absente de la table) ---

  it('convention connue sans OPCO confirmé, seule → inconnu, avertissement dédié et pas « non référencé »', () => {
    const r = resoudreOpco({ idccs: ['8004'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: null, certitude: 'inconnu', idccRetenu: null, candidats: [] });
    expect(r.avertissements).toContain(
      'IDCC 8004 (Convention fictive sans OPCO) : aucun OPCO confirmé par une source officielle pour cette convention.',
    );
    // Elle figure dans la table : elle ne doit pas être comptée parmi les conventions non référencées.
    expect(r.avertissements.some((a) => a.includes('non référencé'))).toBe(false);
  });

  it("convention connue sans OPCO confirmé à côté d'une convention connue → à confirmer", () => {
    const r = resoudreOpco({ idccs: ['1516', '8004'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer', idccRetenu: '1516' });
    expect(r.candidats).toHaveLength(1);
    expect(r.motif).toBe(
      "Identifié via la convention collective IDCC 1516 (Organismes de formation) ; la convention IDCC 8004 n'a pas pu être rattachée à un OPCO : vérifiez qu'elle ne désigne pas un autre OPCO.",
    );
    expect(r.avertissements).toContain(
      'IDCC 8004 (Convention fictive sans OPCO) : aucun OPCO confirmé par une source officielle pour cette convention.',
    );
    expect(r.avertissements.some((a) => a.includes('non référencé'))).toBe(false);
  });

  it('conventions absentes de la table et sans OPCO confirmé : deux avertissements distincts, un seul motif', () => {
    const r = resoudreOpco({ idccs: ['1516', '8004', '4242'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer', idccRetenu: '1516' });
    // Les deux listes sont réunies, dans l'ordre des conventions déclarées.
    expect(r.motif).toBe(
      "Identifié via la convention collective IDCC 1516 (Organismes de formation) ; les conventions IDCC 8004, 4242 n'ont pas pu être rattachées à un OPCO : vérifiez qu'elles ne désignent pas un autre OPCO.",
    );
    expect(r.avertissements).toContain('IDCC non référencé(s) dans notre table : 4242.');
    expect(r.avertissements).toContain(
      'IDCC 8004 (Convention fictive sans OPCO) : aucun OPCO confirmé par une source officielle pour cette convention.',
    );
  });

  it('convention connue sans OPCO confirmé + code NAF → suggestion NAF à confirmer (repli inchangé)', () => {
    const r = resoudreOpco({ idccs: ['8004'], codeNaf: '85.59A' }, TABLE, NAF);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer', idccRetenu: null });
    expect(r.motif).toBe(
      "Aucune convention collective exploitable. Suggestion d'après le code NAF 85.59 (Autres enseignements) : 80 % des établissements de ce secteur relèvent de cet OPCO. À confirmer.",
    );
    expect(r.avertissements.some((a) => a.includes('aucun OPCO confirmé'))).toBe(true);
    expect(r.avertissements.some((a) => a.includes('non référencé'))).toBe(false);
  });

  it('convention fusionnée ou close sans cible ni OPCO → traitée comme une convention sans OPCO confirmé', () => {
    const r = resoudreOpco({ idccs: ['8006'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: null, certitude: 'inconnu', idccRetenu: null, candidats: [] });
    expect(r.avertissements).toEqual([
      'IDCC 8006 (Convention close sans OPCO) : aucun OPCO confirmé par une source officielle pour cette convention.',
    ]);
  });

  it("convention fusionnée dont la cible existe mais n'a aucun OPCO → inconnu : l'OPCO propre de la fusionnée est ignoré", () => {
    // 8010 porte son propre OPCO (akto) mais est fusionnée vers 8004, connue sans OPCO confirmé : la cible fait foi.
    const r = resoudreOpco({ idccs: ['8010'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: null, certitude: 'inconnu', idccRetenu: null, candidats: [] });
    expect(r.avertissements).toEqual([
      "IDCC 8010 (Convention fusionnée vers une convention sans OPCO) : convention fusionnée, rattachement à l'IDCC 8004.",
      'IDCC 8004 (Convention fictive sans OPCO) : aucun OPCO confirmé par une source officielle pour cette convention.',
    ]);
  });

  it('convention ferme + fusionnée sans cible du même OPCO + convention inconnue → à confirmer, avec la vérification des conventions inconnues', () => {
    // 1486 : convention ferme (atlas) ; 8003 : fusionnée vers un code absent (atlas) ; 4242 : absente de la table.
    const r = resoudreOpco({ idccs: ['1486', '8003', '4242'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'atlas', certitude: 'a_confirmer', idccRetenu: '1486' });
    expect(r.candidats).toHaveLength(1);
    expect(r.motif).toBe(
      "Identifié via la convention collective IDCC 1486 (Bureaux d'études techniques), IDCC 8003 (Convention fusionnée vers un code absent) ; la convention IDCC 4242 n'a pas pu être rattachée à un OPCO : vérifiez qu'elle ne désigne pas un autre OPCO.",
    );
    expect(r.avertissements).toContain('IDCC non référencé(s) dans notre table : 4242.');
    expect(r.avertissements).toContain(
      "IDCC 8003 (Convention fusionnée vers un code absent) : convention fusionnée dans l'IDCC 8999, absent de notre table ; rattachement d'après l'ancienne convention.",
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

  it("un seul OPCO → IDCC retenu : à défaut du siège, une convention ferme plutôt qu'une convention close", () => {
    // 8003 : fusionnée vers un code absent de la table (convention close), déclarée avant 1486 (convention en vigueur).
    const r = resoudreOpco({ idccs: ['8003', '1486'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'atlas', certitude: 'fiable' });
    expect(r.idccRetenu).toBe('1486');
  });

  it("un seul OPCO → IDCC retenu : une convention marquée à confirmer n'est pas ferme ; le siège reste prioritaire", () => {
    // 8007 (marquée à confirmer) est déclarée avant 1516 (convention ferme du même OPCO).
    expect(resoudreOpco({ idccs: ['8007', '1516'] }, TABLE).idccRetenu).toBe('1516');
    // Le siège prime, même quand son IDCC est une convention close ou marquée.
    expect(resoudreOpco({ idccs: ['8003', '1486'], idccSiege: ['8003'] }, TABLE).idccRetenu).toBe('8003');
    expect(resoudreOpco({ idccs: ['8007', '1516'], idccSiege: ['8007'] }, TABLE).idccRetenu).toBe('8007');
    // Aucune convention ferme : la première convention du candidat.
    expect(resoudreOpco({ idccs: ['8011', '8007'] }, TABLE).idccRetenu).toBe('8011');
    expect(resoudreOpco({ idccs: ['8003', '8005'] }, TABLE).idccRetenu).toBe('8003');
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

  it("IDCC fusionné vers un IDCC absent de la table → pas de redirection, OPCO de l'ancienne convention, à confirmer", () => {
    const r = resoudreOpco({ idccs: ['8003'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'atlas', certitude: 'a_confirmer', idccRetenu: '8003' });
    expect(r.motif).toBe(
      "Rattachement d'après l'ancienne convention IDCC 8003 (Convention fusionnée vers un code absent), fusionnée ou close : à confirmer.",
    );
    expect(r.candidats).toEqual([{ opcoSlug: 'atlas', idccs: [{ idcc: '8003', titre: 'Convention fusionnée vers un code absent' }] }]);
    expect(r.avertissements).toContain(
      "IDCC 8003 (Convention fusionnée vers un code absent) : convention fusionnée dans l'IDCC 8999, absent de notre table ; rattachement d'après l'ancienne convention.",
    );
    // Aucun avertissement de redirection vers l'IDCC 8999 ni de « non référencé ».
    expect(r.avertissements).toHaveLength(1);
  });

  it("IDCC fusionné sans convention cible → OPCO de l'ancienne convention, à confirmer", () => {
    const r = resoudreOpco({ idccs: ['8005'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'atlas', certitude: 'a_confirmer', idccRetenu: '8005' });
    expect(r.motif).toBe(
      "Rattachement d'après l'ancienne convention IDCC 8005 (Convention fusionnée sans cible), fusionnée ou close : à confirmer.",
    );
    expect(r.candidats).toEqual([{ opcoSlug: 'atlas', idccs: [{ idcc: '8005', titre: 'Convention fusionnée sans cible' }] }]);
  });

  it('IDCC fusionné sans cible + convention actuelle du même OPCO → la certitude suit les autres règles (fiable)', () => {
    // 1486 est une convention en vigueur (atlas) : le candidat ne repose plus uniquement sur une convention fusionnée.
    const r = resoudreOpco({ idccs: ['8003', '1486'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'atlas', certitude: 'fiable' });
    expect(r.candidats).toHaveLength(1);
    expect(r.motif).toBe(
      "Identifié via la convention collective IDCC 8003 (Convention fusionnée vers un code absent), IDCC 1486 (Bureaux d'études techniques).",
    );
  });

  it('plusieurs conventions fusionnées sans cible du même OPCO → motif au pluriel, à confirmer', () => {
    const r = resoudreOpco({ idccs: ['8003', '8005'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'atlas', certitude: 'a_confirmer', idccRetenu: '8003' });
    expect(r.motif).toBe(
      "Rattachement d'après les anciennes conventions IDCC 8003 (Convention fusionnée vers un code absent), IDCC 8005 (Convention fusionnée sans cible), fusionnées ou closes : à confirmer.",
    );
  });

  it('IDCC fusionné sans cible + convention inconnue → les deux réserves figurent dans le motif', () => {
    const r = resoudreOpco({ idccs: ['8005', '4242'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'atlas', certitude: 'a_confirmer', idccRetenu: '8005' });
    expect(r.motif).toBe(
      "Rattachement d'après l'ancienne convention IDCC 8005 (Convention fusionnée sans cible), fusionnée ou close : à confirmer ; la convention IDCC 4242 n'a pas pu être rattachée à un OPCO : vérifiez qu'elle ne désigne pas un autre OPCO.",
    );
  });

  it('IDCC fusionné avec une convention cible présente reste fiable (la cible fait foi)', () => {
    const r = resoudreOpco({ idccs: ['8001'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'opco2i', certitude: 'fiable', idccRetenu: '3248' });
    expect(r.motif).toBe('Identifié via la convention collective IDCC 3248 (Métallurgie).');
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

  // --- Conventions dont l'OPCO n'est établi par aucune source officielle propre à cet IDCC (a_confirmer) ---
  // Le niveau « fiable » exige au moins une convention ferme : en vigueur, avec OPCO, non marquée a_confirmer.

  it('une seule convention marquée à confirmer → à confirmer, OPCO conservé, motif et avertissement dédiés', () => {
    const r = resoudreOpco({ idccs: ['8007'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer' });
    expect(r.candidats).toEqual([{ opcoSlug: 'akto', idccs: [{ idcc: '8007', titre: 'Convention fictive à confirmer' }] }]);
    expect(r.motif).toBe(
      "Rattachement à confirmer : l'OPCO de la convention IDCC 8007 (Convention fictive à confirmer) n'est établi par aucune source officielle propre à cette convention.",
    );
    // La note est reprise sans son point final, qui est remplacé par le nôtre.
    expect(r.avertissements).toEqual(["IDCC 8007 (Convention fictive à confirmer) : À confirmer : repris de l'ancienne table."]);
  });

  it('convention marquée à confirmer + convention ferme du même OPCO → fiable, avertissement de la marquée conservé', () => {
    const r = resoudreOpco({ idccs: ['8007', '1516'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'fiable' });
    expect(r.candidats).toHaveLength(1);
    expect(r.motif).toBe(
      'Identifié via la convention collective IDCC 8007 (Convention fictive à confirmer), IDCC 1516 (Organismes de formation).',
    );
    expect(r.avertissements).toEqual(["IDCC 8007 (Convention fictive à confirmer) : À confirmer : repris de l'ancienne table."]);
  });

  it('convention fusionnée vers une convention marquée à confirmer → à confirmer (la cible fait foi, elle est marquée)', () => {
    const r = resoudreOpco({ idccs: ['8009'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer' });
    expect(r.motif).toBe(
      "Rattachement à confirmer : l'OPCO de la convention IDCC 8007 (Convention fictive à confirmer) n'est établi par aucune source officielle propre à cette convention.",
    );
    expect(r.avertissements).toEqual([
      "IDCC 8009 (Convention fusionnée vers une convention à confirmer) : convention fusionnée, rattachement à l'IDCC 8007.",
      "IDCC 8007 (Convention fictive à confirmer) : À confirmer : repris de l'ancienne table.",
    ]);
  });

  it('plusieurs conventions marquées à confirmer du même OPCO → motif au pluriel, un avertissement par convention', () => {
    const r = resoudreOpco({ idccs: ['8007', '8008'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer' });
    expect(r.candidats).toHaveLength(1);
    expect(r.motif).toBe(
      "Rattachement à confirmer : l'OPCO des conventions IDCC 8007, 8008 n'est établi par aucune source officielle propre à ces conventions.",
    );
    expect(r.avertissements).toEqual([
      "IDCC 8007 (Convention fictive à confirmer) : À confirmer : repris de l'ancienne table.",
      "IDCC 8008 (Seconde convention fictive à confirmer) : À confirmer : repris de l'ancienne table.",
    ]);
  });

  it("convention marquée à confirmer + convention d'un autre OPCO → deux candidats, aucune présélection sans siège ni NAF", () => {
    const r = resoudreOpco({ idccs: ['8007', '1486'] }, TABLE, NAF);
    expect(r).toMatchObject({ opcoSlug: null, certitude: 'a_confirmer', idccRetenu: null });
    expect(r.candidats.map((c) => c.opcoSlug).sort()).toEqual(['akto', 'atlas']);
    // Plusieurs candidats : le motif est inchangé, la convention marquée n'ajoute que son avertissement.
    expect(r.motif).toBe(MOTIF_PLUSIEURS_OPCO);
    expect(r.avertissements).toEqual(["IDCC 8007 (Convention fictive à confirmer) : À confirmer : repris de l'ancienne table."]);
  });

  it("conventions marquées à confirmer et fusionnées sans cible, sans convention ferme → les deux phrases, les marquées d'abord", () => {
    // La convention fusionnée est déclarée la première : la phrase des conventions marquées vient pourtant en tête.
    const r = resoudreOpco({ idccs: ['8011', '8007'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer' });
    expect(r.candidats).toHaveLength(1);
    expect(r.motif).toBe(
      "Rattachement à confirmer : l'OPCO de la convention IDCC 8007 (Convention fictive à confirmer) n'est établi par aucune source officielle propre à cette convention. " +
        "Rattachement d'après l'ancienne convention IDCC 8011 (Convention fusionnée sans cible AKTO), fusionnée ou close : à confirmer.",
    );
  });

  it('convention marquée à confirmer + convention inconnue → la vérification des conventions inconnues suit la phrase du rattachement', () => {
    const r = resoudreOpco({ idccs: ['8007', '4242'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer' });
    expect(r.motif).toBe(
      "Rattachement à confirmer : l'OPCO de la convention IDCC 8007 (Convention fictive à confirmer) n'est établi par aucune source officielle propre à cette convention ; " +
        "la convention IDCC 4242 n'a pas pu être rattachée à un OPCO : vérifiez qu'elle ne désigne pas un autre OPCO.",
    );
  });

  it('IDCC partagé → plusieurs candidats à confirmer', () => {
    const r = resoudreOpco({ idccs: ['7777'] }, TABLE);
    expect(r.certitude).toBe('a_confirmer');
    expect(r.candidats).toHaveLength(2);
    // Convention partagée seule, sans code NAF : aucune présélection.
    expect(r.opcoSlug).toBeNull();
    expect(r.idccRetenu).toBeNull();
    // Motif court : la note de la convention reste dans l'avertissement.
    expect(r.motif).toBe(
      "La convention collective IDCC 7777 (Convention partagée) relève de plusieurs OPCO selon l'activité principale de l'entreprise. Choisissez l'OPCO correspondant à votre activité.",
    );
    expect(r.avertissements).toContain("IDCC 7777 (Convention partagée) : Selon le secteur d'activité.");
  });

  it("IDCC partagé seul + code NAF d'un des OPCO → présélection d'après le code NAF", () => {
    const r = resoudreOpco({ idccs: ['7777'], codeNaf: '85.59A' }, TABLE, NAF);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer', idccRetenu: '7777' });
    expect(r.motif).toBe(
      "La convention collective IDCC 7777 (Convention partagée) relève de plusieurs OPCO selon l'activité principale de l'entreprise. Choisissez l'OPCO correspondant à votre activité. Présélection d'après le code NAF 85.59 (Autres enseignements), à confirmer.",
    );
  });

  it('IDCC partagé à note longue terminée par un point → motif court, avertissement sans point doublé', () => {
    const r = resoudreOpco({ idccs: ['7779'] }, TABLE);
    expect(r.motif).toBe(
      "La convention collective IDCC 7779 (Convention partagée à note longue) relève de plusieurs OPCO selon l'activité principale de l'entreprise. Choisissez l'OPCO correspondant à votre activité.",
    );
    expect(r.motif).not.toContain('..');
    // La note complète reste dans l'avertissement, avec un seul point final.
    expect(r.avertissements).toEqual([
      "IDCC 7779 (Convention partagée à note longue) : Champ partagé selon l'activité principale de l'entreprise : exploitation du bois → AKTO ; sylviculture → OCAPIAT.",
    ]);
    expect(r.avertissements.some((a) => a.includes('..'))).toBe(false);
  });

  // --- Plusieurs candidats et conventions qui n'ont pas pu être rattachées à un OPCO ---

  it('convention partagée + convention absente de la table → motif complété par la vérification', () => {
    const r = resoudreOpco({ idccs: ['7777', '4242'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: null, certitude: 'a_confirmer', idccRetenu: null });
    expect(r.candidats.map((c) => c.opcoSlug).sort()).toEqual(['akto', 'ocapiat']);
    expect(r.motif).toBe(
      "La convention collective IDCC 7777 (Convention partagée) relève de plusieurs OPCO selon l'activité principale de l'entreprise. Choisissez l'OPCO correspondant à votre activité. Par ailleurs, la convention IDCC 4242 n'a pas pu être rattachée à un OPCO : vérifiez qu'elle ne désigne pas un autre OPCO.",
    );
    expect(r.avertissements).toContain('IDCC non référencé(s) dans notre table : 4242.');
  });

  it('conventions de plusieurs OPCO + convention sans OPCO confirmé → vérification avant la présélection du siège', () => {
    const r = resoudreOpco({ idccs: ['1516', '1486', '8004'], idccSiege: ['1486'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: 'atlas', certitude: 'a_confirmer', idccRetenu: '1486' });
    expect(r.motif).toBe(
      `${MOTIF_PLUSIEURS_OPCO} Par ailleurs, la convention IDCC 8004 n'a pas pu être rattachée à un OPCO : vérifiez qu'elle ne désigne pas un autre OPCO. Présélection : convention du siège.`,
    );
    expect(r.avertissements).toContain(
      'IDCC 8004 (Convention fictive sans OPCO) : aucun OPCO confirmé par une source officielle pour cette convention.',
    );
  });

  it("plusieurs conventions inconnues (absentes et sans OPCO) + plusieurs candidats → motif au pluriel, avant la présélection d'après le code NAF", () => {
    const r = resoudreOpco({ idccs: ['1486', '1516', '4242', '8004'], codeNaf: '85.59A' }, TABLE, NAF);
    expect(r).toMatchObject({ opcoSlug: 'akto', certitude: 'a_confirmer', idccRetenu: '1516' });
    expect(r.motif).toBe(
      `${MOTIF_PLUSIEURS_OPCO} Par ailleurs, les conventions IDCC 4242, 8004 n'ont pas pu être rattachées à un OPCO : vérifiez qu'elles ne désignent pas un autre OPCO. Présélection d'après le code NAF 85.59 (Autres enseignements), à confirmer.`,
    );
  });

  it('plusieurs candidats sans convention inconnue → le motif ne contient aucune phrase de vérification', () => {
    const r = resoudreOpco({ idccs: ['1516', '1486'] }, TABLE, NAF);
    expect(r.motif).toBe(MOTIF_PLUSIEURS_OPCO);
    expect(r.motif).not.toContain("n'a pas pu");
    expect(r.motif).not.toContain("n'ont pas pu");
  });

  it("IDCC partagé seul : le siège n'apporte rien (tous les candidats ont le même IDCC)", () => {
    const r = resoudreOpco({ idccs: ['7777'], idccSiege: ['7777'] }, TABLE);
    expect(r).toMatchObject({ opcoSlug: null, certitude: 'a_confirmer', idccRetenu: null });
    expect(r.motif).not.toContain('Présélection');
  });

  it('IDCC partagé sans note → même motif court, avertissement générique', () => {
    const r = resoudreOpco({ idccs: ['7778'] }, TABLE);
    expect(r.opcoSlug).toBeNull();
    expect(r.motif).toBe(
      "La convention collective IDCC 7778 (Convention partagée sans note) relève de plusieurs OPCO selon l'activité principale de l'entreprise. Choisissez l'OPCO correspondant à votre activité.",
    );
    expect(r.avertissements).toEqual([
      "IDCC 7778 (Convention partagée sans note) : convention répartie entre plusieurs OPCO selon l'activité.",
    ]);
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

describe('schémas IDCC et NAF stricts', () => {
  // Une clé mal orthographiée ne doit pas être supprimée en silence : la convention perdrait son rattachement.
  const fusionnee = { idcc: '8001', titre: 'Convention fusionnée', opco: 'opco2i', statut: 'fusionne', idcc_cible: '3248', source: 'https://x.fr' };
  const partagee = {
    idcc: '7777', titre: 'Convention partagée', opco: null, statut: 'partage',
    opcos_possibles: ['ocapiat', 'akto'], note: 'Selon le secteur.', source: 'https://x.fr',
  };
  const aConfirmer = {
    idcc: '8007', titre: 'Convention fictive à confirmer', opco: 'akto', statut: 'actif', a_confirmer: true,
    note: "À confirmer : repris de l'ancienne table.", source: 'https://x.fr',
  };
  const suggestion = { prefixe: '85.59', opco: 'akto', part: 0.8, libelle: 'Autres enseignements', source: 'https://x.fr' };

  it('accepte les entrées complètes (fusion avec cible, partage avec OPCO possibles)', () => {
    expect(IdccEntreeSchema.safeParse(fusionnee).success).toBe(true);
    expect(IdccEntreeSchema.safeParse(partagee).success).toBe(true);
    expect(IdccTableSchema.safeParse({ '8001': fusionnee, '7777': partagee }).success).toBe(true);
    expect(SuggestionNafSchema.safeParse(suggestion).success).toBe(true);
    expect(SuggestionNafSchema.safeParse({ ...suggestion, part: null, effectif_etablissements: null }).success).toBe(true);
  });

  it('accepte le drapeau a_confirmer, booléen seulement', () => {
    expect(IdccEntreeSchema.safeParse(aConfirmer).success).toBe(true);
    expect(IdccEntreeSchema.safeParse({ ...aConfirmer, a_confirmer: false }).success).toBe(true);
    expect(IdccTableSchema.safeParse({ '8007': aConfirmer }).success).toBe(true);
    expect(IdccEntreeSchema.safeParse({ ...aConfirmer, a_confirmer: 'oui' }).success).toBe(false);
  });

  it.each([
    ['idcc_cibel', { ...fusionnee, idcc_cibel: '3248' }],
    ['opcos_possible', { ...partagee, opcos_possible: ['akto'] }],
    ['a_confirme', { ...aConfirmer, a_confirme: true }],
  ])('refuse une clé inconnue dans une entrée IDCC (%s)', (cle, entree) => {
    const r = IdccEntreeSchema.safeParse(entree);
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues).toMatchObject([{ code: 'unrecognized_keys', keys: [cle] }]);
  });

  it('refuse une clé inconnue dans une entrée de la table IDCC', () => {
    const r = IdccTableSchema.safeParse({ '8001': { ...fusionnee, idcc_cibel: '3248' } });
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues).toMatchObject([{ code: 'unrecognized_keys', keys: ['idcc_cibel'], path: ['8001'] }]);
  });

  it('refuse une clé inconnue dans une suggestion NAF', () => {
    const r = SuggestionNafSchema.safeParse({ ...suggestion, effectif_etablissement: 12 });
    expect(r.success).toBe(false);
    expect(r.success ? [] : r.error.issues).toMatchObject([{ code: 'unrecognized_keys', keys: ['effectif_etablissement'] }]);
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

  it('ignore les conventions partagées entre plusieurs OPCO (aucun OPCO ne peut être désigné seul)', () => {
    // 8411 : convention partagée AKTO / OCAPIAT dans la table embarquée.
    expect(EMBEDDED_IDCC['8411']).toMatchObject({ statut: 'partage', opcos_possibles: ['akto', 'ocapiat'] });
    expect(resolveIdccToOpco(['8411'])).toEqual([]);
    // À côté d'une convention d'un seul OPCO, seule celle-ci est retenue.
    expect(resolveIdccToOpco(['8411', '1516']).map((r) => r.opcoSlug)).toEqual(['akto']);
  });
});
