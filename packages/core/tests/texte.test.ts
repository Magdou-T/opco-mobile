// ============================================================
// Rédaction des textes du moteur : un nom d'OPCO dans une phrase (élision de « de », article « L' » en minuscule), sur les
// onze noms réels des données embarquées.
// ============================================================

import { describe, it, expect } from 'vitest';
import { EMBEDDED_OPCOS } from '../src/data';
import { INSECABLE, apposition, dansLaPhrase, de } from '../src/texte';

/** Les onze OPCO, avec « de » élidé et le nom placé après un nom commun (« le plafond AKTO », « le plafond de l'Opcommerce »). */
const ATTENDUS: Record<string, { de: string; apposition: string; phrase: string }> = {
  AFDAS: { de: "d'AFDAS", apposition: 'AFDAS', phrase: 'AFDAS' },
  AKTO: { de: "d'AKTO", apposition: 'AKTO', phrase: 'AKTO' },
  ATLAS: { de: "d'ATLAS", apposition: 'ATLAS', phrase: 'ATLAS' },
  Constructys: { de: 'de Constructys', apposition: 'Constructys', phrase: 'Constructys' },
  OCAPIAT: { de: "d'OCAPIAT", apposition: 'OCAPIAT', phrase: 'OCAPIAT' },
  'OPCO EP': { de: "d'OPCO EP", apposition: 'OPCO EP', phrase: 'OPCO EP' },
  'OPCO Mobilités': { de: "d'OPCO Mobilités", apposition: 'OPCO Mobilités', phrase: 'OPCO Mobilités' },
  'OPCO Santé': { de: "d'OPCO Santé", apposition: 'OPCO Santé', phrase: 'OPCO Santé' },
  'OPCO 2i': { de: "d'OPCO 2i", apposition: 'OPCO 2i', phrase: 'OPCO 2i' },
  "L'Opcommerce": { de: "de l'Opcommerce", apposition: "de l'Opcommerce", phrase: "l'Opcommerce" },
  Uniformation: { de: "d'Uniformation", apposition: 'Uniformation', phrase: 'Uniformation' },
};

describe("nom d'un OPCO dans une phrase", () => {
  it('les onze noms des données embarquées sont couverts', () => {
    expect(EMBEDDED_OPCOS.map((o) => o.name).sort()).toEqual(Object.keys(ATTENDUS).sort());
  });

  it.each(Object.entries(ATTENDUS))('%s : « %o »', (nom, attendu) => {
    expect(de(nom)).toBe(attendu.de);
    expect(apposition(nom)).toBe(attendu.apposition);
    expect(dansLaPhrase(nom)).toBe(attendu.phrase);
  });

  it("voyelle accentuée, nom commençant par une consonne, apostrophe typographique, article déjà en minuscule", () => {
    const typographique = String.fromCharCode(0x2019); // apostrophe typographique, construite par son code
    expect(de('Écoles de France')).toBe("d'Écoles de France");
    expect(de('Test OPCO')).toBe('de Test OPCO');
    expect(de(`L${typographique}Opcommerce`)).toBe(`de l${typographique}Opcommerce`);
    expect(de("l'Opcommerce")).toBe("de l'Opcommerce");
    expect(dansLaPhrase('Le Fonds')).toBe('Le Fonds'); // seul l'article élidé « L' » est concerné
  });

  it('espace insécable (U+00A0) entre un nombre et son unité', () => {
    expect(INSECABLE).toBe(String.fromCharCode(0xa0));
  });
});
