// ============================================================
// Dates des données embarquées : date de référence du jeu de données et contrôles de dates (fraîcheur, dates futures),
// partagés par les tests des données (donnees-aides, donnees-opco) et par le contrôle de fraîcheur (fraicheur.test.ts).
// Les tests de `npm test` ne lisent jamais l'horloge : ils comparent les dates à DATE_REFERENCE_DONNEES et restent verts
// quel que soit le jour où ils s'exécutent. Seul fraicheur.test.ts, exclu de `npm test` et lancé à part
// (`npm run test:fraicheur`, workflow hebdomadaire), compare les dates de vérification à la date du jour.
// ============================================================

/**
 * Date de référence du jeu de données embarqué (AAAA-MM-JJ) : celle de sa dernière revue. Aucune date de vérification ne
 * peut la dépasser de plus d'un jour : quand les données sont revues à une date postérieure, avancez cette constante.
 */
export const DATE_REFERENCE_DONNEES = '2026-10-08';

/** La date de référence du jeu de données, à minuit UTC. */
export const dateDeReference = (): Date => new Date(`${DATE_REFERENCE_DONNEES}T00:00:00Z`);

/** Entrée datée : une aide, un portail ou un OPCO, avec sa date de dernière vérification (AAAA-MM-JJ). */
export interface EntreeDatee {
  id: string;
  derniere_verification: string;
}

/** Nombre de mois civils entre la date de vérification (AAAA-MM-JJ) et `maintenant`. */
export function moisEcoules(date: string, maintenant: Date): number {
  const d = new Date(`${date}T00:00:00Z`);
  return (maintenant.getUTCFullYear() - d.getUTCFullYear()) * 12 + (maintenant.getUTCMonth() - d.getUTCMonth());
}

/** Entrées dont la dernière vérification remonte à 12 mois civils ou plus avant `maintenant`. */
export function controlerFraicheur(entrees: EntreeDatee[], maintenant: Date): string[] {
  return entrees
    .filter((e) => moisEcoules(e.derniere_verification, maintenant) >= 12)
    .map((e) => `${e.id} : dernière vérification le ${e.derniere_verification} (${moisEcoules(e.derniere_verification, maintenant)} mois)`);
}

/**
 * Entrées dont la dernière vérification est datée d'après le lendemain de `maintenant` : une date future est une faute de
 * frappe (2027 pour 2026), que le contrôle de fraîcheur ne voit pas (un écart négatif de mois reste « frais »), ou le signe
 * que la date de référence est à avancer. Le lendemain (UTC) est accepté : il peut être le jour même dans le fuseau de la
 * personne qui a vérifié.
 */
export function controlerDatesFutures(entrees: EntreeDatee[], maintenant: Date): string[] {
  const limite = new Date(maintenant.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return entrees
    .filter((e) => e.derniere_verification > limite)
    .map((e) => `${e.id} : dernière vérification le ${e.derniere_verification}, après le ${limite}`);
}
