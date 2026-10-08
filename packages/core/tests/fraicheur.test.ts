// ============================================================
// Fraîcheur des données embarquées par rapport à la date du jour : chaque aide, chaque portail régional et chaque OPCO doit
// avoir été vérifié il y a moins de 12 mois. C'est le seul fichier de tests du cœur qui lit l'horloge : il est exclu de
// `npm test` (vitest.config.ts), pour que l'intégration continue ne passe pas au rouge un jour donné sans modification du code,
// et lancé à part par `npm run test:fraicheur` (workflow hebdomadaire). Son échec signale qu'une revue des données est due.
// La variable d'environnement FRAICHEUR_AUJOURDHUI (AAAA-MM-JJ), lue par ce seul fichier, remplace la date du jour pour
// vérifier le contrôle : avec FRAICHEUR_AUJOURDHUI=2027-10-01, `npm run test:fraicheur` échoue.
// ============================================================

import { describe, it, expect } from 'vitest';
import { EMBEDDED_AIDES, EMBEDDED_OPCOS, EMBEDDED_PORTAILS } from '../src/data';
import { controlerFraicheur } from './dates-donnees';

/** Date du jour, ou celle de FRAICHEUR_AUJOURDHUI (AAAA-MM-JJ) quand elle est renseignée. */
function aujourdhui(): Date {
  const simulee = process.env.FRAICHEUR_AUJOURDHUI;
  if (simulee == null || simulee === '') return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(simulee)) {
    throw new Error(`FRAICHEUR_AUJOURDHUI attendue au format AAAA-MM-JJ, reçu « ${simulee} »`);
  }
  return new Date(`${simulee}T00:00:00Z`);
}

const maintenant = aujourdhui();

describe(`fraîcheur des données au ${maintenant.toISOString().slice(0, 10)} : vérifiées il y a moins de 12 mois`, () => {
  it("chaque aide du catalogue", () => {
    expect(controlerFraicheur(EMBEDDED_AIDES, maintenant)).toEqual([]);
  });

  it('chaque portail régional', () => {
    const portails = EMBEDDED_PORTAILS.map((p) => ({ id: `portail ${p.region}`, derniere_verification: p.derniere_verification }));
    expect(controlerFraicheur(portails, maintenant)).toEqual([]);
  });

  it('chaque OPCO', () => {
    const opcos = EMBEDDED_OPCOS.map((o) => ({ id: o.slug, derniere_verification: o.derniere_verification ?? '' }));
    expect(opcos.filter((o) => !/^\d{4}-\d{2}-\d{2}$/.test(o.derniere_verification)).map((o) => o.id)).toEqual([]);
    expect(controlerFraicheur(opcos, maintenant)).toEqual([]);
  });
});
