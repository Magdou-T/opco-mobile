#!/usr/bin/env node
// ============================================================
// Garde de la charte SFG pour le site (apps/web/src) : Node seul, sans dependance.
//
// Signale, avec fichier, ligne et colonne :
//   (a) le tiret cadratin U+2014 (interdit dans tout texte SFG) ;
//   (b) les couleurs bleues ou violettes : classes Tailwind blue, indigo, violet, purple, fuchsia, sky, et couleurs
//       litterales (hexadecimal, rgb(), hsl()) dont la teinte est comprise entre 190 et 320 degres ;
//   (c) la police mono retiree du site : font-mono, IBM Plex ;
//   (d) les emojis (plage Unicode U+1F000 a U+1FAFF).
//
// Usage : node scripts/check-charte-sfg.mjs [--self-test]
// Code de sortie 1 s'il y a au moins une violation (ou un ecart dans l'autotest).
// ============================================================

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = join(RACINE, 'apps', 'web', 'src');
const EXTENSIONS = new Set(['.ts', '.tsx', '.css']);

const TIRET_CADRATIN = '\u2014';
const TEINTE_MIN = 190;
const TEINTE_MAX = 320;

const CLASSE_BLEUE =
  /(?<![\w-])(?:[\w-]+:)*-?(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|decoration|shadow|accent|caret|divide|placeholder)-(?:blue|indigo|violet|purple|fuchsia|sky)(?:-\d{2,3})?(?:\/\d{1,3})?(?![\w-])/g;
const VARIABLE_BLEUE = /--color-(?:blue|indigo|violet|purple|fuchsia|sky)(?![a-z])/g;
// Le souligne precede le # dans les valeurs arbitraires Tailwind (shadow-[0_0_0_2px_#7c3aed]) : il reste admis devant.
const HEX = /(?<![0-9A-Za-z&#-])#([0-9a-fA-F]{3,8})(?![\w-])/g;
const RGB = /rgba?\(\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)\s*[,\s]\s*([\d.]+%?)/gi;
const HSL = /hsla?\(\s*(-?[\d.]+)(deg|turn|rad|grad)?\s*[,\s]\s*([\d.]+)%?/gi;
// `--font-mono: initial` retire la police mono du theme Tailwind : c'est le contraire d'un emploi, il n'est pas signale.
const MONO = /(?<![\w-])font-mono(?![\w-])|--font-mono(?![\w-])(?!\s*:\s*initial\b)|IBM[ _]Plex|(?<![\w-])Plex(?![\w])|plex-mono/g;
const EMOJI = /[\u{1F000}-\u{1FAFF}]/gu;

/** Teinte HSL (degres) d'une couleur RVB 0-255, ou null pour un gris (chroma quasi nulle). */
function teinte(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 3) return null;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

function hexVersRvb(hex) {
  const n = hex.length;
  if (n === 3 || n === 4) return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16));
  if (n === 6 || n === 8) return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return null;
}

function composante(v) {
  return v.endsWith('%') ? (parseFloat(v) * 255) / 100 : parseFloat(v);
}

function teinteHsl(valeur, unite) {
  const v = parseFloat(valeur);
  switch (unite) {
    case 'turn':
      return v * 360;
    case 'rad':
      return (v * 180) / Math.PI;
    case 'grad':
      return v * 0.9;
    default:
      return v;
  }
}

const dansLaPlage = (h) => {
  const t = ((h % 360) + 360) % 360;
  return t >= TEINTE_MIN && t <= TEINTE_MAX;
};

/** Violations d'un texte : liste de { ligne, colonne, type, extrait }. */
export function analyser(texte) {
  const violations = [];
  const lignes = texte.split(/\r?\n/);
  lignes.forEach((ligne, i) => {
    const noter = (type, index, extrait) => violations.push({ ligne: i + 1, colonne: index + 1, type, extrait });

    let k = ligne.indexOf(TIRET_CADRATIN);
    while (k !== -1) {
      noter('tiret cadratin', k, ligne.slice(Math.max(0, k - 20), k + 20).trim());
      k = ligne.indexOf(TIRET_CADRATIN, k + 1);
    }
    for (const m of ligne.matchAll(CLASSE_BLEUE)) noter('bleu ou violet (classe Tailwind)', m.index, m[0]);
    for (const m of ligne.matchAll(VARIABLE_BLEUE)) noter('bleu ou violet (variable Tailwind)', m.index, m[0]);
    for (const m of ligne.matchAll(HEX)) {
      const rvb = hexVersRvb(m[1]);
      if (!rvb) continue;
      const h = teinte(...rvb);
      if (h !== null && dansLaPlage(h)) noter(`bleu ou violet (couleur ${m[0]}, teinte ${Math.round(h)} degres)`, m.index, m[0]);
    }
    for (const m of ligne.matchAll(RGB)) {
      const h = teinte(composante(m[1]), composante(m[2]), composante(m[3]));
      if (h !== null && dansLaPlage(h)) noter(`bleu ou violet (rgb, teinte ${Math.round(h)} degres)`, m.index, m[0]);
    }
    for (const m of ligne.matchAll(HSL)) {
      const saturation = parseFloat(m[3]);
      const h = teinteHsl(m[1], m[2]);
      if (saturation > 0 && dansLaPlage(h)) noter(`bleu ou violet (hsl, teinte ${Math.round(h)} degres)`, m.index, m[0]);
    }
    for (const m of ligne.matchAll(MONO)) noter('police mono retiree (font-mono, Plex)', m.index, m[0]);
    for (const m of ligne.matchAll(EMOJI)) noter('emoji', m.index, `U+${m[0].codePointAt(0).toString(16).toUpperCase()}`);
  });
  return violations;
}

function fichiers(dossier) {
  const resultat = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) resultat.push(...fichiers(chemin));
    else if (EXTENSIONS.has(extname(entree.name))) resultat.push(chemin);
  }
  return resultat.sort();
}

