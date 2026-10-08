// Préchargement du lot de l'écran de résultats (lib/prechargement.ts) : une fois par page, jamais hors ligne.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { creerPrechargeur } from '../src/lib/prechargement';

/** Chargement simulé : compte les appels ; `echec` rend une promesse rejetée, comme un lot qui ne se charge pas. */
function chargeur(echec = false) {
  const appels = { nombre: 0 };
  const charger = () => {
    appels.nombre++;
    return echec ? Promise.reject(new Error('lot indisponible')) : Promise.resolve({});
  };
  return { appels, charger };
}

describe('préchargement du lot de l’écran de résultats (creerPrechargeur)', () => {
  test('en ligne : le lot est demandé une seule fois, quel que soit le nombre de demandes', () => {
    const { appels, charger } = chargeur();
    const precharger = creerPrechargeur(charger, () => true);
    assert.equal(precharger(), 'lance');
    assert.equal(precharger(), 'deja_lance');
    assert.equal(precharger(), 'deja_lance');
    assert.equal(appels.nombre, 1);
  });

  test('hors ligne : rien n’est demandé ni retenu ; de retour en ligne, le lot est demandé, une fois', () => {
    // Une requête lancée hors ligne échouerait, et le chargeur garde la promesse d'un lot en échec : l'écran de
    // résultats ne se chargerait plus de la session, même revenu en ligne.
    let enLigne = false;
    const { appels, charger } = chargeur();
    const precharger = creerPrechargeur(charger, () => enLigne);
    assert.equal(precharger(), 'hors_ligne');
    assert.equal(precharger(), 'hors_ligne');
    assert.equal(appels.nombre, 0);
    enLigne = true;
    assert.equal(precharger(), 'lance');
    assert.equal(precharger(), 'deja_lance');
    assert.equal(appels.nombre, 1);
  });

  test('un échec du chargement est absorbé, sans nouvel appel', async () => {
    const rejets: unknown[] = [];
    const surRejet = (raison: unknown) => rejets.push(raison);
    process.on('unhandledRejection', surRejet);
    try {
      const { appels, charger } = chargeur(true);
      const precharger = creerPrechargeur(charger, () => true);
      assert.equal(precharger(), 'lance');
      // Laisse passer les tâches en attente : une promesse rejetée non gérée serait signalée ici.
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(precharger(), 'deja_lance');
      assert.equal(appels.nombre, 1);
      assert.deepEqual(rejets, []);
    } finally {
      process.off('unhandledRejection', surRejet);
    }
  });
});
