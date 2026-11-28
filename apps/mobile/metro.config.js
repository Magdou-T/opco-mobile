// Metro config : monorepo-aware + NativeWind.
// - watchFolders: la racine du monorepo pour que Metro voie packages/core
//   (source TypeScript non buildée, transpilée par babel-preset-expo).
// - nodeModulesPaths: résolution des deps hissées à la racine (npm workspaces).
// - unstable_enablePackageExports: @opco/core expose son entrée via "exports".
// - blockList: Metro n'explore pas les dossiers générés du site (apps/web), qui sont sous la racine surveillée.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.unstable_enablePackageExports = true;

// Le site (apps/web) est dans le même dépôt : sa sortie de build (.next, out) et ses dépendances (node_modules) ne
// servent pas à l'app. On garde les exclusions par défaut d'Expo et on y ajoute ces trois dossiers ([\\/] : chemins
// Windows et POSIX).
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  /(?:^|[\\/])apps[\\/]web[\\/](?:\.next|out|node_modules)(?:[\\/]|$)/,
];

// Metro résout déjà .ts/.tsx par défaut ; on s'en assure (core en TS source).
for (const ext of ['ts', 'tsx', 'cjs', 'mjs']) {
  if (!config.resolver.sourceExts.includes(ext)) {
    config.resolver.sourceExts.push(ext);
  }
}

module.exports = withNativeWind(config, { input: './src/global.css' });
