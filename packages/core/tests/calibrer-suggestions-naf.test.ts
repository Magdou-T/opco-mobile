// ============================================================
// Script de calibrage des suggestions d'OPCO par code NAF (scripts/calibrer-suggestions-naf.mjs) : sa partie pure, sans
// réseau. Les observations sont fabriquées ; la dernière série les tire de naf-suggestions.json pour vérifier que
// l'agrégation retrouve exactement la table (préfixes, OPCO, parts, échantillons, exceptions et marges faibles).
// ============================================================

import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  SEUILS,
  SOURCE_TABLE_SIRET_OPCO,
  agregerSuggestions,
  comparerAvecTable,
  empreinte,
  estDansLeDepot,
  generateur,
  hoteAutorise,
  melanger,
  opcoDepuisTable,
  prefixesDe,
} from '../../../scripts/calibrer-suggestions-naf.mjs';
import { EMBEDDED_NAF } from '../src/data';
import { SuggestionNafSchema } from '../src/schema';

interface Observation {
  cadre: string;
  siret: string;
  naf: string;
  opco: string;
}

let numero = 0;
/** `nombre` employeurs distincts d'une sous-classe, tirés dans le cadre `cadre`, qui relèvent de `opco`. */
function employeurs(cadre: string, naf: string, opco: string, nombre: number): Observation[] {
  return Array.from({ length: nombre }, () => ({ cadre, siret: String(++numero).padStart(14, '0'), naf, opco }));
}

const resume = (r: ReturnType<typeof agregerSuggestions>) =>
  r.entrees.map((e) => `${e.prefixe} ${e.opco} ${e.part} ${e.effectif_etablissements}`);

describe('calibrage NAF : seuils de la méthode (30 employeurs, 60 %)', () => {
  it('30 employeurs dont 18 du même OPCO (60 %) : préfixe retenu, part 0,6', () => {
    const r = agregerSuggestions([...employeurs('96.02A', '96.02A', 'opco-ep', 18), ...employeurs('96.02A', '96.02A', 'akto', 12)]);
    expect(resume(r)).toEqual(['96.02A opco-ep 0.6 30']);
  });

  it('17 sur 30 (57 %) : secteur partagé, aucune entrée', () => {
    const r = agregerSuggestions([...employeurs('96.02A', '96.02A', 'opco-ep', 17), ...employeurs('96.02A', '96.02A', 'akto', 13)]);
    expect(r.entrees).toEqual([]);
    expect(r.decisions[0]).toMatchObject({ prefixe: '96.02A', n: 30, opco: 'opco-ep', retenu: false });
    expect(r.decisions[0].motif).toMatch(/^secteur partagé/);
  });

  it('29 employeurs du même OPCO : échantillon trop petit, aucune entrée', () => {
    const r = agregerSuggestions(employeurs('96.02A', '96.02A', 'opco-ep', 29));
    expect(r.entrees).toEqual([]);
    expect(r.decisions[0].motif).toMatch(/^échantillon trop petit/);
  });

  it('les seuils exportés sont ceux de la spécification', () => {
    expect(SEUILS).toMatchObject({ partMinimale: 0.6, echantillonMinimal: 30, sousClasseMinimale: 10, partContradiction: 0.5, margeFaible: 0.7 });
  });
});