function verifierLeSite() {
  const liste = fichiers(DOSSIER);
  let total = 0;
  const parType = new Map();
  for (const chemin of liste) {
    for (const v of analyser(readFileSync(chemin, 'utf8'))) {
      total += 1;
      parType.set(v.type.split(' (')[0], (parType.get(v.type.split(' (')[0]) ?? 0) + 1);
      const fichier = relative(RACINE, chemin).split('\\').join('/');
      console.log(`${fichier}:${v.ligne}:${v.colonne}  [${v.type}]  ${v.extrait}`);
    }
  }
  if (total === 0) {
    console.log(`Charte SFG : aucun probleme dans ${liste.length} fichiers (apps/web/src).`);
    return 0;
  }
  const detail = [...parType].map(([type, n]) => `${type} : ${n}`).join(', ');
  console.log(`\nCharte SFG : ${total} probleme(s) dans apps/web/src (${detail}).`);
  return 1;
}

function autotest() {
  // Chaque chaine fautive doit produire exactement les types attendus ; chaque chaine propre, aucun.
  const fautifs = [
    ['Un dossier \u2014 deux phrases', ['tiret cadratin']],
    ['<p className="text-blue-600">', ['bleu ou violet (classe Tailwind)']],
    ['className="hover:bg-indigo-50 ring-violet-400/50"', ['bleu ou violet (classe Tailwind)', 'bleu ou violet (classe Tailwind)']],
    ['className="from-purple-500 to-sky-300"', ['bleu ou violet (classe Tailwind)', 'bleu ou violet (classe Tailwind)']],
    ['--color-fuchsia: red;', ['bleu ou violet (variable Tailwind)']],
    ['color: #3B82F6;', ['bleu ou violet (couleur #3B82F6, teinte 217 degres)']],
    ['shadow-[0_0_0_2px_#7c3aed]', ['bleu ou violet (couleur #7c3aed, teinte 262 degres)']],
    ['fill="#00f"', ['bleu ou violet (couleur #00f, teinte 240 degres)']],
    ['background: rgb(124, 58, 237);', ['bleu ou violet (rgb, teinte 262 degres)']],
    ['color: rgba(14 165 233 / 0.5)', ['bleu ou violet (rgb, teinte 199 degres)']],
    ['color: hsl(250 80% 50%)', ['bleu ou violet (hsl, teinte 250 degres)']],
    ['color: hsla(0.75turn, 60%, 40%, 1)', ['bleu ou violet (hsl, teinte 270 degres)']],
    ['<span className="font-mono">', ['police mono retiree (font-mono, Plex)']],
    ["import { IBM_Plex_Mono } from 'next/font/google';", ['police mono retiree (font-mono, Plex)']],
    ['font-family: "IBM Plex Mono";', ['police mono retiree (font-mono, Plex)']],
    ['font-family: var(--font-plex-mono);', ['police mono retiree (font-mono, Plex)']],
    ['--font-mono: ui-monospace;', ['police mono retiree (font-mono, Plex)']],
    ['Bravo \u{1F389} !', ['emoji']],
    ['Super \u{1F44D}', ['emoji']],
  ];
  const propres = [
    'Un dossier, deux phrases ; une virgule ou deux points : rien a signaler.',
    'De 0,05 \u2013 0,60 % (tiret demi-cadratin admis)',
    'className="bg-orange-deep text-white hover:bg-orange-deeper"',
    'className="text-turquoise-deep bg-turquoise-soft border-filet"',
    'className="bg-navy text-paper ring-cobalt-soft"',
    '--orange: #E84E1B; --turquoise: #5E9F92; --encre: #0F1E1B; --lin: #E6EFEC;',
    '--or: #F9B233; --rouge: #BC1723; --vert-clair: #A3D1C8; --texte: #1A1A1A; --blanc: #FFF;',
    'color: rgb(232, 78, 27); background: rgba(0, 0, 0, 0.1); color: hsl(15 82% 51%);',
    'color: hsl(220 0% 50%); /* gris : saturation nulle */',
    'background: #F8F8F9; border-color: rgb(250, 250, 252); /* gris, chroma d arrondi */',
    '--font-mono: initial; /* retrait de la police mono du theme */',
    '<a href="#principe">Le principe</a> <a href="#cpf">CPF</a>',
    'Une demande complexe, un dossier complexe.',
    'Signes typographiques tol\u00e9r\u00e9s : \u2713 \u26A0 \u2197 \u25B8 \u25BE',
    'const lien = `IDCC ${i.idcc} \u00b7 ${i.titre}`;',
    '&#8217; et &#x2019;',
  ];

  let ecarts = 0;
  for (const [texte, attendus] of fautifs) {
    const trouves = analyser(texte).map((v) => v.type);
    const ok = trouves.length === attendus.length && attendus.every((t, i) => trouves[i] === t);
    if (!ok) {
      ecarts += 1;
      console.log(`ECART (violation non detectee) : ${JSON.stringify(texte)}\n  attendu : ${JSON.stringify(attendus)}\n  obtenu  : ${JSON.stringify(trouves)}`);
    }
  }
  for (const texte of propres) {
    const trouves = analyser(texte);
    if (trouves.length > 0) {
      ecarts += 1;
      console.log(`ECART (faux positif) : ${JSON.stringify(texte)}\n  obtenu : ${JSON.stringify(trouves.map((v) => v.type))}`);
    }
  }
  // Numerotation des lignes et colonnes sur un texte de plusieurs lignes.
  const multi = analyser('ligne propre\r\nfont-mono ici\nfin \u2014 la');
  const positions = multi.map((v) => `${v.ligne}:${v.colonne}`).join(' ');
  if (positions !== '2:1 3:5') {
    ecarts += 1;
    console.log(`ECART (positions) : attendu "2:1 3:5", obtenu "${positions}"`);
  }

  const total = fautifs.length + propres.length + 1;
  if (ecarts > 0) {
    console.log(`\nAutotest de la garde de charte : ${ecarts} ecart(s) sur ${total} cas.`);
    return 1;
  }
  console.log(`Autotest de la garde de charte : ${total} cas, tous conformes (${fautifs.length} violations detectees, ${propres.length} textes propres non signales, positions exactes).`);
  return 0;
}

process.exitCode = process.argv.includes('--self-test') ? autotest() : verifierLeSite();
