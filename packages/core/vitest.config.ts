import { configDefaults, defineConfig } from 'vitest/config';

// `npm test` (et `npx vitest run`) : tous les tests du cœur sauf le contrôle de fraîcheur, seul à lire l'horloge (il échoue
// dès que les données ont plus de 12 mois). Il se lance à part : `npm run test:fraicheur` (vitest.fraicheur.config.ts).
export const TESTS_A_PART = ['tests/fraicheur.test.ts'];

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, ...TESTS_A_PART],
  },
});
