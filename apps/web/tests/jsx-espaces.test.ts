// Garde : le compilateur de Next (SWC, Next 16.2) perd l'espace de tête d'un texte JSX écrit sur plusieurs lignes qui
// contient une entité HTML (&apos;, &nbsp;...) : « <strong>Titre.</strong> Le site n&apos;envoie », suivi d'un saut
// de ligne et de « rien », s'affiche « Titre.Le site n'envoie rien ». TypeScript et Babel gardent cette espace ; un
// texte sur une seule ligne, ou sans entité, la garde aussi. Constaté le 08/10/2026 sur trois textes (deux des mentions légales, et l'étape Formation :
// « Le barème appliqué d'AKTOaffiche un plafond de 0 €/h ») ; la forme sûre écrit {' '} avant le texte.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const ENTITE = /&(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);/;

/**
 * Textes JSX dont SWC perd l'espace de tête : ils commencent par des espaces suivies d'un caractère sur la même ligne
 * (après une balise ou une expression), continuent sur une autre ligne et contiennent une entité. Renvoie
 * « ligne : début du texte » pour chacun.
 */
function textesFragiles(source: string): string[] {
  const fichier = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fragiles: string[] = [];
  const visiter = (n: ts.Node) => {
    if (ts.isJsxText(n) && /^[ \t]+\S/.test(n.text) && n.text.includes('\n') && ENTITE.test(n.text)) {
      const { line } = fichier.getLineAndCharacterOfPosition(n.getStart());
      fragiles.push(`${line + 1} : ${n.text.trim().slice(0, 60)}`);
    }
    ts.forEachChild(n, visiter);
  };
  visiter(fichier);
  return fragiles;
}

function fichiersTsx(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) return fichiersTsx(chemin);
    return e.name.endsWith('.tsx') ? [chemin] : [];
  });
}

describe('espace de tête des textes JSX (perdue par SWC)', () => {
  test('le détecteur signale les formes fragiles et laisse passer les formes sûres', () => {
    const p = (corps: string) => `const a = <p>\n  ${corps}\n</p>;`;
    assert.equal(textesFragiles(p("<strong>Titre.</strong> Le site n&apos;envoie\n  rien")).length, 1);
    assert.equal(textesFragiles(p("Le barème {de(nom)} affiche 0&nbsp;€/h&nbsp;: épuisée.\n  Suite")).length, 1);
    // Un saut de ligne en fin de texte suffit (balise fermante à la ligne suivante) : SWC perd aussi l'espace.
    assert.equal(textesFragiles(p("<strong>Titre.</strong> Le site n&apos;envoie rien")).length, 1);
    assert.equal(textesFragiles(p("<strong>Titre.</strong>{' '}Le site n&apos;envoie\n  rien")).length, 0);
    assert.equal(textesFragiles("const a = <p><strong>Titre.</strong> Le site n&apos;envoie rien</p>;").length, 0);
    assert.equal(textesFragiles(p('<strong>Titre.</strong> Le site envoie\n  tout')).length, 0);
    assert.equal(textesFragiles(p("Le site n&apos;envoie\n  rien <strong>Titre.</strong>")).length, 0);
  });

  test('aucun texte fragile dans les pages et composants du site', () => {
    const fichiers = fichiersTsx(SRC);
    assert.ok(fichiers.length >= 60, String(fichiers.length));
    const fautes = fichiers.flatMap((f) =>
      textesFragiles(readFileSync(f, 'utf8')).map((t) => `${relative(SRC, f)}, ligne ${t}`),
    );
    assert.deepEqual(fautes, []);
  });
});
