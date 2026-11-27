#!/usr/bin/env node
// ============================================================
// Garde de la charte financementopco pour le site : Node seul, sans dependance.
//
// Charte du site depuis novembre 2026 : kit d'identite financementopco (piste "l'attestation"). Papier #F4F1E9,
// papier fonce #EAE5D8, feuille #FBF9F4, filet #CFC8B8, encre #161C27, ardoise #4A5262, bleu de Prusse #1F3B63 (action,
// liens), surligneur #F1D84B (jamais pour du texte) ; Newsreader (titres), Instrument Sans (texte), DM Mono (montants,
// sources, reperes). L'ancienne charte SFG (orange, turquoise, or, vert clair ; Montserrat et Inter) est abandonnee pour
// ce site : la garde en traque les restes. Guide : apps/web/DESIGN.md.
//
// Perimetre de `npm run check:charte` : le code du site (apps/web/src, toutes les regles ci-dessous), ses tests
// (apps/web/tests : tirets et emojis, ecritures comprises) et son guide de design (apps/web/DESIGN.md : tirets et
// emojis ecrits tels quels, le guide citant en exemple des classes, des couleurs et des ecritures interdites).
// `npm run check:tirets` (option --tirets) lit tous les fichiers texte suivis du depot (git ls-files : .ts .tsx .js
// .mjs .cjs .json .md .yml .yaml .css .txt, hors donnees JSON de datasets/ et de packages/core/data/) et n'y cherche
// que les tirets cadratins ecrits tels quels.
//
// Signale, avec fichier, ligne et colonne :
//   (a) le tiret cadratin et ses variantes : U+2014, U+2015 (barre horizontale), U+2E3A, U+2E3B, U+FE31 (forme
//       verticale), U+FE58, ecrits tels quels ou sous forme d'entite HTML (&mdash; &horbar; &#8212; &#x2014;),
//       d'echappement JavaScript (\u{2014} et la forme courte a quatre chiffres, suivie ou non d'un chiffre) ou CSS
//       (\2014, de quatre a six chiffres) ;
//   (b) les anciennes couleurs de la charte SFG : orange #E84E1B, #C43F13, #A93510, #FDF0EA, #F56A31, turquoise
//       #5E9F92, #3E6860, #EDF5F2, or #F9B233, #FEF4DE, vert clair #A3D1C8, #E6F2EF :
//       - toute couleur egale ou tres proche de l'une d'elles (ecart OKLab inferieur a 0,02, environ un ecart
//         perceptible), sauf si une couleur du kit est plus proche encore : le papier #F4F1E9 n'est qu'a 0,012 de
//         l'ancien #FDF0EA, il reste permis ;
//       - fonctions de couleur : rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch(), color(), separateurs virgule,
//         espace, barre ou souligne, souligne admis devant (valeurs arbitraires Tailwind : bg-[rgb(232_78_27)],
//         shadow-[0_0_0_2px_rgb(232_78_27)]) ; les trois composantes de couleur sont lues, l'alpha est ignore meme
//         calcule (rgb(232 78 27 / var(--a)), calc() et var() imbriques a toute profondeur) ;
//       - hexadecimal et couleurs nommees CSS (linen, oldlace, whitesmoke...) dans un contexte de couleur :
//         declaration CSS ou objet de style, attribut fill / stroke / color, valeur arbitraire Tailwind [...], argument
//         d'un degrade ou de color-mix() ; une chaine qui n'est qu'un hexadecimal compte aussi, sauf comme ancre (href,
//         id, hash, querySelector...), affectee ou comparee (=, ===, !==) : #e84e1b dans un lien, ou
//         location.hash === '#e84e1b', ne sont pas des couleurs ;
//       - classes Tailwind de l'ancienne palette (orange, turquoise, or, vert-clair, lin, et leurs variantes -deep,
//         -soft, -clair, -500...) sur chacun des 49 utilitaires de couleur de Tailwind 4 (bg, text, border-*, ring,
//         inset-ring, shadow, inset-shadow, drop-shadow, text-shadow, mask-*-from/to, etc.), seulement si le jeton
//         n'est plus defini dans apps/web/src/app/globals.css (--color-NOM, lu a chaque passage) : un nom historique
//         qui y reste defini, avec une valeur de la nouvelle charte, est permis ;
//   (c) toute police hors charte. Sont permises Newsreader, Instrument Sans et DM Mono, les replis Georgia, Arial,
//       Helvetica, Menlo et ceux du kit (Helvetica Neue, Times New Roman), les familles generiques serif, sans-serif,
//       monospace, ui-monospace, system-ui et les mots-cles inherit, initial, unset, revert. Toute autre famille
//       nommee dans un contexte de police est signalee : declaration font-family, font (apres la taille) ou propriete
//       personnalisee dont le nom contient font (--font-sans, --fo-font-titre), propriete ou attribut fontFamily,
//       attribut font-family, classe font-[...], repli d'un var(), import de next/font/google. Montserrat, IBM Plex et
//       les variables --font-montserrat, --font-inter, --font-plex... sont signales partout hors commentaires.
//       font-mono et les balises <code>, <pre> sont permises (DM Mono porte les montants) ;
//   (d) les emojis, ecrits tels quels, en entite HTML numerique (&#127881; &#x1F389;), en echappement JavaScript
//       (\u{1F389}, paire de substitution) ou CSS (\1F389) : tout pictogramme (proprietes Unicode
//       Extended_Pictographic et Emoji_Presentation, plage U+1F000 a U+1FAFF, selecteur U+FE0F, touche U+20E3), sauf
//       les signes typographiques toleres sans selecteur U+FE0F : coche U+2713, attention U+26A0, fleche U+2197,
//       triangles U+25B8 et U+25BE, (c) U+00A9, (r) U+00AE, TM U+2122 ;
//   (e) les degrades, dans apps/web/src seulement et hors commentaires : linear-gradient(), radial-gradient(),
//       conic-gradient() et leurs variantes repeating- (prefixe -webkit-, -moz- ou -o- compris), utilitaires Tailwind
//       bg-linear-*, bg-radial*, bg-conic*, bg-gradient-*.
//
// Limites connues : la garde lit le texte source, pas le rendu. Une couleur construite a l'execution (variable,
// concatenation, valeur venue des donnees), un hexadecimal sans contexte de couleur (commentaire, texte), une couleur
// encodee dans une image SVG en data URI (%23e84e1b), une police chargee sous un nom range dans une constante, un
// degrade SVG (<linearGradient>), un emoji en entite nommee (&hearts;), une image ou une icone aux anciennes couleurs
// echappent au controle. A l'inverse, un tiret ou un emoji ecrit dans le code qui le traite (une expression reguliere
// qui retire le tiret d'une donnee) est signale : le construire par String.fromCharCode(0x2014) ou
// String.fromCodePoint(). Les donnees de packages/core sont controlees par packages/core/tests/charte-sfg.test.ts.
//
// Usage : node scripts/check-charte-sfg.mjs [--self-test | --tirets]
// Code de sortie 1 s'il y a au moins une violation (ou un ecart dans l'autotest), 2 si git ls-files echoue (--tirets).
// ============================================================

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER = join(RACINE, 'apps', 'web', 'src');
const EXTENSIONS = new Set(['.ts', '.tsx', '.css']);
const TESTS_DU_SITE = join(RACINE, 'apps', 'web', 'tests');
const GUIDE_DU_SITE = join(RACINE, 'apps', 'web', 'DESIGN.md');
/** Feuille globale du site : ses jetons --color-* disent quelles classes de couleur existent. */
const FEUILLE_GLOBALE = join(DOSSIER, 'app', 'globals.css');

// ------------------------------------------------------------
// (a) Tiret cadratin et variantes
// ------------------------------------------------------------
const TIRETS = /[\u2014\u2015\u2E3A\u2E3B\uFE31\uFE58]/g;
const CODES_TIRET = '2014|2015|2[eE]3[aAbB]|[fF][eE]31|[fF][eE]58';
const TIRETS_ECRITS = new RegExp(
  [
    '&(?:mdash|horbar);',
    '&#0*(?:8212|8213|11834|11835|65073|65112);',
    `&#[xX]0*(?:${CODES_TIRET});`,
    // \u prend exactement quatre chiffres (un cinquieme chiffre est un caractere a part), \u{...} est borne par ses
    // accolades.
    `\\\\u(?:${CODES_TIRET})`,
    `\\\\u\\{0*(?:${CODES_TIRET})\\}`,
    // CSS : un chiffre qui suit prolonge l'echappement jusqu'a six chiffres (\20140 est U+20140), pas au-dela.
    `\\\\(?:00(?:${CODES_TIRET})|0?(?:${CODES_TIRET})(?![0-9a-fA-F]))`,
  ].join('|'),
  'g',
);

