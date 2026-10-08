import { defineConfig } from 'vitest/config';

// `npm run test:fraicheur` : le seul contrôle de fraîcheur des données par rapport à la date du jour (exclu de `npm test`).
export default defineConfig({
  test: {
    include: ['tests/fraicheur.test.ts'],
  },
});
