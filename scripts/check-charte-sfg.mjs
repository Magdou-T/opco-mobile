#!/usr/bin/env node
// ============================================================
// Garde de la charte SFG pour le site (apps/web/src) : Node seul, sans dependance.
//
// Signale, avec fichier, ligne et colonne :
//   (a) le tiret cadratin et ses variantes : U+2014, U+2015 (barre horizontale), U+2E3A, U+2E3B, U+FE58, ecrits tels
//       quels ou sous forme d'entite HTML (&mdash; &horbar; &#8212; &#x2014;), d'echappement JavaScript (\u2014,
//       \u{2014}) ou CSS (\2014) ;
//   (b) les couleurs bleues ou violettes (teinte TSL comprise entre 190 et 320 degres, gris exclus) :
//       - classes Tailwind de la palette retiree (blue, indigo, violet, purple, fuchsia, sky) sur chacun des 49
//         utilitaires de couleur de Tailwind 4 (bg, text, border-*, ring, inset-ring, shadow, inset-shadow,
//         drop-shadow, text-shadow, mask-*-from/to, etc.) et variables --color-blue... ;
//       - fonctions de couleur : rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch(), color(), separateurs virgule,
//         espace, barre ou souligne (valeurs arbitraires Tailwind : bg-[rgb(59_130_246)]) ;
//       - hexadecimal et couleurs nommees CSS (blue, navy, rebeccapurple...) dans un contexte de couleur : declaration
//         CSS ou objet de style, attribut fill / stroke / color, valeur arbitraire Tailwind [...], argument d'un
//         degrade ou de color-mix() ; une chaine qui n'est qu'un hexadecimal compte aussi, sauf comme ancre (href,
//         id, querySelector) : #bad ou #decade dans un lien ne sont pas des couleurs ;
//       - est un gris toute couleur dont la chroma OKLCH est inferieure a 0,01 (moins de la moitie d'un ecart
//         perceptible) : un gris bleute tres pale comme #F8F9FB n'est pas signale, #F0F8FF (aliceblue) l'est ;
//   (c) la police mono : font-mono, monospace (font-family, font-[monospace]), IBM Plex et les familles mono connues
//       (Courier, Consolas, Menlo, SF Mono, Fira Code, JetBrains Mono, Source Code Pro, Cascadia, Inconsolata,
//       * Mono), et les balises <code>, <pre>, <kbd>, <samp>, <tt> que le navigateur rend en mono ;
//   (d) les emojis : tout pictogramme (proprietes Unicode Extended_Pictographic et Emoji_Presentation, plage U+1F000 a
//       U+1FAFF, selecteur U+FE0F, touche U+20E3), sauf les signes typographiques toleres sans selecteur U+FE0F :
//       coche U+2713, attention U+26A0, fleche U+2197, triangles U+25B8 et U+25BE, (c) U+00A9, (r) U+00AE, TM U+2122.
//
// Limites connues : la garde lit le texte source, pas le rendu. Une couleur construite a l'execution (variable,
// concatenation, valeur venue des donnees), un hexadecimal sans contexte de couleur (commentaire, texte), une police
// mono chargee par un nom inconnu, une image ou une icone bleue echappent au controle. Les donnees de packages/core
// sont controlees par packages/core/tests/charte-sfg.test.ts.
//
// Usage : node scripts/check-charte-sfg.mjs [--self-test]
// Code de sortie 1 s'il y a au moins une violation (ou un ecart dans l'autotest).
// ============================================================

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = join(RACINE, 'apps', 'web', 'src');
const EXTENSIONS = new Set(['.ts', '.tsx', '.css']);

const TEINTE_MIN = 190;
const TEINTE_MAX = 320;
/** En dessous de cette chroma OKLCH, une couleur est un gris (un ecart perceptible vaut environ 0,02). */
const CHROMA_GRIS = 0.01;

// ------------------------------------------------------------
// (a) Tiret cadratin et variantes
// ------------------------------------------------------------
const TIRETS = /[\u2014\u2015\u2E3A\u2E3B\uFE58]/g;
const CODES_TIRET = '2014|2015|2[eE]3[aAbB]|[fF][eE]58';
const TIRETS_ECRITS = new RegExp(
  [
    '&(?:mdash|horbar);',
    '&#0*(?:8212|8213|11834|11835|65112);',
    `&#[xX]0*(?:${CODES_TIRET});`,
    `\\\\u(?:${CODES_TIRET})(?![0-9a-fA-F])`,
    `\\\\u\\{0*(?:${CODES_TIRET})\\}`,
    '\\\\0{0,2}201[45](?![0-9a-fA-F])',
  ].join('|'),
  'g',
);

