// ============================================================
// Signale à IndexNow (Bing, Yandex, Seznam, Naver) les adresses du plan du site, après un dépôt sur l'hébergement.
//
// La clé est le nom du fichier `public/<clé>.txt`, servi à la racine du site (https://www.financementopco.fr/<clé>.txt) :
// IndexNow vérifie qu'elle est bien publiée avant d'accepter les adresses. À lancer seulement une fois le nouveau site en
// ligne (sinon les moteurs relisent l'ancien) : node scripts/indexnow.mjs [--essai]
// --essai affiche la requête sans l'envoyer. Réponses attendues : 200 (reçu) ou 202 (reçu, clé en cours de vérification).
// ============================================================

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racineWeb = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const HOTE = 'www.financementopco.fr';

const fichierCle = readdirSync(join(racineWeb, 'public')).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!fichierCle) {
  console.error('Clé IndexNow introuvable dans public/ (fichier de 32 caractères hexadécimaux en .txt).');
  process.exit(1);
}
const cle = fichierCle.replace(/\.txt$/, '');

const plan = readFileSync(join(racineWeb, 'out', 'sitemap.xml'), 'utf8');
const adresses = [...plan.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (adresses.length === 0) {
  console.error('Aucune adresse dans out/sitemap.xml : lancer le build avant.');
  process.exit(1);
}

const corps = { host: HOTE, key: cle, keyLocation: `https://${HOTE}/${fichierCle}`, urlList: adresses };

if (process.argv.includes('--essai')) {
  console.log(JSON.stringify(corps, null, 2));
  process.exit(0);
}

const reponse = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(corps),
});
console.log(`IndexNow : ${reponse.status} ${reponse.statusText} (${adresses.length} adresses)`);
if (reponse.status >= 300) process.exit(1);