// ------------------------------------------------------------
// (b) Anciennes couleurs de la charte SFG
// ------------------------------------------------------------
/** Anciennes couleurs de la charte SFG, abandonnees pour ce site : nom du jeton historique et valeur. */
const ANCIENNES = [
  ['orange', 'E84E1B'],
  ['orange-deep', 'C43F13'],
  ['orange-deeper', 'A93510'],
  ['orange-soft', 'FDF0EA'],
  ['orange-clair', 'F56A31'],
  ['turquoise', '5E9F92'],
  ['turquoise-deep', '3E6860'],
  ['turquoise-soft', 'EDF5F2'],
  ['or', 'F9B233'],
  ['or-soft', 'FEF4DE'],
  ['vert-clair', 'A3D1C8'],
  ['vert-clair-soft', 'E6F2EF'],
];
/**
 * Couleurs du kit financementopco (integration/styles/tokens.css). Une couleur plus proche de l'une d'elles que de
 * toute ancienne couleur n'est pas signalee : le papier #F4F1E9 est a 0,012 de l'ancien orange doux #FDF0EA.
 */
const CHARTE = [
  ['papier', 'F4F1E9'],
  ['papier-fonce', 'EAE5D8'],
  ['feuille', 'FBF9F4'],
  ['filet', 'CFC8B8'],
  ['filet-fonce', 'B9B2A2'],
  ['pointilles', 'A9A293'],
  ['ombre-feuille', 'E4DED0'],
  ['encre', '161C27'],
  ['ardoise', '4A5262'],
  ['prusse', '1F3B63'],
  ['prusse-fonce', '172D4C'],
  ['surligneur', 'F1D84B'],
  ['bleu-clair', 'B9C8DE'],
  ['texte-sur-prusse', 'D6DEEA'],
  ['texte-sur-encre', 'B9BFCA'],
  ['filet-sur-encre', '2E3647'],
];
/** Ecart OKLab en dessous duquel une couleur est l'ancienne (un ecart perceptible vaut environ 0,02). */
const ECART_MAX = 0.02;

