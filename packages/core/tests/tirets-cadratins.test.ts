// ============================================================
// Charte SFG : aucun fichier du paquet @opco/core (sources, tests, données, configuration) ne contient le tiret cadratin ni
// ses variantes (U+2014, U+2015, U+2E3A, U+2E3B, U+FE31, U+FE58), pas même dans un commentaire ou un titre de test.
// charte-sfg.test.ts, qui les nomme pour les interdire, les construit par leur code et ne les écrit donc pas non plus.
// ============================================================

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/** Les six caractères interdits, construits par leur code (ils ne figurent pas dans ce fichier). */
const INTERDITS = [0x2014, 0x2015, 0x2e3a, 0x2e3b, 0xfe31, 0xfe58].map((code) => String.fromCharCode(code));

const RACINE = new URL('../', import.meta.url);

/** Fichiers texte du paquet (chemins relatifs), hors node_modules. */
function fichiersDuPaquet(dossier = ''): string[] {
  return readdirSync(new URL(dossier, RACINE)).flatMap((nom) => {
    if (nom === 'node_modules' || nom.startsWith('.')) return [];
    const chemin = `${dossier}${nom}`;
    if (statSync(new URL(chemin, RACINE)).isDirectory()) return fichiersDuPaquet(`${chemin}/`);
    return /\.(ts|json|mjs|js|md)$/.test(nom) ? [chemin] : [];
  });
}

/** Lignes d'un texte qui contiennent un caractère interdit, sous la forme « chemin:ligne ». */
function lignesFautives(chemin: string, texte: string): string[] {
  return texte.split('\n').flatMap((ligne, i) => (INTERDITS.some((c) => ligne.includes(c)) ? [`${chemin}:${i + 1}`] : []));
}

describe('charte SFG : aucun tiret cadratin ni variante dans le paquet @opco/core', () => {
  it('sources, tests, données et configuration', () => {
    const fichiers = fichiersDuPaquet();
    expect(fichiers.some((f) => f.startsWith('src/'))).toBe(true);
    expect(fichiers.some((f) => f.startsWith('tests/'))).toBe(true);
    expect(fichiers.some((f) => f.startsWith('data/'))).toBe(true);
    expect(fichiers.flatMap((f) => lignesFautives(f, readFileSync(new URL(f, RACINE), 'utf8')))).toEqual([]);
  });

  it('le contrôle reconnaît chacun des six caractères', () => {
    for (const c of INTERDITS) expect(lignesFautives('exemple.ts', `const a = 1;\n// avant ${c} après`)).toEqual(['exemple.ts:2']);
    expect(lignesFautives('exemple.ts', 'const a = 1; // tiret demi-cadratin – et trait d\'union - acceptés')).toEqual([]);
  });
});