describe('calibrage NAF : population servie, cadres, secteurs partagés, redondance', () => {
  it('le parent est mesuré sans la sous-classe retenue à part (exception), qui compte aussi les employeurs du cadre parent', () => {
    const r = agregerSuggestions([
      ...employeurs('10', '10.51C', 'ocapiat', 30),
      ...employeurs('10', '10.71C', 'opco-ep', 5),
      ...employeurs('10.71C', '10.71C', 'opco-ep', 35),
    ]);
    expect(resume(r)).toEqual(['10 ocapiat 1 30', '10.71C opco-ep 1 40']);
    expect(r.exceptions).toEqual([{ prefixe: '10.71C', opco: 'opco-ep', parent: '10', opcoParent: 'ocapiat' }]);
  });

  it("sans entrée propre, une sous-classe qui relève en majorité d'un autre OPCO (10 employeurs au moins) rend le parent partagé", () => {
    const observations = [
      ...employeurs('10', '10.51C', 'ocapiat', 30),
      ...employeurs('10', '10.71C', 'opco-ep', 5),
      ...employeurs('10.71C', '10.71C', 'opco-ep', 35),
    ];
    const r = agregerSuggestions(observations, { prefixes: ['10'] });
    expect(r.entrees).toEqual([]);
    expect(r.decisions[0].motif).toBe('secteur partagé : la sous-classe 10.71C relève de opco-ep pour 40 employeurs sur 40');
    // Sous-classe observée sur moins de 10 employeurs : pas de conclusion, le parent est retenu (30 sur 35).
    const peu = agregerSuggestions([...employeurs('10', '10.51C', 'ocapiat', 30), ...employeurs('10', '10.71C', 'opco-ep', 5)]);
    expect(resume(peu)).toEqual(['10 ocapiat 0.86 35']);
  });

  it("une sous-classe tirée dans son propre cadre, sans entrée retenue, rend aussi le parent partagé", () => {
    // 47.52A (quincaillerie) n'apparaît pas dans le tirage du cadre 47, mais son propre tirage la montre chez AKTO.
    const observations = [...employeurs('47', '47.11F', 'opcommerce', 30), ...employeurs('47.52A', '47.52A', 'akto', 20)];
    const r = agregerSuggestions(observations, { prefixes: ['47', '47.52A'] });
    expect(r.entrees).toEqual([]);
    expect(r.decisions.find((d) => d.prefixe === '47')?.motif).toBe('secteur partagé : la sous-classe 47.52A relève de akto pour 20 employeurs sur 20');
    expect(r.decisions.find((d) => d.prefixe === '47.52A')?.motif).toMatch(/^échantillon trop petit/);
  });

  it("le tirage d'un cadre plus étroit ne compte pas pour le parent (tirage non proportionnel)", () => {
    const r = agregerSuggestions(
      [
        ...employeurs('47', '47.11F', 'opcommerce', 24),
        ...employeurs('47', '47.52A', 'akto', 6),
        ...employeurs('47.11F', '47.11F', 'opcommerce', 40),
      ],
      { prefixes: ['47'] },
    );
    expect(resume(r)).toEqual(['47 opcommerce 0.8 30']);
  });

  it('un établissement vu dans deux cadres compte une fois', () => {
    const doublons = employeurs('96', '96.02A', 'opco-ep', 30);
    const r = agregerSuggestions([...doublons, ...doublons.map((o) => ({ ...o, cadre: '96.02A' }))], { prefixes: ['96.02A'] });
    expect(resume(r)).toEqual(['96.02A opco-ep 1 30']);
  });

  it("une entrée plus longue qui donne le même OPCO que son parent est retirée quand le parent l'absorbe et reste retenu", () => {
    const r = agregerSuggestions([
      ...employeurs('45', '45.11Z', 'opco-mobilites', 30),
      ...employeurs('45', '45.20A', 'opco-mobilites', 30),
      ...employeurs('45', '45.31Z', 'akto', 5),
      ...employeurs('45.20A', '45.20A', 'opco-mobilites', 35),
    ]);
    expect(resume(r)).toEqual(['45 opco-mobilites 0.92 65']);
    expect(r.decisions.find((d) => d.prefixe === '45.20A')).toMatchObject({ retenu: false, motif: 'redondant : même OPCO que 45, qui le couvre' });
  });

  it("elle reste quand le parent, remesuré avec elle, passerait sous le seuil", () => {
    const r = agregerSuggestions([
      ...employeurs('50', '50.10Z', 'opco-mobilites', 18),
      ...employeurs('50', '50.10Z', 'akto', 12),
      ...employeurs('50', '50.20Z', 'akto', 3),
      ...employeurs('50.20Z', '50.20Z', 'opco-mobilites', 30),
    ]);
    // 50.20Z : 30 sur 33 ; 50 sans elle : 18 sur 30 (0,60) ; 50 avec elle : 18 sur 33 (0,55), sous le seuil.
    expect(resume(r)).toEqual(['50 opco-mobilites 0.6 30', '50.20Z opco-mobilites 0.91 33']);
    expect(r.exceptions).toEqual([]);
  });
});

