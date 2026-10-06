// Conversion ponctuelle de l'ancienne table IDCC → OPCO (packages/core/data/idcc-opco-map.json)
// vers le format v2 (packages/core/data/idcc/idcc-opco.json).
// Les entrées converties sont marquées « non vérifiées » : la table vérifiée (tâche 9) les remplace.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ancienne = JSON.parse(
  fs.readFileSync(path.join(racine, 'packages/core/data/idcc-opco-map.json'), 'utf-8'),
);

const ECHAPPATOIRES = {
  '5501': "Convention d'entreprise indépendante ou texte assimilé non précisé",
  '5100': 'Statuts divers ou inconnus',
  '9998': 'Convention non encore en vigueur',
  '9999': 'Absence de convention collective',
};

const table = {};
for (const [idcc, e] of Object.entries(ancienne)) {
  table[idcc] = {
    idcc,
    titre: e.branche_name,
    opco: e.opco_slug,
    statut: 'actif',
    note: 'Entrée historique non vérifiée',
    source: 'historique',
  };
}
for (const [idcc, titre] of Object.entries(ECHAPPATOIRES)) {
  table[idcc] = { idcc, titre, opco: null, statut: 'echappatoire', source: 'https://quel-est-mon-opco.francecompetences.fr/' };
}

const trie = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
const sortie = path.join(racine, 'packages/core/data/idcc/idcc-opco.json');
fs.mkdirSync(path.dirname(sortie), { recursive: true });
fs.writeFileSync(sortie, JSON.stringify(trie, null, 2) + '\n', 'utf-8');
console.log(`OK ${sortie} (${Object.keys(trie).length} entrées)`);
