import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve paths relative to the script location
const scriptsDir = __dirname;
const monorepoRoot = path.dirname(scriptsDir);
const opcoDataDir = path.join(monorepoRoot, 'packages', 'core', 'data', 'opcos');
const datasetsDir = path.join(monorepoRoot, 'datasets');

// Ensure datasets directory exists
if (!fs.existsSync(datasetsDir)) {
  fs.mkdirSync(datasetsDir, { recursive: true });
}

// OPCO filenames
const opcoFilenames = [
  'afdas.json',
  'akto.json',
  'atlas.json',
  'constructys.json',
  'ocapiat.json',
  'opco-ep.json',
  'opco-mobilites.json',
  'opco-sante.json',
  'opco2i.json',
  'opcommerce.json',
  'uniformation.json'
];

// Read all OPCO files
const opcos = [];
for (const filename of opcoFilenames) {
  const filePath = path.join(opcoDataDir, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  const opcoData = JSON.parse(content);
  opcos.push(opcoData);
}

// Generate ISO date
const generatedAt = new Date().toISOString();

// Auto-increment version from existing manifest (apps only download if newer)
const manifestPath0 = path.join(datasetsDir, 'manifest.json');
let version = 1;
if (fs.existsSync(manifestPath0)) {
  try {
    const prev = JSON.parse(fs.readFileSync(manifestPath0, 'utf-8'));
    if (Number.isInteger(prev.version)) version = prev.version + 1;
  } catch { /* manifest illisible -> repart à 1 */ }
}

// Build dataset object
const dataset = {
  version: version,
  generatedAt: generatedAt,
  opcos: opcos
};

// Convert to JSON string with 2-space indentation
const datasetJsonString = JSON.stringify(dataset, null, 2);

// Write v<N>.json (archive immuable)
const v1Path = path.join(datasetsDir, `v${version}.json`);
fs.writeFileSync(v1Path, datasetJsonString, 'utf-8');
console.log(`✓ Created ${v1Path}`);

// Write latest.json (same content)
const latestPath = path.join(datasetsDir, 'latest.json');
fs.writeFileSync(latestPath, datasetJsonString, 'utf-8');
console.log(`✓ Created ${latestPath}`);

// Calculate SHA-256 hash of the written content
const latestContent = fs.readFileSync(latestPath, 'utf-8');
const hash = crypto
  .createHash('sha256')
  .update(latestContent, 'utf-8')
  .digest('hex');

console.log(`✓ SHA-256 hash: ${hash}`);

// Build manifest object
const changelog = process.env.DATASET_CHANGELOG
  ? [process.env.DATASET_CHANGELOG]
  : [`Dataset v${version} généré depuis les données embarquées`];
const manifest = {
  version: version,
  generatedAt: generatedAt,
  sha256: hash,
  opcoCount: opcos.length,
  changelog: changelog
};

// Write manifest.json
const manifestPath = path.join(datasetsDir, 'manifest.json');
const manifestJsonString = JSON.stringify(manifest, null, 2);
fs.writeFileSync(manifestPath, manifestJsonString, 'utf-8');
console.log(`✓ Created ${manifestPath}`);

console.log('\n✓ Dataset generation complete!');
console.log(`  - version: ${manifest.version}`);
console.log(`  - generatedAt: ${manifest.generatedAt}`);
console.log(`  - opcoCount: ${manifest.opcoCount}`);
console.log(`  - sha256: ${manifest.sha256}`);
