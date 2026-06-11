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

// Build dataset object
const dataset = {
  version: 1,
  generatedAt: generatedAt,
  opcos: opcos
};

// Convert to JSON string with 2-space indentation
const datasetJsonString = JSON.stringify(dataset, null, 2);

// Write v1.json
const v1Path = path.join(datasetsDir, 'v1.json');
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
const manifest = {
  version: 1,
  generatedAt: generatedAt,
  sha256: hash,
  opcoCount: opcos.length,
  changelog: ['Dataset initial (seed) généré depuis les données embarquées']
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