// Familles de l'ancienne palette Tailwind du site ; leurs variantes (-deep, -soft, -clair, -500...) suivent.
const FAMILLES_ANCIENNES = 'orange|or|turquoise|vert-clair|lin';
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
/** Classe de l'ancienne palette ; le groupe 1 est le nom du jeton (orange-deep), sans modificateur d'opacite. */
const CLASSE_ANCIENNE = new RegExp(
  `(?<![\\w-])(?:${RACINES_COULEUR})-((?:${FAMILLES_ANCIENNES})(?:-[a-z0-9]+)*)(?:\\/[^\\s"'\`]+)?(?![\\w-])`,
  'g',
);
// Le souligne separe les mots dans les valeurs arbitraires Tailwind (shadow-[0_0_0_2px_#c43f13]) : il reste admis autour.
const HEX = /(?<![0-9A-Za-z&#-])#([0-9a-fA-F]{3,8})(?![0-9A-Za-z-])/g;
// Fonctions de couleur : rgb() rgba() hsl() hsla() hwb() lab() lch() oklab() oklch() color(). Le souligne reste admis
// devant dans une valeur arbitraire Tailwind (shadow-[0_0_0_2px_rgb(232_78_27)], verifie dans analyser()) ; une
// lettre, un chiffre, un point, un dollar ou un tiret devant en font un identifiant (toRgb(), theme.rgb()). L'argument
// est lu par argumentDe(), var() et calc() imbriques compris.
const FONCTION = /(?<![A-Za-z0-9.$-])(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;

/**
 * Fermante de chaque parenthese ouvrante d'un texte (index de la fermante, -1 faute de fermante), en un seul passage :
 * la recherche est lineaire. Relire le texte depuis chaque fonction de couleur non refermee prenait 9 s pour 1 000
 * "rgb(" devant 490 000 caracteres.
 */
function fermantes(texte) {
  const fin = new Int32Array(texte.length).fill(-1);
  const ouvertes = [];
  for (let i = 0; i < texte.length; i++) {
    const c = texte.charCodeAt(i);
    if (c === 40) ouvertes.push(i);
    else if (c === 41 && ouvertes.length > 0) fin[ouvertes.pop()] = i;
  }
  return fin;
}

/**
 * Texte entre une parenthese ouvrante (`debut` : l'index qui la suit) et sa fermante, ou null faute de fermante ; `fins`
 * est le resultat de fermantes(texte).
 */
function argumentDe(texte, debut, fins) {
  const fin = fins[debut - 1];
  return fin === -1 ? null : texte.slice(debut, fin);
}

// Couleurs nommees CSS (CSS Color 4), avec leur valeur ; seules celles qui tombent sur une ancienne couleur sont
// recherchees.
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
/**
 * Une chaine "#abc" employee comme ancre ou selecteur, pas comme couleur : affectee ou comparee (===, !==, ==, !=), ou
 * passee a une fonction de lien ou de selection (querySelector, new URL...).
 */
const ANCRE = /(?:(?:^|[^\w-])(?:href|to|id|htmlFor|for|name|hash|target|aria-[\w-]+|xlinkHref|xlink:href)\s*(?:[!=]==?|[=:])\s*\{?\s*|(?:querySelector(?:All)?|getElementById|closest|matches|scrollIntoView|push|replace|scrollTo|startsWith|endsWith|includes|new\s+URL)\(\s*)$/;
/** url(#id) designe un element de la page (masque, filtre, degrade SVG) par son identifiant : ce n'est pas une couleur. */
const REFERENCE_URL = /url\(\s*["']?$/i;

function enContexteDeCouleur(texte, debut, fin, chaineSeule) {
  const avant = texte.slice(Math.max(0, debut - 400), debut);
  if (REFERENCE_URL.test(avant)) return false;
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

/** Coordonnees OKLab [L, a, b] d'une couleur sRGB 0-255. */
function versOklab(r, g, b) {
  const [lr, lg, lb] = [r, g, b].map((v) => versLineaire(v / 255));
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

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

/**
 * sRGB 0-255 d'une fonction de couleur, ou null si elle ne se calcule pas (var() ou calc() dans une composante, syntaxe
 * relative, espace inconnu). Seules les trois composantes de couleur sont lues : l'alpha, meme calcule, est ignore.
 */
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

const REFERENCES = [
  ...ANCIENNES.map(([nom, hex]) => ({ nom, hex, ancienne: true, lab: versOklab(...hexVersRvb(hex)) })),
  ...CHARTE.map(([nom, hex]) => ({ nom, hex, ancienne: false, lab: versOklab(...hexVersRvb(hex)) })),
];

/**
 * Ancienne couleur la plus proche d'une couleur sRGB 0-255 ({ nom, hex, ecart }), ou null : si l'ecart OKLab atteint
 * 0,02, ou si une couleur du kit est plus proche encore.
 */
export function ancienneProche(rvb) {
  const [L, a, b] = versOklab(...rvb);
  let proche = null;
  let ecart = Infinity;
  for (const reference of REFERENCES) {
    const e = Math.hypot(L - reference.lab[0], a - reference.lab[1], b - reference.lab[2]);
    if (e < ecart) {
      ecart = e;
      proche = reference;
    }
  }
  return proche.ancienne && ecart < ECART_MAX ? { nom: proche.nom, hex: proche.hex, ecart } : null;
}

/** Type d'une violation de couleur : la source lue, puis l'ancienne couleur, exacte ou approchee (ecart a 0,001 pres). */
function typeDeCouleur(source, proche) {
  const cible = `${proche.nom} #${proche.hex}`;
  const ecart = proche.ecart.toFixed(3).replace('.', ',');
  return `ancienne couleur SFG (${source} : ${proche.ecart < 0.0005 ? cible : `proche de ${cible}, ecart ${ecart}`})`;
}

const NOMMEES_ANCIENNES = Object.entries(NOMMEES)
  .filter(([, hex]) => ancienneProche(hexVersRvb(hex)) !== null)
  .map(([nom]) => nom);
// Le souligne reste admis autour du nom (valeur arbitraire Tailwind : color-mix(in_srgb,linen_60%,white)).
const NOMMEE =
  NOMMEES_ANCIENNES.length > 0
    ? new RegExp(`(?<![0-9A-Za-z\\-/.#$@])(${NOMMEES_ANCIENNES.join('|')})(?![0-9A-Za-z\\-./(])`, 'gi')
    : null;

/** Noms des couleurs du theme definies dans une feuille (--color-NOM: ..., hors commentaires et hors `initial`). */
export function jetonsDe(css) {
  return new Set([...sansCommentaires(css).matchAll(/--color-([a-z0-9][\w-]*)\s*:(?!\s*initial\b)/gi)].map((m) => m[1].toLowerCase()));
}

let jetonsDuSite = null;
/** Jetons de couleur de apps/web/src/app/globals.css, lus une fois par passage (ensemble vide faute de fichier). */
function jetonsDefinis() {
  if (jetonsDuSite === null) {
    try {
      jetonsDuSite = jetonsDe(readFileSync(FEUILLE_GLOBALE, 'utf8'));
    } catch {
      jetonsDuSite = new Set();
    }
  }
  return jetonsDuSite;
}

// ------------------------------------------------------------
// (c) Polices hors charte
// ------------------------------------------------------------
const POLICES_PERMISES = new Set([
  'newsreader',
  'instrument sans',
  'dm mono',
  'georgia',
  'arial',
  'helvetica',
  'menlo',
  // replis du kit (integration/styles/tokens.css)
  'helvetica neue',
  'times new roman',
  // familles generiques et mots-cles globaux
  'serif',
  'sans-serif',
  'monospace',
  'ui-monospace',
  'system-ui',
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
]);
/**
 * Propriete ou attribut de police suivi de son separateur : font-family, fontFamily, font (raccourci), propriete
 * personnalisee dont le nom contient font (--font-sans, --fo-font-titre, --default-font-family).
 */
const PROPRIETE_POLICE = /(?<![\w-])(font-family|fontFamily|font|--[\w-]*font[\w-]*)\s*([:=])\s*(\{\s*)?/g;
/** Proprietes personnalisees de police qui ne portent pas de famille (--font-weight-bold, --font-size...). */
const AUTRE_QUE_FAMILLE = /weight|size|feature|variation|stretch|kerning|synthesis|smoothing|optical|style/;
/** Taille dans le raccourci font (12px/1.5, 1.0625rem, large) : les familles la suivent. */
const TAILLE = /(?:^|\s)(?:\d*\.?\d+(?:px|r?em|pt|pc|%|vw|vh|vmin|vmax|ex|ch|r?lh|cap|q|mm|cm|in)|(?:x{1,3}-)?(?:small|large)|medium|smaller|larger)(?:\s*\/\s*[^\s,]+)?\s+(?=\S)/g;
/** Classe Tailwind de police a valeur arbitraire : font-[Inter], font-['Courier_New'], font-[family-name:...]. */
const CLASSE_POLICE = /(?<![\w-])font-\[([^\]\s]+)\]/g;
const IMPORT_NEXT_FONT = /import\s*\{([^}]*)\}\s*from\s*["']next\/font\/google["']/g;
/** Noms de l'ancienne charte qui ne designent rien d'autre qu'une police : signales partout hors commentaires. */
const ANCIENNE_POLICE = /Montserrat|IBM[ _]Plex|(?<![\w-])Plex(?!\w)|--font-(?:montserrat|inter|plex|ibm)(?![a-z])[\w-]*/g;

/** Elements d'une liste separee par des virgules hors parentheses et guillemets, avec leur index dans le texte. */
function elementsDeListe(liste, base) {
  const elements = [];
  let debut = 0;
  let profondeur = 0;
  let guillemet = null;
  const couper = (fin) => {
    const brut = liste.slice(debut, fin);
    const texte = brut.trim();
    if (texte) elements.push({ texte, index: base + debut + brut.length - brut.trimStart().length });
  };
  for (let i = 0; i < liste.length; i++) {
    const c = liste[i];
    if (guillemet) {
      if (c === guillemet) guillemet = null;
    } else if (c === '"' || c === "'") guillemet = c;
    else if (c === '(') profondeur += 1;
    else if (c === ')') profondeur -= 1;
    else if (c === ',' && profondeur === 0) {
      couper(i);
      debut = i + 1;
    }
  }
  couper(liste.length);
  return elements;
}

/**
 * Familles hors charte d'une liste font-family ({ index, fin, nom }) ; le repli d'un var() est lu, un element qui
 * n'est pas un nom de famille (nombre, fonction, expression) est ignore. Le souligne vaut une espace (Tailwind).
 */
function famillesHorsCharte(liste, base) {
  const trouvees = [];
  for (const { texte, index } of elementsDeListe(liste, base)) {
    const variable = /^var\(\s*--[\w-]+\s*(,[\s\S]*)?\)$/.exec(texte);
    if (variable) {
      if (variable[1]) trouvees.push(...famillesHorsCharte(variable[1].slice(1), index + texte.indexOf(variable[1]) + 1));
      continue;
    }
    const nom = texte.replace(/^["']|["']$/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    if (!/^[A-Za-z][A-Za-z0-9 -]*$/.test(nom)) continue;
    if (!POLICES_PERMISES.has(nom.toLowerCase())) trouvees.push({ index, fin: index + texte.length, nom });
  }
  return trouvees;
}

/** Valeur qui suit un separateur : chaine entre guillemets, ou valeur CSS jusqu'a la fin de la declaration. */
function valeurApres(texte, p) {
  const q = texte[p];
  if (q === '"' || q === "'" || q === '`') {
    let k = p + 1;
    while (k < texte.length && texte[k] !== q && (q === '`' || texte[k] !== '\n')) k += texte[k] === '\\' ? 2 : 1;
    return { valeur: texte.slice(p + 1, k), debut: p + 1, entreGuillemets: true };
  }
  const fin = texte.slice(p).search(/[;{}<>\n]/);
  return { valeur: texte.slice(p, fin === -1 ? texte.length : p + fin), debut: p, entreGuillemets: false };
}

/** Polices hors charte d'un texte sans commentaires : liste de { index, nom }, sans doublon sur un meme passage. */
function policesHorsCharte(texte) {
  const trouvees = [];
  for (const m of texte.matchAll(PROPRIETE_POLICE)) {
    const [, propriete, separateur, accolade] = m;
    if (propriete.startsWith('--') && AUTRE_QUE_FAMILLE.test(propriete)) continue;
    const { valeur, debut, entreGuillemets } = valeurApres(texte, m.index + m[0].length);
    // Hors guillemets, seule une declaration CSS porte une liste de familles ; en JavaScript, c'est une expression
    // (fontFamily: inter.style.fontFamily, const font = Inter({...})).
    if (!entreGuillemets && (separateur === '=' || accolade || propriete === 'fontFamily')) continue;
    if (propriete === 'font') {
      let reste = null;
      for (const taille of valeur.matchAll(TAILLE)) reste = taille.index + taille[0].length;
      if (reste !== null) trouvees.push(...famillesHorsCharte(valeur.slice(reste), debut + reste));
    } else trouvees.push(...famillesHorsCharte(valeur, debut));
  }
  for (const m of texte.matchAll(CLASSE_POLICE)) {
    let contenu = m[1];
    let debut = m.index + 'font-['.length;
    const prefixe = /^family-name:/.exec(contenu);
    if (prefixe) {
      contenu = contenu.slice(prefixe[0].length);
      debut += prefixe[0].length;
    } else if (/^[a-z-]+:/.test(contenu)) continue;
    trouvees.push(...famillesHorsCharte(contenu, debut));
  }
  for (const m of texte.matchAll(IMPORT_NEXT_FONT)) {
    const debutListe = m.index + m[0].indexOf('{') + 1;
    for (const nom of m[1].matchAll(/([A-Za-z]\w*)(?:\s+as\s+\w+)?/g)) {
      const index = debutListe + nom.index;
      if (!POLICES_PERMISES.has(nom[1].replace(/_/g, ' ').toLowerCase())) trouvees.push({ index, fin: index + nom[1].length, nom: nom[1] });
    }
  }
  for (const m of texte.matchAll(ANCIENNE_POLICE)) trouvees.push({ index: m.index, fin: m.index + m[0].length, nom: m[0] });
  // Un meme passage releve par deux voies (font-family: Montserrat, import d'IBM_Plex_Mono) n'est signale qu'une fois.
  const retenues = [];
  for (const t of trouvees) {
    if (!retenues.some((r) => t.index < r.fin && r.index < t.fin)) retenues.push(t);
  }
  return retenues;
}

// Le texte dont les commentaires (// et /* */ de JavaScript, /* */ de CSS, {/* */} de JSX) sont remplaces par des
// espaces : memes index, donc memes lignes et colonnes. Les chaines sont sautees (un // ou un /* dans une chaine
// n'ouvre pas de commentaire) et un // precede de deux-points est une adresse (https://), pas un commentaire.
function sansCommentaires(texte) {
  const sortie = texte.split('');
  let i = 0;
  while (i < texte.length) {
    const c = texte[i];
    if (c === '/' && texte[i + 1] === '*') {
      const fin = texte.indexOf('*/', i + 2);
      const borne = fin === -1 ? texte.length : fin + 2;
      sortie.fill(' ', i, borne);
      i = borne;
    } else if (c === '/' && texte[i + 1] === '/' && texte[i - 1] !== ':') {
      const fin = texte.indexOf('\n', i);
      const borne = fin === -1 ? texte.length : fin;
      sortie.fill(' ', i, borne);
      i = borne;
    } else if (c === '"' || c === "'" || c === '`') {
      // Chaine : jusqu'au meme guillemet non echappe ; ' et " s'arretent aussi a la fin de la ligne.
      let k = i + 1;
      while (k < texte.length && texte[k] !== c && (c === '`' || texte[k] !== '\n')) k += texte[k] === '\\' ? 2 : 1;
      i = k + 1;
    } else i += 1;
  }
  return sortie.join('');
}

// ------------------------------------------------------------
// (e) Degrades
// ------------------------------------------------------------
const DEGRADE = /(?<![\w-])(?:-(?:webkit|moz|o)-)?(?:repeating-)?(?:linear|radial|conic)-gradient\(/gi;
// Utilitaires Tailwind 4 (bg-linear-to-r, bg-radial-[at_25%_25%], bg-conic-180, -bg-linear-45) et 3 (bg-gradient-to-r).
const DEGRADE_TAILWIND = /(?<![\w-])-?bg-(?:linear|radial|conic|gradient)(?![A-Za-z0-9_])[^\s"'`]*/g;

// ------------------------------------------------------------
// (d) Emojis
// ------------------------------------------------------------
const PICTO = '[\\p{Extended_Pictographic}\\p{Emoji_Presentation}\\u{1F000}-\\u{1FAFF}]';
const EMOJI = new RegExp(`[\\u{1F1E6}-\\u{1F1FF}]{2}|${PICTO}\\uFE0F?(?:\\u200D${PICTO}\\uFE0F?)*|[\\uFE0F\\u20E3]+`, 'gu');
/** Signes typographiques toleres quand ils ne portent pas le selecteur d'emoji U+FE0F. */
const TOLERES = new Set(['\u2713', '\u26A0', '\u2197', '\u25B8', '\u25BE', '\u00A9', '\u00AE', '\u2122']);
// Ecritures d'un caractere, decodees avant la recherche des emojis : entite HTML numerique (&#127881; &#x1F389;),
// echappement JavaScript (\u{1F389}, \uD83C\uDF89 : chaque moitie de la paire est decodee et la paire se reforme) ou
// CSS (\1F389, et le blanc qui peut le terminer).
const ECRITURE = /&#(?:[xX]([0-9a-fA-F]{1,6})|(\d{1,7}));|\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})|\\([0-9a-fA-F]{1,6})\s?/g;

/**
 * Le texte, ses ecritures de caracteres decodees (`decode`), et pour chaque unite du texte decode l'index de son
 * ecriture dans le texte d'origine (`origine`, qui finit par la longueur du texte d'origine).
 */
function decoder(texte) {
  const morceaux = [];
  const origine = [];
  let curseur = 0;
  const recopier = (fin) => {
    morceaux.push(texte.slice(curseur, fin));
    for (let i = curseur; i < fin; i++) origine.push(i);
  };
  for (const m of texte.matchAll(ECRITURE)) {
    const [, hexa, decimal, accolades, court, css] = m;
    const code = decimal === undefined ? parseInt(hexa ?? accolades ?? court ?? css, 16) : parseInt(decimal, 10);
    if (code > 0x10ffff) continue;
    recopier(m.index);
    const caractere = String.fromCodePoint(code);
    morceaux.push(caractere);
    for (let k = 0; k < caractere.length; k++) origine.push(m.index);
    curseur = m.index + m[0].length;
  }
  recopier(texte.length);
  origine.push(texte.length);
  return { decode: morceaux.join(''), origine };
}

const codes = (s) => [...s].map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase()}`).join(' ');

/**
 * Regles appliquees selon le perimetre :
 * - toutes : le code du site (apps/web/src), tout est controle ;
 * - tirets-emojis : les tests du site, tirets et emojis seulement, ecritures comprises (entites, echappements) ;
 * - bruts : documents et donnees (guide de design, fixtures JSON), tirets et emojis ecrits tels quels seulement : un
 *   document qui cite &mdash; ou \u{1F389} n'affiche ni tiret ni emoji ;
 * - tirets : le balayage --tirets de tout le depot, tirets ecrits tels quels seulement.
 */
const REGLES = {
  toutes: { couleurs: true, polices: true, degrades: true, emojis: true, ecritures: true },
  'tirets-emojis': { couleurs: false, polices: false, degrades: false, emojis: true, ecritures: true },
  bruts: { couleurs: false, polices: false, degrades: false, emojis: true, ecritures: false },
  tirets: { couleurs: false, polices: false, degrades: false, emojis: false, ecritures: false },
};

/**
 * Violations d'un texte : liste de { ligne, colonne, type, extrait }, dans l'ordre du texte (`regles` : voir REGLES).
 * `jetons` : noms des couleurs du theme (par defaut, ceux de apps/web/src/app/globals.css) ; une classe de l'ancienne
 * palette n'est signalee que si son jeton n'y figure pas.
 */
export function analyser(texte, regles = 'toutes', jetons = null) {
  const r = REGLES[regles];
  if (!r) throw new Error(`Regles inconnues : ${regles}`);
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
  if (r.ecritures) for (const m of texte.matchAll(TIRETS_ECRITS)) noter('tiret cadratin', m.index, m[0]);

  if (r.couleurs) {
    for (const m of texte.matchAll(CLASSE_ANCIENNE)) {
      if (!(jetons ?? jetonsDefinis()).has(m[1])) noter('ancienne couleur SFG (classe Tailwind)', m.index, `${m[0]} (jeton ${m[1]} absent de globals.css)`);
    }
    for (const m of texte.matchAll(HEX)) {
      const rvb = hexVersRvb(m[1]);
      if (!rvb) continue;
      const proche = ancienneProche(rvb);
      if (proche && enContexteDeCouleur(texte, m.index, m.index + m[0].length, true)) {
        noter(typeDeCouleur(`couleur ${m[0]}`, proche), m.index, m[0]);
      }
    }
    let fins = null;
    for (const m of texte.matchAll(FONCTION)) {
      // Un souligne devant ne separe des mots que dans une valeur arbitraire Tailwind ouverte ; ailleurs (to_rgb),
      // c'est un identifiant.
      if (texte[m.index - 1] === '_' && !ARBITRAIRE.test(texte.slice(Math.max(0, m.index - 400), m.index))) continue;
      fins ??= fermantes(texte);
      const args = argumentDe(texte, m.index + m[0].length, fins);
      if (args === null) continue;
      const rvb = fonctionVersRvb(m[1], args);
      if (!rvb) continue;
      const proche = ancienneProche(rvb);
      const nom = m[1].toLowerCase().replace(/a$/, '').replace(/^color$/, 'color()');
      if (proche) noter(typeDeCouleur(nom, proche), m.index, `${m[0]}${args})`);
    }
    if (NOMMEE) {
      for (const m of texte.matchAll(NOMMEE)) {
        if (!enContexteDeCouleur(texte, m.index, m.index + m[0].length, false)) continue;
        const nom = m[1].toLowerCase();
        noter(typeDeCouleur(`couleur nommee ${nom}`, ancienneProche(hexVersRvb(NOMMEES[nom]))), m.index, m[0]);
      }
    }
  }

  // Polices et degrades se lisent hors commentaires : un commentaire qui cite l'ancienne charte n'est pas du rendu.
  const sansNotes = r.polices || r.degrades ? sansCommentaires(texte) : null;
  if (r.polices) for (const p of policesHorsCharte(sansNotes)) noter('police hors charte', p.index, p.nom);
  if (r.degrades) {
    for (const m of sansNotes.matchAll(DEGRADE)) noter('degrade', m.index, m[0].slice(0, -1));
    for (const m of sansNotes.matchAll(DEGRADE_TAILWIND)) noter('degrade', m.index, m[0]);
  }

  if (r.emojis) {
    // Sans les ecritures (documents), le texte est lu tel quel : chaque unite est a sa propre place.
    const { decode, origine } = r.ecritures ? decoder(texte) : { decode: texte, origine: null };
    for (const m of decode.matchAll(EMOJI)) {
      if (TOLERES.has(m[0])) continue;
      const debut = origine ? origine[m.index] : m.index;
      const ecrit = origine ? texte.slice(debut, origine[m.index + m[0].length]) : m[0];
      noter('emoji', debut, ecrit === m[0] ? codes(m[0]) : `${codes(m[0])} (${ecrit})`);
    }
  }

  return violations.sort((a, b) => a.index - b.index).map(({ index, ...v }) => v);
}


function fichiers(dossier, extensions) {
  const resultat = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) resultat.push(...fichiers(chemin, extensions));
    else if (extensions.has(extname(entree.name))) resultat.push(chemin);
  }
  return resultat.sort();
}

/** Chemin relatif a la racine du depot, en barres obliques. */
const relatif = (chemin) => relative(RACINE, chemin).split('\\').join('/');

/**
 * Fichiers controles par `npm run check:charte`, avec leurs regles : le code du site en entier ; ses tests (tirets et
 * emojis, ecritures comprises ; fixtures JSON telles quelles) et son guide de design (caracteres tels quels : il cite en
 * exemple des classes, des couleurs et des ecritures interdites).
 */
function perimetreDuSite() {
  return [
    ...fichiers(DOSSIER, EXTENSIONS).map((chemin) => ({ chemin, regles: 'toutes' })),
    ...fichiers(TESTS_DU_SITE, new Set(['.ts', '.tsx', '.json'])).map((chemin) => ({
      chemin,
      regles: extname(chemin) === '.json' ? 'bruts' : 'tirets-emojis',
    })),
    { chemin: GUIDE_DU_SITE, regles: 'bruts' },
  ];
}

/** Affiche chaque violation ; renvoie leur nombre total et leur nombre par famille. */
function signaler(liste) {
  let total = 0;
  const parType = new Map();
  for (const { chemin, regles } of liste) {
    for (const v of analyser(readFileSync(chemin, 'utf8'), regles)) {
      total += 1;
      const famille = v.type.split(' (')[0];
      parType.set(famille, (parType.get(famille) ?? 0) + 1);
      console.log(`${relatif(chemin)}:${v.ligne}:${v.colonne}  [${v.type}]  ${v.extrait}`);
    }
  }
  return { total, parType };
}

function verifierLeSite() {
  const liste = perimetreDuSite();
  const code = liste.filter((f) => f.regles === 'toutes').length;
  const { total, parType } = signaler(liste);
  if (total === 0) {
    console.log(
      `Charte financementopco : aucun probleme dans ${code} fichiers (apps/web/src) et ${liste.length - code} fichiers ` +
        '(apps/web/tests et apps/web/DESIGN.md : tirets et emojis).',
    );
    return 0;
  }
  const detail = [...parType].map(([type, n]) => `${type} : ${n}`).join(', ');
  console.log(`\nCharte financementopco : ${total} probleme(s) dans le site (${detail}).`);
  return 1;
}


// ------------------------------------------------------------
// Balayage --tirets : tout le depot, tirets cadratins seulement
// ------------------------------------------------------------
const EXTENSIONS_TIRETS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml', '.css', '.txt']);

/**
 * Fichier suivi (chemin de git ls-files, barres obliques) que le balayage --tirets lit : fichier texte des extensions
 * retenues, sauf les donnees JSON de datasets/ (instantanes publies) et de packages/core/data/ (controlees par
 * packages/core/tests/charte-sfg.test.ts, qui exempte les extraits cites mot pour mot).
 */
export function luParLeBalayageDesTirets(chemin) {
  const extension = extname(chemin).toLowerCase();
  if (!EXTENSIONS_TIRETS.has(extension)) return false;
  if (extension === '.json' && (chemin.startsWith('datasets/') || chemin.startsWith('packages/core/data/'))) return false;
  return true;
}

/** Dossier d'un fichier pour le resume : ses deux premiers niveaux (apps/web, packages/core, docs/superpowers...). */
const dossierDuResume = (chemin) => {
  const parties = chemin.split('/');
  return parties.length <= 1 ? '(racine)' : parties.slice(0, Math.min(2, parties.length - 1)).join('/');
};

function verifierLesTirets() {
  let suivis;
  try {
    suivis = execFileSync('git', ['ls-files', '-z'], { cwd: RACINE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\0')
      .filter(Boolean);
  } catch (erreur) {
    console.log(`Balayage des tirets impossible : git ls-files a echoue (${erreur.message}).`);
    return 2;
  }
  // Un fichier suivi mais supprime de la copie de travail (suppression pas encore commitee) n'a plus rien a lire.
  const lus = suivis.filter((fichier) => luParLeBalayageDesTirets(fichier) && existsSync(join(RACINE, fichier)));
  let total = 0;
  let fautifs = 0;
  const parDossier = new Map();
  for (const fichier of lus) {
    const violations = analyser(readFileSync(join(RACINE, fichier), 'utf8'), 'tirets');
    if (violations.length === 0) continue;
    total += violations.length;
    fautifs += 1;
    for (const v of violations) console.log(`${fichier}:${v.ligne}:${v.colonne}  [${v.type}]  ${v.extrait}`);
    const dossier = dossierDuResume(fichier);
    const cumul = parDossier.get(dossier) ?? { fichiers: 0, tirets: 0 };
    parDossier.set(dossier, { fichiers: cumul.fichiers + 1, tirets: cumul.tirets + violations.length });
  }
  if (total === 0) {
    console.log(`Tirets cadratins : aucun dans ${lus.length} fichiers suivis.`);
    return 0;
  }
  console.log(`\nTirets cadratins : ${total} dans ${fautifs} fichier(s) sur ${lus.length} fichiers suivis lus.`);
  for (const [dossier, { fichiers: f, tirets }] of [...parDossier].sort()) {
    console.log(`  ${dossier} : ${tirets} dans ${f} fichier(s)`);
  }
  return 1;
}

function autotest() {
  // Chaque chaine fautive doit produire exactement les types attendus, dans l'ordre ; chaque chaine propre, aucun.
  // Les cas vont par paires : une violation et son jumeau propre. Les jetons de couleur sont fixes ici, pas lus dans
  // globals.css : ceux de la nouvelle charte seuls (les classes de l'ancienne palette n'existent plus), et plus bas
  // les memes avec les noms historiques redefinis.
  const JETONS_NOUVEAUX = new Set(['papier', 'papier-fonce', 'feuille', 'filet', 'filet-fonce', 'encre', 'ardoise', 'prusse', 'prusse-fonce', 'surligneur', 'white', 'black']);
  const HISTORIQUES = ['orange', 'orange-deep', 'orange-deeper', 'orange-soft', 'orange-clair', 'turquoise', 'turquoise-deep', 'turquoise-soft', 'or', 'or-soft', 'vert-clair', 'vert-clair-soft', 'lin', 'lin-soft'];
  const JETONS_HISTORIQUES = new Set([...JETONS_NOUVEAUX, ...HISTORIQUES]);
  const classe = 'ancienne couleur SFG (classe Tailwind)';
  const couleur = (detail) => `ancienne couleur SFG (${detail})`;
  const police = 'police hors charte';
  const degrade = 'degrade';
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
    // \u prend exactement quatre chiffres : le caractere qui suit, hexadecimal ou non, ne prolonge pas l'echappement
    ["const code = '\\u20140';", ['tiret cadratin']],
    ["const annees = '2020\\u20142026';", ['tiret cadratin']],
    ["const s = 'avant\\u2014apres';", ['tiret cadratin']],
    ["const s = 'A\\u2014g';", ['tiret cadratin']],
    ['content: "\\2014";', ['tiret cadratin']],
    // echappement CSS de chaque code du tiret, en majuscules ou minuscules ; au sixieme chiffre l'echappement s'arrete
    ['content: "\\2015";', ['tiret cadratin']],
    ['content: "\\2E3A" "\\2e3b";', ['tiret cadratin', 'tiret cadratin']],
    ['content: "\\FE31" "\\fe58";', ['tiret cadratin', 'tiret cadratin']],
    ['content: "\\02014 " "\\0020140";', ['tiret cadratin', 'tiret cadratin']],
    // U+FE31 (tiret cadratin vertical) en clair, en entites decimale et hexadecimale, en echappements court et long
    ['Un titre \u{FE31} vertical', ['tiret cadratin']],
    ['<p>A &#65073; B &#xFE31; C</p>', ['tiret cadratin', 'tiret cadratin']],
    ["const s = 'A \\uFE31 B \\u{fe31} C';", ['tiret cadratin', 'tiret cadratin']],
    // (b) classes de l'ancienne palette dont le jeton n'est plus defini, toutes racines de couleur de Tailwind 4
    ['<p className="text-orange-deep">', [classe]],
    ['className="hover:bg-turquoise-soft ring-or/50"', [classe, classe]],
    ['className="from-vert-clair to-lin-soft"', [classe, classe]],
    ['className="md:hover:bg-orange/[.35] bg-orange-deeper!"', [classe, classe]],
    ['className="drop-shadow-orange-clair inset-shadow-or-soft"', [classe, classe]],
    ['className="inset-ring-turquoise text-shadow-lin"', [classe, classe]],
    ['className="mask-b-from-orange border-bs-turquoise-deep"', [classe, classe]],
    ['className="text-orange-500 bg-vert-clair-soft"', [classe, classe]],
    // (b) hexadecimal en contexte de couleur : valeur exacte (alpha ignore) ou approchee
    ['color: #E84E1B;', [couleur('couleur #E84E1B : orange #E84E1B')]],
    ['shadow-[0_0_0_2px_#c43f13]', [couleur('couleur #c43f13 : orange-deep #C43F13')]],
    ['fill="#5E9F92"', [couleur('couleur #5E9F92 : turquoise #5E9F92')]],
    ["style={{ borderColor: '#3e6860' }}", [couleur('couleur #3e6860 : turquoise-deep #3E6860')]],
    ["const OR = '#F9B233';", [couleur('couleur #F9B233 : or #F9B233')]],
    ['background: #E84E1B80;', [couleur('couleur #E84E1B80 : orange #E84E1B')]],
    ['color: #E94F1C;', [couleur('couleur #E94F1C : proche de orange #E84E1B, ecart 0,003')]],
    ['color: #E0501F;', [couleur('couleur #E0501F : proche de orange #E84E1B, ecart 0,015')]],
    ['--lin: #e6efec;', [couleur('couleur #e6efec : proche de vert-clair-soft #E6F2EF, ecart 0,008')]],
    // l'ancien fond des alertes #FBEDEE tombe sur l'ancien orange doux
    ['outline-color: #fbedee;', [couleur('couleur #fbedee : proche de orange-soft #FDF0EA, ecart 0,011')]],
    ['fill: #fdf0ea; stroke: #A93510;', [couleur('couleur #fdf0ea : orange-soft #FDF0EA'), couleur('couleur #A93510 : orange-deeper #A93510')]],
    ["if (couleur === '#e84e1b') teinter();", [couleur('couleur #e84e1b : orange #E84E1B')]],
    // url(#id) designe un element (masque, filtre, degrade SVG) : seul ce qui suit la parenthese fermante reste une
    // couleur ; une fonction autre que new URL( ne fait pas d'une chaine une ancre
    ['mask-image: url(#e84e1b), linear-gradient(#c43f13, #fff);', [degrade, couleur('couleur #c43f13 : orange-deep #C43F13')]],
    ['background: url(x.png) #f56a31;', [couleur('couleur #f56a31 : orange-clair #F56A31')]],
    ["const u = URL_ORANGE('#e84e1b');", [couleur('couleur #e84e1b : orange #E84E1B')]],
    ["const fond = 'linear-gradient(#fff, #A3D1C8)';", [degrade, couleur('couleur #A3D1C8 : vert-clair #A3D1C8')]],
    // (b) fonctions de couleur, toutes syntaxes
    ['background: rgb(232, 78, 27);', [couleur('rgb : orange #E84E1B')]],
    ['color: rgba(94 159 146 / 0.5)', [couleur('rgb : turquoise #5E9F92')]],
    ['className="bg-[rgb(196_63_19)]"', [couleur('rgb : orange-deep #C43F13')]],
    ['className="border-[color:rgb(169_53_16)]"', [couleur('rgb : orange-deeper #A93510')]],
    ['color: hsl(15 82% 51%)', [couleur('hsl : proche de orange #E84E1B, ecart 0,003')]],
    ['color: hsla(0.1111turn, 94%, 59%, 1)', [couleur('hsl : proche de or #F9B233, ecart 0,012')]],
    ['className="text-[hsl(168_26%_33%)]"', [couleur('hsl : proche de turquoise-deep #3E6860, ecart 0,006')]],
    ['color: hwb(15 11% 9%);', [couleur('hwb : proche de orange #E84E1B, ecart 0,002')]],
    ['color: oklch(0.65 0.075 179);', [couleur('oklch : proche de turquoise #5E9F92, ecart 0,007')]],
    ['color: color(srgb 0.91 0.306 0.106);', [couleur('color() : orange #E84E1B')]],
    // (b) fonction apres un souligne (valeur arbitraire Tailwind), alpha en var() ou calc() imbriques
    ['shadow-[0_0_0_2px_rgb(232_78_27)]', [couleur('rgb : orange #E84E1B')]],
    ['shadow-[0_8px_30px_rgb(232,78,27,0.5)]', [couleur('rgb : orange #E84E1B')]],
    ['background: rgb(232 78 27 / var(--opacite));', [couleur('rgb : orange #E84E1B')]],
    ['color: hsl(15 82% 51% / calc(1 - var(--x)));', [couleur('hsl : proche de orange #E84E1B, ecart 0,003')]],
    // (b) couleurs nommees en contexte de couleur qui tombent sur une ancienne couleur
    ['background: linen;', [couleur('couleur nommee linen : proche de orange-soft #FDF0EA, ecart 0,007')]],
    ['style={{ color: "oldlace" }}', [couleur('couleur nommee oldlace : proche de or-soft #FEF4DE, ecart 0,010')]],
    ['className="bg-[color-mix(in_srgb,Linen_40%,white)]"', [couleur('couleur nommee linen : proche de orange-soft #FDF0EA, ecart 0,007')]],
    // (c) polices hors charte dans tous les contextes de police
    ['font-family: Montserrat, sans-serif;', [police]],
    ['font-family: var(--font-inter), "Segoe UI", system-ui, sans-serif;', [police, police]],
    ["style={{ fontFamily: 'Inter' }}", [police]],
    ["import { Inter, Montserrat } from 'next/font/google';", [police, police]],
    ["import { IBM_Plex_Mono } from 'next/font/google';", [police]],
    ['font-family: "IBM Plex Mono";', [police]],
    ['font-family: var(--font-plex-mono);', [police]],
    ['className="font-[Inter,_Roboto]"', [police, police]],
    ["className=\"font-['Courier_New'] md:font-[family-name:Lato]\"", [police, police]],
    ['ctx.font = "12px Roboto";', [police]],
    ['font: 600 1rem/1.2 Montserrat, sans-serif;', [police]],
    ['<text fontFamily="Consolas"> <text fontFamily={\'Lato\'}>', [police, police]],
    ['--font-display: "Playfair Display", serif;', [police]],
    ["--font-texte: var(--font-instrument, 'Roboto'), Arial;", [police]],
    ['font-family: -apple-system, BlinkMacSystemFont, Arial;', [police]],
    ['font: 12px/1.5 Hack; --font-code: Monaco;', [police, police]],
    ["const polices = [{ name: 'Montserrat', data }];", [police]],
    // (e) degrades CSS et Tailwind
    ['background: linear-gradient(90deg, #fff, #000);', [degrade]],
    ['background: radial-gradient(circle, #161c27, #1f3b63);', [degrade]],
    ['mask-image: repeating-conic-gradient(#000 0 25%, transparent 0 50%);', [degrade]],
    ['background-image: -webkit-linear-gradient(top, #fff, #000);', [degrade]],
    ['className="bg-linear-to-r from-papier to-feuille"', [degrade]],
    ['className="md:bg-radial-[at_25%_25%] bg-conic-180"', [degrade, degrade]],
    ['className="bg-gradient-to-r -bg-linear-45 hover:bg-radial"', [degrade, degrade, degrade]],
    ['className="bg-[linear-gradient(#fff,#000)]"', [degrade]],
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
    // (d) emoji en echappement JavaScript (accolades, paire de substitution), en entite HTML ou en echappement CSS
    ["const s = 'Bravo \\u{1F389}';", ['emoji']],
    ["const s = 'Bravo \\uD83C\\uDF89';", ['emoji']],
    ['<p>Bravo &#127881; et &#x1F389;</p>', ['emoji', 'emoji']],
    ['content: "\\1F389";', ['emoji']],
    ['<p>Coche &#x2713;&#xFE0F; fleche \\u2197\\uFE0F</p>', ['emoji', 'emoji']],
  ];
  const propres = [
    // (a)
    'Un dossier, deux phrases ; une virgule ou deux points : rien a signaler.',
    'De 0,05 \u2013 0,60 % (tiret demi-cadratin admis)',
    '<p>A &ndash; B &#8211; C &#x2013; D</p>',
    "const s = 'A \\u2013 B';",
    // en CSS, les chiffres qui suivent prolongent l'echappement (jusqu'a six) : \20140 est U+20140, pas un tiret
    'content: "\\20140";',
    'content: "\\2013" "\\FE32" "\\2E3C" "\\0201400";',
    // U+FE32, forme verticale du demi-cadratin : admise comme lui
    "Formes verticales du demi-cadratin : \u{FE32} &#65074; &#xFE32; '\\uFE32'",
    // (b) classes et variables de la nouvelle charte ; le bleu n'est plus interdit
    'className="bg-prusse text-white hover:bg-prusse-fonce border-filet"',
    'className="bg-papier text-encre bg-feuille text-ardoise bg-surligneur bg-papier-fonce"',
    'className="text-blue-600 bg-indigo-50 ring-violet-400/50 text-teal-700"',
    'className="bg-[var(--color-orange-deep)]" --orange: var(--prusse); --color-orange: var(--orange);',
    // classes homonymes qui ne sont pas de l'ancienne palette (stroke-linecap, bg-lineaire, text-ordinal)
    'className="stroke-linecap-round bg-lineaire text-ordinal outline-offset-2"',
    // (b) couleurs du kit, dont le papier, a 0,012 de l'ancien orange doux mais plus proche de lui-meme
    '--fo-papier: #F4F1E9; --fo-papier-fonce: #EAE5D8; --fo-feuille: #FBF9F4; --fo-filet: #CFC8B8;',
    '--fo-encre: #161C27; --fo-ardoise: #4A5262; --fo-prusse: #1F3B63; --fo-surligneur: #F1D84B; --fo-prusse-fonce: #172D4C;',
    '--fo-filet-fonce: #B9B2A2; --fo-pointilles: #A9A293; --fo-ombre-feuille: #E4DED0; --fo-bleu-clair: #B9C8DE;',
    '--fo-texte-sur-prusse: #D6DEEA; --fo-texte-sur-encre: #B9BFCA; --fo-filet-sur-encre: #2E3647;',
    'background: rgb(244 241 233); color: hsl(220 52% 25%);',
    // le bleu, le violet, le blanc, le noir, le rouge des alertes et leur nouveau fond #F6E3E1 ; juste au-dela du seuil (ecart 0,021 avec l'orange)
    'color: #3B82F6; background: rgb(124, 58, 237); fill: navy; color: hsl(250 80% 50%);',
    'background: #FFFFFF; color: #000; border-color: #BC1723; outline-color: #f6e3e1;',
    'color: #EE5725;',
    // (b) ancres et identifiants
    '<a href="#e84e1b">ancre</a> <a href="#c43f13">ancre</a>',
    "<Link href={'#e84e1b'}>ancre</Link> document.querySelector('#c43f13'); router.push('#a3d1c8');",
    "const lien = { href: '#e84e1b', label: 'Haut' };",
    'const id = "#f9b233";',
    '// IDCC #1486, voir le ticket #123 ; ancien orange #E84E1B',
    'a[href="#e84e1b"] { text-decoration: underline; }',
    "if (location.hash === '#e84e1b') ouvrir();",
    "if (hash !== '#c43f13') fermer();",
    "if (e.target.hash == '#e84e1b' || lien.href != '#c43f13') suivre();",
    // reference a un element par url(#id) (CSS ou attribut SVG) et adresse construite par new URL('#id', base)
    'mask-image: url(#e84e1b); filter: url("#c43f13"); fill: url( #5e9f92 ); clip-path: url(\'#a3d1c8\');',
    '<path fill="url(#e84e1b)" /> <rect style={{ mask: \'url(#c43f13)\' }} />',
    "const u = new URL('#e84e1b', base); const v = new URL(\"#c43f13\", location.href);",
    // (b) fonctions homonymes dans un identifiant (lettre, chiffre, point, dollar ou tiret devant) : pas des couleurs CSS
    'toRgb(232, 78, 27); theme.rgb(232, 78, 27); $rgb(232, 78, 27); x-rgb(232, 78, 27); a2hsl(15, 82%, 51%);',
    // un souligne devant ne vaut separateur que dans une valeur arbitraire Tailwind ouverte
    'const c = to_rgb(232, 78, 27); const d = hex_hsl(15, 82%, 51%);',
    // composante calculee ou syntaxe relative : non lue
    'color: rgb(from var(--x) r g b); color: oklch(var(--l) 0.2 40);',
    // (b) couleurs nommees hors contexte ou loin des anciennes couleurs
    '<p>L orange et le turquoise ne font plus partie de la charte ; du linen.</p>',
    "const tone = 'orange'; const linen = 2;",
    'color: orange; background: turquoise; border-color: white; color: navy;',
    'background: url(/images/linen.png); /* le nom du fichier n est pas une couleur */',
    // (c) polices du kit, replis permis, mono et balises de code
    "--fo-font-titre: var(--font-newsreader, 'Newsreader'), Georgia, 'Times New Roman', serif;",
    "--fo-font-texte: var(--font-instrument, 'Instrument Sans'), 'Helvetica Neue', Arial, sans-serif;",
    "--fo-font-chiffres: var(--font-dm-mono, 'DM Mono'), ui-monospace, Menlo, monospace;",
    "import { Newsreader, Instrument_Sans, DM_Mono } from 'next/font/google';",
    'font-family: Helvetica, system-ui, sans-serif; font: 600 1.0625rem/1 var(--fo-font-texte); font: inherit;',
    '<span className="font-mono">1 750,00</span> <code>SIREN</code> <pre>x</pre> <kbd>Ctrl</kbd>',
    '--font-mono: initial; --font-serif: initial; --font-weight-bold: 500; --default-font-feature-settings: normal;',
    'className="font-[600] font-[var(--font-titre)] font-display font-sans"',
    "<p>Menlo Park, Monaco ; l'interprofessionnel ; Inter-entreprises</p>",
    "const lieu = { fontFamily: inter.style.fontFamily, ville: 'Monaco' }; const font = Inter({ subsets: ['latin'] });",
    '/* ancienne police : font-family: Montserrat, Inter */ // et IBM Plex Mono',
    "<text fontFamily=\"DM Mono\" font-family='Newsreader'>",
    'interface P { fontFamily: string; font: string }',
    // (e) degrade cite en commentaire, classes voisines
    '/* pas de linear-gradient ni de bg-linear-to-r */',
    'className="bg-papier-fonce bg-lineaire from-papier"',
    // (d)
    'Une demande complexe, un dossier complexe.',
    'Signes typographiques tol\u00E9r\u00E9s : \u2713 \u26A0 \u2197 \u25B8 \u25BE',
    '\u00A9 SFG D\u00E9veloppement, Marque\u00AE, Nom\u2122',
    'Fl\u00E8ches \u2192 \u2190 \u00B7 puces \u2022',
    'const lien = `IDCC ${i.idcc} \u00B7 ${i.titre}`;',
    '&#8217; et &#x2019;',
    // ecritures qui ne donnent pas d'emoji, ou un signe tolere sans selecteur U+FE0F
    "<p>&#169; SFG &#xA9; &#x2713; &#8599; &#x25B8;</p> const e = '\\u00e9'; const f = '\\u{2197}';",
    'content: "\\2713" "\\25BE";',
    // ecritures hors de l'Unicode (au-dela de U+10FFFF) : laissees telles quelles, sans erreur
    "&#9999999; &#x110000; '\\u{110000}'",
  ];

  let ecarts = 0;
  for (const [texte, attendus] of fautifs) {
    const trouves = analyser(texte, 'toutes', JETONS_NOUVEAUX).map((v) => v.type);
    const ok = trouves.length === attendus.length && attendus.every((t, i) => trouves[i] === t);
    if (!ok) {
      ecarts += 1;
      console.log(`ECART (violation non detectee) : ${JSON.stringify(texte)}\n  attendu : ${JSON.stringify(attendus)}\n  obtenu  : ${JSON.stringify(trouves)}`);
    }
  }
  for (const texte of propres) {
    const trouves = analyser(texte, 'toutes', JETONS_NOUVEAUX);
    if (trouves.length > 0) {
      ecarts += 1;
      console.log(`ECART (faux positif) : ${JSON.stringify(texte)}\n  obtenu : ${JSON.stringify(trouves.map((v) => `${v.type} ${v.extrait}`))}`);
    }
  }

  // Classes de l'ancienne palette selon les jetons definis : un nom historique redefini dans globals.css est permis,
  // une teinte numerotee (orange-500) n'y est pas definie ; lecture des jetons d'une feuille (commentaires et
  // `initial` exclus).
  const parJetons = [
    ['className="bg-orange-deep text-turquoise-deep bg-lin-soft ring-or/40 from-vert-clair"', JETONS_HISTORIQUES, []],
    ['className="bg-orange-deep text-turquoise-deep bg-lin-soft ring-or/40 from-vert-clair"', JETONS_NOUVEAUX, [classe, classe, classe, classe, classe]],
    ['className="bg-orange-500 text-orange-deep"', JETONS_HISTORIQUES, [classe]],
    ['className="bg-orange-deep"', new Set(), [classe]],
  ];
  for (const [texte, jetons, attendus] of parJetons) {
    const trouves = analyser(texte, 'toutes', jetons).map((v) => v.type);
    if (trouves.length !== attendus.length || attendus.some((t, i) => trouves[i] !== t)) {
      ecarts += 1;
      console.log(`ECART (jetons) : ${JSON.stringify(texte)}\n  attendu : ${JSON.stringify(attendus)}\n  obtenu  : ${JSON.stringify(trouves)}`);
    }
  }
  const lus = [...jetonsDe('@theme { --color-*: initial; --color-papier: #F4F1E9; --color-lin: initial; }\n@theme inline {\n  --color-orange-deep: var(--prusse); /* --color-or: x; */\n}')].sort().join(' ');

  // Controles de detail : lignes et colonnes sur un texte de plusieurs lignes (dont une declaration CSS repartie sur
  // plusieurs lignes), d'emojis decodes et de polices voisines d'un commentaire ; extrait d'une fonction de couleur lu
  // jusqu'a sa parenthese fermante.
  const positions = (texte) => analyser(texte, 'toutes', JETONS_NOUVEAUX).map((v) => `${v.ligne}:${v.colonne}`).join(' ');
  const extraits = (texte) => analyser(texte, 'toutes', JETONS_NOUVEAUX).map((v) => v.extrait).join(' ');
  // Duree : chaque fonction de couleur non refermee relisait tout le texte qui la suit (1 000 "rgb(" devant 490 000
  // caracteres : 9 s) ; la recherche des fermantes est lineaire.
  const duree = (texte) => {
    const t0 = performance.now();
    analyser(texte, 'toutes', JETONS_NOUVEAUX);
    return performance.now() - t0;
  };
  const enMoinsDe3s = (ms) => (ms < 3000 ? 'moins de 3 s' : `${(ms / 1000).toFixed(1)} s`);
  const controles = [
    ['positions', positions('ligne propre\r\nfont-family: Inter;\nfin \u2014 la\n.x {\n  background: linear-gradient(\n    #e84e1b 0%,\n    #fff 100%\n  );\n}'), '2:14 3:5 5:15 6:5'],
    ['extrait', extraits('color: hsl(15 82% 51% / calc(1 - var(--x)));'), 'hsl(15 82% 51% / calc(1 - var(--x)))'],
    ['positions des emojis decodes', positions('ok &#127881;\n  \\u{1F44D} et \\uD83C\\uDF89'), '1:4 2:3 2:16'],
    ['positions des polices hors commentaire', positions('/* font-family: Inter */ font-family: Lato;\n// font: 12px Roboto\nx { font: 1rem Lato }'), '1:39 3:16'],
    ['extrait apres des fonctions non refermees', extraits('rgb( oklch( color: rgb(232, 78, 27);'), 'rgb(232, 78, 27)'],
    ['jetons lus dans une feuille', lus, 'orange-deep papier'],
    ['duree (1 000 rgb( non refermes, 490 000 caracteres)', enMoinsDe3s(duree('color: ' + 'rgb('.repeat(1000) + 'x'.repeat(490000))), 'moins de 3 s'],
    ['duree (5 000 oklch( non refermes, 100 000 caracteres)', enMoinsDe3s(duree('oklch('.repeat(5000) + 'a'.repeat(100000))), 'moins de 3 s'],
  ];
  for (const [nom, obtenu, attendu] of controles) {
    if (obtenu !== attendu) {
      ecarts += 1;
      console.log(`ECART (${nom}) : attendu "${attendu}", obtenu "${obtenu}"`);
    }
  }

  // Regles d'un perimetre : tests du site (tirets et emojis, ecritures comprises), documents et donnees (caracteres
  // ecrits tels quels : un document cite &mdash; ou \u{1F389} sans les afficher), balayage --tirets (tirets ecrits tels
  // quels, dans tout le depot). Couleurs, polices et degrades ne valent que pour apps/web/src.
  // Caracteres construits par leur code : ce fichier n'en contient aucun tel quel (le balayage --tirets le lit aussi).
  const car = (...points) => String.fromCodePoint(...points);
  const [tiret, barre, demi, fete] = [car(0x2014), car(0x2015), car(0x2013), car(0x1f389)];
  const toleres = car(0x2713, 0x20, 0x26a0, 0x20, 0x2197, 0x20, 0xa9);
  const parRegles = [
    ["color: #e84e1b; font-family: Montserrat; const s = 'A \\u2014 B \\u{1F389}';", 'tirets-emojis', ['tiret cadratin', 'emoji']],
    ['color: #e84e1b; font-family: Montserrat; background: linear-gradient(#fff, #000); bg-orange-500 ; rien a signaler', 'tirets-emojis', []],
    [`Bravo ${fete}, un tiret ${tiret} ici ; \`&mdash;\` et \`\\u{1F389}\` cites ; bg-orange-500`, 'bruts', ['emoji', 'tiret cadratin']],
    [`Cites : \`&mdash;\`, \`&#8212;\`, \`\\u2014\`, \`\\2014\`, \`&#x1F389;\` ; signes toleres ${toleres}`, 'bruts', []],
    [`Un tiret ${tiret} ici, l'echappement '\\u2014' et &mdash; non, ${fete} non plus, bg-orange-500`, 'tirets', ['tiret cadratin']],
    [`Formes verticales ${car(0xfe31)} et ${car(0xfe58)}, barre ${barre}, demi-cadratin ${demi} admis`, 'tirets', ['tiret cadratin', 'tiret cadratin', 'tiret cadratin']],
    [`Rien a signaler : ${demi} ${toleres} &mdash; \\u2014`, 'tirets', []],
  ];
  for (const [texte, regles, attendus] of parRegles) {
    const trouves = analyser(texte, regles, JETONS_NOUVEAUX).map((v) => v.type);
    if (trouves.length !== attendus.length || attendus.some((t, i) => trouves[i] !== t)) {
      ecarts += 1;
      console.log(`ECART (regles ${regles}) : ${JSON.stringify(texte)}\n  attendu : ${JSON.stringify(attendus)}\n  obtenu  : ${JSON.stringify(trouves)}`);
    }
  }

  // Fichiers du depot que le balayage --tirets lit (chemins de git ls-files).
  const selection = [
    ['apps/web/src/app/page.tsx', true],
    ['apps/web/src/app/globals.css', true],
    ['apps/web/DESIGN.md', true],
    ['apps/mobile/app.json', true],
    ['package-lock.json', true],
    ['packages/core/src/data.ts', true],
    ['packages/core/tests/charte-sfg.test.ts', true],
    ['scripts/check-charte-sfg.mjs', true],
    ['backend/scripts/build-sources.js', true],
    ['.github/workflows/ci.yml', true],
    ['docs/notes.txt', true],
    ['datasets/README.md', true],
    ['datasets/v3.json', false],
    ['datasets/manifest.json', false],
    ['packages/core/data/aides/nationales.json', false],
    ['packages/core/data/idcc/idcc-opco.json', false],
    ['apps/web/public/logo-horizontal.svg', false],
    ['apps/web/public/.htaccess', false],
    ['.gitignore', false],
  ];
  for (const [chemin, attendu] of selection) {
    if (luParLeBalayageDesTirets(chemin) !== attendu) {
      ecarts += 1;
      console.log(`ECART (selection --tirets) : ${chemin} ${attendu ? 'devrait etre lu' : 'ne devrait pas etre lu'}`);
    }
  }

  const total = fautifs.length + propres.length + parJetons.length + controles.length + parRegles.length + selection.length;
  if (ecarts > 0) {
    console.log(`\nAutotest de la garde de charte : ${ecarts} ecart(s) sur ${total} cas.`);
    return 1;
  }
  console.log(
    `Autotest de la garde de charte : ${total} cas, tous conformes (${fautifs.length} violations detectees, ${propres.length} textes propres non signales, ` +
      `${parJetons.length} cas de jetons de couleur, ${controles.length} controles de position, d'extrait, de lecture des jetons et de duree exacts, ` +
      `${parRegles.length} cas de regles par perimetre, ${selection.length} cas de selection des fichiers du balayage --tirets).`,
  );
  return 0;
}


// Execute seulement en ligne de commande : un import (autotest externe, mutants) n'analyse pas le site.
const lance = process.argv[1] && resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (lance) {
  process.exitCode = process.argv.includes('--self-test')
    ? autotest()
    : process.argv.includes('--tirets')
      ? verifierLesTirets()
      : verifierLeSite();
}
