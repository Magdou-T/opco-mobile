// ============================================================
// Copies « à plat » des fichiers de préchargement de Next.js dans l'export statique (apps/web/out).
//
// Next.js 16.2 écrit les segments d'une page dans des dossiers (`opco/akto/__next.opco/$d$slug/__PAGE__.txt`) alors que
// le routeur du navigateur les demande sous un nom à points (`opco/akto/__next.opco.$d$slug.__PAGE__.txt`) : sans copie,
// chaque lien préchargé produit deux réponses 404 (relevé sur le site en ligne le 27/11/2026) et la navigation retombe
// sur un chargement complet de la page. Le script ajoute, à côté de chaque dossier `__next.*`, la copie de chacun de ses
// fichiers sous le nom à points. Il ne supprime ni ne modifie rien ; relancé, il réécrit les mêmes copies.
//
// Usage : node scripts/aplatir-prechargements.mjs [dossier de l'export] (par défaut : out, relatif à apps/web).
// ============================================================

import { copyFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const racineWeb = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dossierExport = process.argv[2] ?? join(racineWeb, 'out');

/** Fichiers (chemins complets) contenus dans un dossier, sous-dossiers compris. */
function fichiersDe(dossier) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name);
    return entree.isDirectory() ? fichiersDe(chemin) : [chemin];
  });
}

let copies = 0;

/** Parcourt l'export ; à chaque dossier `__next.*`, écrit les copies à plat de ses fichiers dans le dossier parent. */
function parcourir(dossier) {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (!entree.isDirectory()) continue;
    const chemin = join(dossier, entree.name);
    if (entree.name.startsWith('__next.')) {
      for (const fichier of fichiersDe(chemin)) {
        // `__next.opco/$d$slug/__PAGE__.txt` devient `__next.opco.$d$slug.__PAGE__.txt`, à côté du dossier.
        const aPlat = `${entree.name}.${relative(chemin, fichier).split(sep).join('.')}`;
        copyFileSync(fichier, join(dossier, aPlat));
        copies += 1;
      }
    } else {
      parcourir(chemin);
    }
  }
}

if (!statSync(dossierExport, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`Dossier d'export introuvable : ${dossierExport}`);
  process.exit(1);
}
parcourir(dossierExport);
console.log(`Préchargements à plat : ${copies} copie(s) dans ${dossierExport}`);