describe('calibrage NAF : la table actuelle (naf-suggestions.json) est un point fixe de l\'agrégation', () => {
  /** Sous-classe fictive propre à un préfixe, hors de toute entrée plus longue : « 10 » donne 10.99Z, « 41.1 » 41.19Z. */
  const sousClasseDe = (prefixe: string): string =>
    prefixe.length === 2 ? `${prefixe}.99Z` : prefixe.length === 4 ? `${prefixe}9Z` : prefixe.length === 5 ? `${prefixe}Z` : prefixe;
  const observations = EMBEDDED_NAF.flatMap((e) => {
    const n = e.effectif_etablissements ?? 0;
    const k = Array.from({ length: n + 1 }, (_, i) => i).find((i) => Math.round((i / n) * 100) / 100 === e.part) ?? n;
    const autre = e.opco === 'atlas' ? 'akto' : 'atlas';
    return [...employeurs(e.prefixe, sousClasseDe(e.prefixe), e.opco, k), ...employeurs(e.prefixe, sousClasseDe(e.prefixe), autre, n - k)];
  });
  const r = agregerSuggestions(observations);

  it('mêmes préfixes, mêmes OPCO, mêmes parts, mêmes échantillons', () => {
    const attendu = EMBEDDED_NAF.map((e) => ({ prefixe: e.prefixe, opco: e.opco, part: e.part, effectif_etablissements: e.effectif_etablissements }));
    expect(r.entrees).toEqual([...attendu].sort((a, b) => (a.prefixe < b.prefixe ? -1 : 1)));
  });

  it('mêmes exceptions que celles déclarées dans naf-suggestions.test.ts, mêmes marges faibles', () => {
    expect(r.exceptions.map((e) => e.prefixe).sort()).toEqual(['10.13B', '10.71C', '10.71D', '41.1', '55.30Z']);
    expect(r.margesFaibles).toEqual(['23', '37', '47.76Z']);
  });

  it('une entrée calibrée, complétée de son intitulé et de la source, respecte le schéma des suggestions', () => {
    for (const e of r.entrees) {
      expect(SuggestionNafSchema.safeParse({ ...e, libelle: 'Intitulé', source: SOURCE_TABLE_SIRET_OPCO }).success, e.prefixe).toBe(true);
    }
  });

  it('comparerAvecTable : aucun écart avec elle-même ; ajouts, retraits, OPCO et parts changés sont relevés', () => {
    expect(comparerAvecTable(r.entrees, EMBEDDED_NAF)).toMatchObject({ ajoutees: [], retirees: [], opcoChange: [], partChange: [], inchangees: EMBEDDED_NAF.length });
    const modifiees = r.entrees
      .filter((e) => e.prefixe !== '23')
      .map((e) => (e.prefixe === '37' ? { ...e, opco: 'akto' } : e.prefixe === '47.76Z' ? { ...e, part: 0.75 } : e));
    modifiees.push({ prefixe: '88.91A', opco: 'opco-ep', part: 0.7, effectif_etablissements: 43 });
    const ecarts = comparerAvecTable(modifiees, EMBEDDED_NAF);
    expect(ecarts.ajoutees.map((e) => e.prefixe)).toEqual(['88.91A']);
    expect(ecarts.retirees.map((e) => e.prefixe)).toEqual(['23']);
    expect(ecarts.opcoChange).toEqual([{ prefixe: '37', avant: 'opco-ep', apres: 'akto' }]);
    expect(ecarts.partChange).toEqual([{ prefixe: '47.76Z', avant: 0.65, apres: 0.75, nAvant: 43, nApres: 43 }]);
  });
});

describe('calibrage NAF : utilitaires du script', () => {
  it("opcoDepuisTable : les libellés de la colonne OPCO_PROPRIETAIRE donnent les identifiants du cœur", () => {
    const attendus: [unknown, string | null][] = [
      ['OPCO EP', 'opco-ep'], ["L'OPCOMMERCE", 'opcommerce'], ['Opco Santé', 'opco-sante'], ['OPCO 2i', 'opco2i'],
      ['OPCO MOBILITES', 'opco-mobilites'], ['AKTO', 'akto'], ['Uniformation', 'uniformation'], ['', null], [null, null], ['OPCO XYZ', null],
    ];
    for (const [valeur, slug] of attendus) expect(opcoDepuisTable(valeur), String(valeur)).toBe(slug);
  });

  it('tirage reproductible : même graine, même suite ; le mélange est une permutation', () => {
    const a = generateur(empreinte('20261008:96.02A'));
    const b = generateur(empreinte('20261008:96.02A'));
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b));
    expect(empreinte('20261008:96.02A')).not.toBe(empreinte('20261008:47.73Z'));
    const liste = Array.from({ length: 50 }, (_, i) => i + 1);
    const melange = melanger(liste, generateur(7));
    expect(melange).not.toEqual(liste);
    expect([...melange].sort((x, y) => x - y)).toEqual(liste);
    expect(melanger(liste, generateur(7))).toEqual(melange);
  });

  it('hôtes : https et liste fermée, jamais api.francecompetences.fr', () => {
    expect(hoteAutorise('https://recherche-entreprises.api.gouv.fr/search?q=1')).toBe(true);
    expect(hoteAutorise('https://tabular-api.data.gouv.fr/api/resources/x/data/')).toBe(true);
    expect(hoteAutorise('https://www.insee.fr/fr/statistiques/fichier/2120875/naf2008_liste_n5.xls')).toBe(true);
    for (const refusee of [
      'https://api.francecompetences.fr/siret/12345678901234',
      'https://quel-est-mon-opco.francecompetences.fr/',
      'http://www.data.gouv.fr/api/1/datasets/',
      'https://exemple.fr/',
      'pas une adresse',
    ]) {
      expect(hoteAutorise(refusee), refusee).toBe(false);
    }
  });

  it('cache et sorties hors du dépôt', () => {
    const depot = fileURLToPath(new URL('../../../', import.meta.url));
    expect(estDansLeDepot(depot)).toBe(true);
    expect(estDansLeDepot(fileURLToPath(new URL('../data/idcc/', import.meta.url)))).toBe(true);
    expect(estDansLeDepot(tmpdir())).toBe(false);
  });

  it('préfixes NAF d\'un code, du plus court au plus long', () => {
    expect(prefixesDe('47.73Z')).toEqual(['47', '47.7', '47.73', '47.73Z']);
    expect(prefixesDe('47.7')).toEqual(['47', '47.7']);
    expect(prefixesDe('10')).toEqual(['10']);
  });
});