// ------------------------------------------------------------
// (b) Bleu et violet
// ------------------------------------------------------------
const FAMILLES_BLEUES = 'blue|indigo|violet|purple|fuchsia|sky';
// Les 49 racines d'utilitaires de couleur de Tailwind 4.2 (liste tiree de getClassList()).
const RACINES_COULEUR = [
  'bg',
  'text',
  'border(?:-(?:[trblxyse]|b[se]))?',
  'ring(?:-offset)?',
  'inset-ring',
  'outline',
  'fill',
  'stroke',
  'from',
  'via',
  'to',
  'decoration',
  'shadow',
  'inset-shadow',
  'drop-shadow',
  'text-shadow',
  'accent',
  'caret',
  'divide',
  'placeholder',
  'mask-(?:[trblxy]|linear|radial|conic)-(?:from|to)',
].join('|');
const CLASSE_BLEUE = new RegExp(
  `(?<![\\w-])(?:${RACINES_COULEUR})-(?:${FAMILLES_BLEUES})(?:-\\d{2,3})?(?:\\/[^\\s"'\`]+)?(?![\\w-])`,
  'g',
);
const VARIABLE_BLEUE = new RegExp(`--color-(?:${FAMILLES_BLEUES})(?![a-z])`, 'g');
// Le souligne separe les mots dans les valeurs arbitraires Tailwind (shadow-[0_0_0_2px_#7c3aed]) : il reste admis autour.
const HEX = /(?<![0-9A-Za-z&#-])#([0-9a-fA-F]{3,8})(?![0-9A-Za-z-])/g;
// Fonctions de couleur : rgb() rgba() hsl() hsla() hwb() lab() lch() oklab() oklch() color(), sans parenthese imbriquee.
const FONCTION = /(?<![\w.-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(([^()]*)\)/gi;

// Couleurs nommees CSS (CSS Color 4), avec leur valeur ; seules les bleues ou violettes sont recherchees.
const NOMMEES = {
  aliceblue: 'f0f8ff', antiquewhite: 'faebd7', aqua: '00ffff', aquamarine: '7fffd4', azure: 'f0ffff', beige: 'f5f5dc',
  bisque: 'ffe4c4', black: '000000', blanchedalmond: 'ffebcd', blue: '0000ff', blueviolet: '8a2be2', brown: 'a52a2a',
  burlywood: 'deb887', cadetblue: '5f9ea0', chartreuse: '7fff00', chocolate: 'd2691e', coral: 'ff7f50',
  cornflowerblue: '6495ed', cornsilk: 'fff8dc', crimson: 'dc143c', cyan: '00ffff', darkblue: '00008b',
  darkcyan: '008b8b', darkgoldenrod: 'b8860b', darkgray: 'a9a9a9', darkgreen: '006400', darkgrey: 'a9a9a9',
  darkkhaki: 'bdb76b', darkmagenta: '8b008b', darkolivegreen: '556b2f', darkorange: 'ff8c00', darkorchid: '9932cc',
  darkred: '8b0000', darksalmon: 'e9967a', darkseagreen: '8fbc8f', darkslateblue: '483d8b', darkslategray: '2f4f4f',
  darkslategrey: '2f4f4f', darkturquoise: '00ced1', darkviolet: '9400d3', deeppink: 'ff1493', deepskyblue: '00bfff',
  dimgray: '696969', dimgrey: '696969', dodgerblue: '1e90ff', firebrick: 'b22222', floralwhite: 'fffaf0',
  forestgreen: '228b22', fuchsia: 'ff00ff', gainsboro: 'dcdcdc', ghostwhite: 'f8f8ff', gold: 'ffd700',
  goldenrod: 'daa520', gray: '808080', green: '008000', greenyellow: 'adff2f', grey: '808080', honeydew: 'f0fff0',
  hotpink: 'ff69b4', indianred: 'cd5c5c', indigo: '4b0082', ivory: 'fffff0', khaki: 'f0e68c', lavender: 'e6e6fa',
  lavenderblush: 'fff0f5', lawngreen: '7cfc00', lemonchiffon: 'fffacd', lightblue: 'add8e6', lightcoral: 'f08080',
  lightcyan: 'e0ffff', lightgoldenrodyellow: 'fafad2', lightgray: 'd3d3d3', lightgreen: '90ee90', lightgrey: 'd3d3d3',
  lightpink: 'ffb6c1', lightsalmon: 'ffa07a', lightseagreen: '20b2aa', lightskyblue: '87cefa',
  lightslategray: '778899', lightslategrey: '778899', lightsteelblue: 'b0c4de', lightyellow: 'ffffe0', lime: '00ff00',
  limegreen: '32cd32', linen: 'faf0e6', magenta: 'ff00ff', maroon: '800000', mediumaquamarine: '66cdaa',
  mediumblue: '0000cd', mediumorchid: 'ba55d3', mediumpurple: '9370db', mediumseagreen: '3cb371',
  mediumslateblue: '7b68ee', mediumspringgreen: '00fa9a', mediumturquoise: '48d1cc', mediumvioletred: 'c71585',
  midnightblue: '191970', mintcream: 'f5fffa', mistyrose: 'ffe4e1', moccasin: 'ffe4b5', navajowhite: 'ffdead',
  navy: '000080', oldlace: 'fdf5e6', olive: '808000', olivedrab: '6b8e23', orange: 'ffa500', orangered: 'ff4500',
  orchid: 'da70d6', palegoldenrod: 'eee8aa', palegreen: '98fb98', paleturquoise: 'afeeee', palevioletred: 'db7093',
  papayawhip: 'ffefd5', peachpuff: 'ffdab9', peru: 'cd853f', pink: 'ffc0cb', plum: 'dda0dd', powderblue: 'b0e0e6',
  purple: '800080', rebeccapurple: '663399', red: 'ff0000', rosybrown: 'bc8f8f', royalblue: '4169e1',
  saddlebrown: '8b4513', salmon: 'fa8072', sandybrown: 'f4a460', seagreen: '2e8b57', seashell: 'fff5ee',
  sienna: 'a0522d', silver: 'c0c0c0', skyblue: '87ceeb', slateblue: '6a5acd', slategray: '708090',
  slategrey: '708090', snow: 'fffafa', springgreen: '00ff7f', steelblue: '4682b4', tan: 'd2b48c', teal: '008080',
  thistle: 'd8bfd8', tomato: 'ff6347', turquoise: '40e0d0', violet: 'ee82ee', wheat: 'f5deb3', white: 'ffffff',
  whitesmoke: 'f5f5f5', yellow: 'ffff00', yellowgreen: '9acd32',
};

// Contextes de couleur, testes sur le texte qui precede la valeur (au plus 400 caracteres).
const PROPRIETE_COULEUR = [
  '--[\\w-]+',
  '-webkit-text-fill-color',
  '-webkit-text-stroke(?:-color)?',
  '[a-zA-Z-]*[cC]olor',
  'background(?:-image)?',
  'backgroundImage',
  'border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?',
  'border(?:Top|Right|Bottom|Left|Block|Inline)(?:Start|End)?',
  'outline',
  'fill',
  'stroke',
  'box-shadow',
  'boxShadow',
  'text-shadow',
  'textShadow',
  'text-decoration',
  'textDecoration',
  'text-emphasis',
  'textEmphasis',
  'column-rule',
  'columnRule',
  'filter',
  'mask(?:-image)?',
  'maskImage',
  'list-style(?:-image)?',
].join('|');
/** Declaration CSS ou objet de style : propriete de couleur, deux-points, puis la valeur sans sortir de la declaration. */
const DECLARATION = new RegExp(`(?:^|[^\\w-])(?:${PROPRIETE_COULEUR})\\s*:\\s*["'\`]?[^;{}"'\`]*$`);
/** Attribut JSX ou SVG porteur de couleur : fill="...", stroke={'...'}, color="...", stopColor="...". */
const ATTRIBUT = /(?:^|[^\w-])(?:fill|stroke|color|stop-?[cC]olor|flood-?[cC]olor|lighting-?[cC]olor|bgcolor)\s*=\s*\{?\s*["'`]\s*$/;
/** Valeur arbitraire Tailwind encore ouverte : bg-[ , shadow-[0_0_0_2px_ , bg-[color-mix(in_srgb, ... */
const ARBITRAIRE = /\[[^\]\s"'`]*$/;
/** Argument d'un degrade, de color-mix(), light-dark() ou drop-shadow() encore ouvert (un niveau de parentheses). */
const ARGUMENT = /(?:color-mix|light-dark|(?:repeating-)?(?:linear|radial|conic)-gradient|drop-shadow)\((?:[^()]|\([^()]*\))*$/;
/** Une chaine "#abc" employee comme ancre ou selecteur, pas comme couleur. */
const ANCRE = /(?:(?:^|[^\w-])(?:href|to|id|htmlFor|for|name|hash|target|aria-[\w-]+|xlinkHref|xlink:href)\s*[=:]\s*\{?\s*|(?:querySelector(?:All)?|getElementById|closest|matches|scrollIntoView|push|replace|scrollTo|startsWith|endsWith|includes)\(\s*)$/;

function enContexteDeCouleur(texte, debut, fin, chaineSeule) {
  const avant = texte.slice(Math.max(0, debut - 400), debut);
  if (DECLARATION.test(avant) || ATTRIBUT.test(avant) || ARBITRAIRE.test(avant) || ARGUMENT.test(avant)) return true;
  if (!chaineSeule) return false;
  const guillemet = texte[debut - 1];
  return ['"', "'", '`'].includes(guillemet) && texte[fin] === guillemet && !ANCRE.test(avant.slice(0, -1));
}

// ------------------------------------------------------------
// Conversions de couleur vers sRGB (0-255, ramene dans la gamme)
// ------------------------------------------------------------
const borner = (v, min, max) => Math.min(max, Math.max(min, v));
const versLineaire = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const depuisLineaire = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const rvb255 = (lin) => lin.map((c) => Math.round(borner(depuisLineaire(borner(c, 0, 1)), 0, 1) * 255));

function oklabVersLineaire(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
function xyzD65VersLineaire(x, y, z) {
  return [
    3.2409699419 * x - 1.5373831776 * y - 0.4986107603 * z,
    -0.9692436363 * x + 1.8759675015 * y + 0.0415550574 * z,
    0.0556300797 * x - 0.2039769589 * y + 1.0569715142 * z,
  ];
}
function xyzD50VersD65(x, y, z) {
  return [
    0.9554734527 * x - 0.0230985369 * y + 0.0632593086 * z,
    -0.0283697094 * x + 1.0099954580 * y + 0.0210413990 * z,
    0.0123140016 * x - 0.0205076964 * y + 1.3303659366 * z,
  ];
}
function labVersLineaire(L, a, b) {
  const k = 24389 / 27;
  const e = 216 / 24389;
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const x = fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k;
  const y = L > k * e ? fy ** 3 : L / k;
  const z = fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k;
  return xyzD65VersLineaire(...xyzD50VersD65(x * 0.3457 / 0.3585, y, z * (1 - 0.3457 - 0.3585) / 0.3585));
}
function p3VersLineaire(r, g, b) {
  const [lr, lg, lb] = [r, g, b].map(versLineaire);
  const x = 0.4865709486 * lr + 0.2656676932 * lg + 0.1982172852 * lb;
  const y = 0.2289745641 * lr + 0.6917385218 * lg + 0.0792869141 * lb;
  const z = 0.0451133819 * lg + 1.0439443689 * lb;
  return xyzD65VersLineaire(x, y, z);
}
function hslVersRvb(h, s, l) {
  const t = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((t / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = t < 60 ? [c, x, 0] : t < 120 ? [x, c, 0] : t < 180 ? [0, c, x] : t < 240 ? [0, x, c] : t < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m].map((v) => Math.round(borner(v, 0, 1) * 255));
}

/** Chroma OKLCH d'une couleur sRGB 0-255. */
function chroma(r, g, b) {
  const [lr, lg, lb] = [r, g, b].map((v) => versLineaire(v / 255));
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return Math.hypot(a, bb);
}

/** Teinte TSL (degres) d'une couleur sRGB 0-255, ou null pour un gris (chroma OKLCH sous le seuil). */
function teinte(r, g, b) {
  if (chroma(r, g, b) < CHROMA_GRIS) return null;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return null;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

const dansLaPlage = (h) => h !== null && h >= TEINTE_MIN && h <= TEINTE_MAX;

function hexVersRvb(hex) {
  const n = hex.length;
  if (n === 3 || n === 4) return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16));
  if (n === 6 || n === 8) return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return null;
}

/** Composante numerique d'une fonction de couleur : nombre, pourcentage (rapporte a `cent`), angle, ou none. */
function lire(jeton, cent = 100) {
  if (jeton === undefined) return NaN;
  if (/^none$/i.test(jeton)) return 0;
  const m = jeton.match(/^(-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?)(%|deg|rad|grad|turn)?$/i);
  if (!m) return NaN;
  const v = parseFloat(m[1]);
  switch ((m[2] ?? '').toLowerCase()) {
    case '%':
      return (v / 100) * cent;
    case 'rad':
      return (v * 180) / Math.PI;
    case 'grad':
      return v * 0.9;
    case 'turn':
      return v * 360;
    default:
      return v;
  }
}

/** sRGB 0-255 d'une fonction de couleur, ou null si elle ne se calcule pas (var(), syntaxe relative, espace inconnu). */
function fonctionVersRvb(nom, args) {
  const j = args.trim().split(/[\s,_/]+/).filter(Boolean);
  if (j.length < 3 || /^from$/i.test(j[0])) return null;
  const n = nom.toLowerCase();
  let rvb = null;
  if (n === 'rgb' || n === 'rgba') rvb = [0, 1, 2].map((i) => Math.round(borner(lire(j[i], 255), 0, 255)));
  else if (n === 'hsl' || n === 'hsla') rvb = hslVersRvb(lire(j[0]), lire(j[1], 1) / (j[1]?.endsWith('%') ? 1 : 100), lire(j[2], 1) / (j[2]?.endsWith('%') ? 1 : 100));
  else if (n === 'hwb') {
    let w = lire(j[1], 1);
    let bk = lire(j[2], 1);
    if (!j[1]?.endsWith('%')) w /= 100;
    if (!j[2]?.endsWith('%')) bk /= 100;
    if (w + bk >= 1) return [128, 128, 128];
    rvb = hslVersRvb(lire(j[0]), 1, 0.5).map((v) => Math.round((v / 255) * (1 - w - bk) * 255 + w * 255));
  } else if (n === 'lab') rvb = rvb255(labVersLineaire(lire(j[0]), lire(j[1], 125), lire(j[2], 125)));
  else if (n === 'lch') {
    const h = (lire(j[2]) * Math.PI) / 180;
    const c = lire(j[1], 150);
    rvb = rvb255(labVersLineaire(lire(j[0]), c * Math.cos(h), c * Math.sin(h)));
  } else if (n === 'oklab') rvb = rvb255(oklabVersLineaire(lire(j[0], 1), lire(j[1], 0.4), lire(j[2], 0.4)));
  else if (n === 'oklch') {
    const h = (lire(j[2]) * Math.PI) / 180;
    const c = lire(j[1], 0.4);
    rvb = rvb255(oklabVersLineaire(lire(j[0], 1), c * Math.cos(h), c * Math.sin(h)));
  } else if (n === 'color') {
    const espace = j[0].toLowerCase();
    const v = j.slice(1, 4).map((x) => lire(x, 1));
    if (espace === 'srgb' || espace === 'a98-rgb' || espace === 'prophoto-rgb' || espace === 'rec2020') {
      // Espaces RVB : leurs primaires sont voisines de celles de sRGB, la teinte se lit sur les composantes.
      rvb = v.map((x) => Math.round(borner(x, 0, 1) * 255));
    } else if (espace === 'srgb-linear') rvb = rvb255(v);
    else if (espace === 'display-p3') rvb = rvb255(p3VersLineaire(...v));
    else if (espace === 'xyz' || espace === 'xyz-d65') rvb = rvb255(xyzD65VersLineaire(...v));
    else if (espace === 'xyz-d50') rvb = rvb255(xyzD65VersLineaire(...xyzD50VersD65(...v)));
    else return null;
  }
  return rvb && rvb.every(Number.isFinite) ? rvb : null;
}

const NOMMEES_BLEUES = Object.entries(NOMMEES)
  .filter(([, hex]) => dansLaPlage(teinte(...hexVersRvb(hex))))
  .map(([nom]) => nom);
// Le souligne reste admis autour du nom (valeur arbitraire Tailwind : color-mix(in_srgb,blue_60%,white)).
const NOMMEE = new RegExp(`(?<![0-9A-Za-z\\-/.#$@])(${NOMMEES_BLEUES.join('|')})(?![0-9A-Za-z\\-./(])`, 'gi');

// ------------------------------------------------------------
// (c) Police mono
// ------------------------------------------------------------
// `--font-mono: initial` retire la police mono du theme Tailwind : c'est le contraire d'un emploi, il n'est pas signale.
const MONO = new RegExp(
  [
    '(?<![\\w-])font-mono(?![\\w-])',
    '--font-mono(?![\\w-])(?!\\s*:\\s*initial\\b)',
    'IBM[ _]Plex',
    '(?<![\\w-])Plex(?![\\w])',
    'plex-mono',
    '(?<![\\w-])(?:ui-)?monospace(?![\\w-])',
    'Courier(?: New)?',
    'Consolas',
    'Menlo',
    'SF ?Mono',
    'SFMono',
    'Fira[ _](?:Code|Mono)',
    'JetBrains[ _]Mono',
    'Source[ _]Code[ _]Pro',
    'Cascadia[ _](?:Code|Mono)',
    'Lucida[ _]Console',
    'Inconsolata',
    '(?<![\\w-])[A-Z][A-Za-z]*[ _]Mono(?![\\w-])',
  ].join('|'),
  'g',
);
const BALISE_MONO = /<(?:code|pre|kbd|samp|tt)(?=[\s>/])/g;

// ------------------------------------------------------------
// (d) Emojis
// ------------------------------------------------------------
const PICTO = '[\\p{Extended_Pictographic}\\p{Emoji_Presentation}\\u{1F000}-\\u{1FAFF}]';
const EMOJI = new RegExp(`[\\u{1F1E6}-\\u{1F1FF}]{2}|${PICTO}\\uFE0F?(?:\\u200D${PICTO}\\uFE0F?)*|[\\uFE0F\\u20E3]+`, 'gu');
/** Signes typographiques toleres quand ils ne portent pas le selecteur d'emoji U+FE0F. */
const TOLERES = new Set(['\u2713', '\u26A0', '\u2197', '\u25B8', '\u25BE', '\u00A9', '\u00AE', '\u2122']);

const codes = (s) => [...s].map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase()}`).join(' ');

/** Violations d'un texte : liste de { ligne, colonne, type, extrait }, dans l'ordre du texte. */
export function analyser(texte) {
  const debuts = [0];
  for (let i = 0; i < texte.length; i++) if (texte[i] === '\n') debuts.push(i + 1);
  const position = (index) => {
    let bas = 0;
    let haut = debuts.length - 1;
    while (bas < haut) {
      const milieu = (bas + haut + 1) >> 1;
      if (debuts[milieu] <= index) bas = milieu;
      else haut = milieu - 1;
    }
    return { ligne: bas + 1, colonne: index - debuts[bas] + 1 };
  };
  const violations = [];
  const noter = (type, index, extrait) => violations.push({ ...position(index), type, extrait, index });

  for (const m of texte.matchAll(TIRETS)) {
    noter('tiret cadratin', m.index, `${codes(m[0])} : ${texte.slice(Math.max(0, m.index - 20), m.index + 20).replace(/\s+/g, ' ').trim()}`);
  }
  for (const m of texte.matchAll(TIRETS_ECRITS)) noter('tiret cadratin', m.index, m[0]);

  for (const m of texte.matchAll(CLASSE_BLEUE)) noter('bleu ou violet (classe Tailwind)', m.index, m[0]);
  for (const m of texte.matchAll(VARIABLE_BLEUE)) noter('bleu ou violet (variable Tailwind)', m.index, m[0]);
  for (const m of texte.matchAll(HEX)) {
    const rvb = hexVersRvb(m[1]);
    if (!rvb) continue;
    const h = teinte(...rvb);
    if (dansLaPlage(h) && enContexteDeCouleur(texte, m.index, m.index + m[0].length, true)) {
      noter(`bleu ou violet (couleur ${m[0]}, teinte ${Math.round(h)} degres)`, m.index, m[0]);
    }
  }
  for (const m of texte.matchAll(FONCTION)) {
    const rvb = fonctionVersRvb(m[1], m[2]);
    if (!rvb) continue;
    const h = teinte(...rvb);
    const nom = m[1].toLowerCase().replace(/a$/, '').replace(/^hsl$/, 'hsl').replace(/^color$/, 'color()');
    if (dansLaPlage(h)) noter(`bleu ou violet (${nom}, teinte ${Math.round(h)} degres)`, m.index, m[0]);
  }
  for (const m of texte.matchAll(NOMMEE)) {
    if (!enContexteDeCouleur(texte, m.index, m.index + m[0].length, false)) continue;
    const h = teinte(...hexVersRvb(NOMMEES[m[1].toLowerCase()]));
    noter(`bleu ou violet (couleur nommee ${m[1].toLowerCase()}, teinte ${Math.round(h)} degres)`, m.index, m[0]);
  }

  for (const m of texte.matchAll(MONO)) noter('police mono', m.index, m[0]);
  for (const m of texte.matchAll(BALISE_MONO)) noter('police mono', m.index, `${m[0]}> (rendu en mono par le navigateur)`);

  for (const m of texte.matchAll(EMOJI)) {
    if (TOLERES.has(m[0])) continue;
    noter('emoji', m.index, codes(m[0]));
  }

  return violations.sort((a, b) => a.index - b.index).map(({ index, ...v }) => v);
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
      const famille = v.type.split(' (')[0];
      parType.set(famille, (parType.get(famille) ?? 0) + 1);
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
  // Chaque chaine fautive doit produire exactement les types attendus, dans l'ordre ; chaque chaine propre, aucun.
  // Les cas vont par paires : une violation et son jumeau propre.
  const fautifs = [
    // (a) tiret cadratin et ses ecritures
    ['Un dossier \u2014 deux phrases', ['tiret cadratin']],
    ['Un titre \u2015 barre horizontale', ['tiret cadratin']],
    ['<p>A &mdash; B</p>', ['tiret cadratin']],
    ['<p>A &#8212; B</p>', ['tiret cadratin']],
    ['<p>A &#x2014; B</p>', ['tiret cadratin']],
    ['<p>A &#X02015; B &horbar; C</p>', ['tiret cadratin', 'tiret cadratin']],
    ["const s = 'A \\u2014 B';", ['tiret cadratin']],
    ["{'\\u{2014}'}", ['tiret cadratin']],
    ['content: "\\2014";', ['tiret cadratin']],
    // (b) classes Tailwind, toutes racines de couleur de Tailwind 4
    ['<p className="text-blue-600">', ['bleu ou violet (classe Tailwind)']],
    ['className="hover:bg-indigo-50 ring-violet-400/50"', ['bleu ou violet (classe Tailwind)', 'bleu ou violet (classe Tailwind)']],
    ['className="from-purple-500 to-sky-300"', ['bleu ou violet (classe Tailwind)', 'bleu ou violet (classe Tailwind)']],
    ['className="md:hover:bg-sky-400/[.35] bg-blue-500!"', ['bleu ou violet (classe Tailwind)', 'bleu ou violet (classe Tailwind)']],
    ['className="drop-shadow-blue-500 inset-shadow-indigo-400"', ['bleu ou violet (classe Tailwind)', 'bleu ou violet (classe Tailwind)']],
    ['className="inset-ring-violet-500 text-shadow-purple-500"', ['bleu ou violet (classe Tailwind)', 'bleu ou violet (classe Tailwind)']],
    ['className="mask-b-from-sky-300 border-bs-blue-500"', ['bleu ou violet (classe Tailwind)', 'bleu ou violet (classe Tailwind)']],
    ['--color-fuchsia: red;', ['bleu ou violet (variable Tailwind)']],
    // (b) hexadecimal en contexte de couleur
    ['color: #3B82F6;', ['bleu ou violet (couleur #3B82F6, teinte 217 degres)']],
    ['shadow-[0_0_0_2px_#7c3aed]', ['bleu ou violet (couleur #7c3aed, teinte 262 degres)']],
    ['fill="#00f"', ['bleu ou violet (couleur #00f, teinte 240 degres)']],
    ["style={{ borderColor: '#3b82f6' }}", ['bleu ou violet (couleur #3b82f6, teinte 217 degres)']],
    ["const BLEU = '#3b82f6';", ['bleu ou violet (couleur #3b82f6, teinte 217 degres)']],
    ["const fond = 'linear-gradient(#fff, #7c3aed)';", ['bleu ou violet (couleur #7c3aed, teinte 262 degres)']],
    ['color: #F0F8FF;', ['bleu ou violet (couleur #F0F8FF, teinte 208 degres)']],
    // (b) fonctions de couleur, toutes syntaxes
    ['background: rgb(124, 58, 237);', ['bleu ou violet (rgb, teinte 262 degres)']],
    ['color: rgba(14 165 233 / 0.5)', ['bleu ou violet (rgb, teinte 199 degres)']],
    ['className="bg-[rgb(59_130_246)]"', ['bleu ou violet (rgb, teinte 217 degres)']],
    ['className="border-[color:rgb(124_58_237)]"', ['bleu ou violet (rgb, teinte 262 degres)']],
    ['color: hsl(250 80% 50%)', ['bleu ou violet (hsl, teinte 250 degres)']],
    ['color: hsla(0.75turn, 60%, 40%, 1)', ['bleu ou violet (hsl, teinte 270 degres)']],
    ['className="text-[hsl(220_90%_56%)]"', ['bleu ou violet (hsl, teinte 220 degres)']],
    ['color: hwb(240 10% 10%);', ['bleu ou violet (hwb, teinte 240 degres)']],
    ['color: oklch(0.62 0.19 259);', ['bleu ou violet (oklch, teinte 216 degres)']],
    ['className="bg-[oklch(62.3%_0.214_259.815)]"', ['bleu ou violet (oklch, teinte 216 degres)']],
    ['color: oklab(0.55 -0.03 -0.2);', ['bleu ou violet (oklab, teinte 219 degres)']],
    ['color: lch(50% 60 280);', ['bleu ou violet (lch, teinte 221 degres)']],
    ['color: lab(40 30 -70);', ['bleu ou violet (lab, teinte 237 degres)']],
    ['color: color(display-p3 0.2 0.3 0.9);', ['bleu ou violet (color(), teinte 230 degres)']],
    // (b) couleurs nommees en contexte de couleur
    ['color: blue;', ['bleu ou violet (couleur nommee blue, teinte 240 degres)']],
    ['style={{ color: "purple" }}', ['bleu ou violet (couleur nommee purple, teinte 300 degres)']],
    ['<rect fill="navy" />', ['bleu ou violet (couleur nommee navy, teinte 240 degres)']],
    ['className="bg-[blue]"', ['bleu ou violet (couleur nommee blue, teinte 240 degres)']],
    ['background: rebeccapurple;', ['bleu ou violet (couleur nommee rebeccapurple, teinte 270 degres)']],
    ['color: color-mix(in srgb, blue 60%, white);', ['bleu ou violet (couleur nommee blue, teinte 240 degres)']],
    ['className="bg-[color-mix(in_srgb,Indigo_40%,white)]"', ['bleu ou violet (couleur nommee indigo, teinte 275 degres)']],
    // (c) police mono
    ['<span className="font-mono">', ['police mono']],
    ["import { IBM_Plex_Mono } from 'next/font/google';", ['police mono']],
    ['font-family: "IBM Plex Mono";', ['police mono']],
    ['font-family: var(--font-plex-mono);', ['police mono']],
    ['--font-mono: ui-monospace;', ['police mono', 'police mono']],
    ['font-family: ui-monospace, monospace;', ['police mono', 'police mono']],
    ['className="font-[monospace]"', ['police mono']],
    ["style={{ fontFamily: 'Courier New' }}", ['police mono']],
    ["import { Geist_Mono } from 'next/font/google';", ['police mono']],
    ['<code>SIREN</code>', ['police mono']],
    ['<pre className="x">', ['police mono']],
    // (d) emojis
    ['Bravo \u{1F389} !', ['emoji']],
    ['Super \u{1F44D}', ['emoji']],
    ['Valide \u2705', ['emoji']],
    ['Refus \u274C', ['emoji']],
    ['Bravo \u2728', ['emoji']],
    ['Top \u2B50', ['emoji']],
    ['Merci \u2764\uFE0F', ['emoji']],
    ['Attention \u26A0\uFE0F', ['emoji']],
    ['Coche \u2713\uFE0F', ['emoji']],
    ['Note 1\uFE0F\u20E3', ['emoji']],
    ['France \u{1F1EB}\u{1F1F7}', ['emoji']],
    ['Equipe \u{1F468}\u200D\u{1F469}\u200D\u{1F467}', ['emoji']],
  ];
  const propres = [
    // (a)
    'Un dossier, deux phrases ; une virgule ou deux points : rien a signaler.',
    'De 0,05 \u2013 0,60 % (tiret demi-cadratin admis)',
    '<p>A &ndash; B &#8211; C &#x2013; D</p>',
    "const s = 'A \\u2013 B'; const code = '\\u20140';",
    // (b) classes et variables du projet
    'className="bg-orange-deep text-white hover:bg-orange-deeper"',
    'className="text-turquoise-deep bg-turquoise-soft border-filet"',
    'className="bg-navy text-paper ring-cobalt-soft"',
    'className="mask-b-from-orange drop-shadow-orange/40 inset-ring-filet"',
    '--navy: var(--encre); --color-navy: var(--navy);',
    // (b) hexadecimal : couleurs de la charte, gris, ancres et identifiants
    '--orange: #E84E1B; --turquoise: #5E9F92; --encre: #0F1E1B; --lin: #E6EFEC;',
    '--or: #F9B233; --rouge: #BC1723; --vert-clair: #A3D1C8; --texte: #1A1A1A; --blanc: #FFF;',
    'background: #F8F8F9; border-color: rgb(250, 250, 252); /* gris, chroma d arrondi */',
    'color: #F8F9FB; /* gris bleute tres pale : chroma OKLCH 0,003 */',
    '// gris bleute tres pale #F8F9FB',
    '<a href="#principe">Le principe</a> <a href="#cpf">CPF</a>',
    '<a href="#bad">ancre</a> <a href="#decade">ancre</a>',
    "<Link href={'#bad'}>ancre</Link> document.querySelector('#bad'); router.push('#decade');",
    "const lien = { href: '#bad', label: 'Haut' };",
    'const id = "#face";',
    '// IDCC #1486, voir le ticket #123',
    'a[href="#bad"] { text-decoration: underline; }',
    // (b) fonctions de couleur hors du bleu, gris
    'color: rgb(232, 78, 27); background: rgba(0, 0, 0, 0.1); color: hsl(15 82% 51%);',
    'className="bg-[rgb(232_78_27)] text-[hsl(15_82%_51%)]"',
    'color: hsl(220 0% 50%); /* gris : saturation nulle */',
    'color: hwb(15 10% 10%); color: hwb(240 60% 40%); /* le second est un gris */',
    'color: oklch(0.65 0.07 180); background: oklch(0.98 0.003 250);',
    'color: oklab(0.6 0.1 0.08); color: lch(60% 40 40); color: lab(55 40 40);',
    'color: color(display-p3 0.9 0.3 0.1); color: rgb(from var(--x) r g b); color: oklch(var(--l) 0.2 260);',
    // (b) couleurs nommees hors contexte ou hors du bleu
    '<p>Le violet et le bleu ne font plus partie de la charte.</p>',
    "const tone = 'violet'; const indigo = 2;",
    'color: orange; background: turquoise; border-color: white;',
    'background: url(/images/blue.png); /* le nom du fichier n est pas une couleur */',
    '/* aucun bleu : color: var(--navy) */',
    // (c)
    '--font-mono: initial; /* retrait de la police mono du theme */',
    'Le Plexiglas est complexe ; Monoprix ; un mono-entreprise.',
    "<p>Un code postal</p> const code = '75001';",
    '<span className="font-display">',
    // (d)
    'Une demande complexe, un dossier complexe.',
    'Signes typographiques tol\u00e9r\u00e9s : \u2713 \u26A0 \u2197 \u25B8 \u25BE',
    '\u00A9 SFG D\u00e9veloppement, Marque\u00AE, Nom\u2122',
    'Fl\u00e8ches \u2192 \u2190 \u00b7 puces \u2022',
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
      console.log(`ECART (faux positif) : ${JSON.stringify(texte)}\n  obtenu : ${JSON.stringify(trouves.map((v) => `${v.type} ${v.extrait}`))}`);
    }
  }
  // Numerotation des lignes et colonnes sur un texte de plusieurs lignes, et declaration CSS sur plusieurs lignes.
  const multi = analyser('ligne propre\r\nfont-mono ici\nfin \u2014 la\n.x {\n  background: linear-gradient(\n    #3b82f6 0%,\n    #fff 100%\n  );\n}');
  const positions = multi.map((v) => `${v.ligne}:${v.colonne}`).join(' ');
  if (positions !== '2:1 3:5 6:5') {
    ecarts += 1;
    console.log(`ECART (positions) : attendu "2:1 3:5 6:5", obtenu "${positions}"`);
  }

  const total = fautifs.length + propres.length + 1;
  if (ecarts > 0) {
    console.log(`\nAutotest de la garde de charte : ${ecarts} ecart(s) sur ${total} cas.`);
    return 1;
  }
  console.log(`Autotest de la garde de charte : ${total} cas, tous conformes (${fautifs.length} violations detectees, ${propres.length} textes propres non signales, positions exactes).`);
  return 0;
}

// Execute seulement en ligne de commande : un import (autotest externe, mutants) n'analyse pas le site.
const lance = process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (lance) process.exitCode = process.argv.includes('--self-test') ? autotest() : verifierLeSite();
