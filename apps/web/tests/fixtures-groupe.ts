// Aides partagées par les tests du groupe : états de test (profil principal et profils supplémentaires), liste des projets,
// générateur du hasard à graine fixe. Ce fichier n'est pas un test : sans suffixe `.test.ts`, `npm run test:web` ne le lit pas.
import { createInitialWizardState } from '@opco/core';
import type { ProfilSupplementaire, ProjetType, WizardState } from '@opco/core';
import { nouveauProfil } from '../src/lib/groupe';

export const etat = (maj: Partial<WizardState> = {}): WizardState => ({
  ...createInitialWizardState(),
  projetType: 'formation_salarie',
  ...maj,
});
export const extra = (id: string, maj: Partial<ProfilSupplementaire> = {}): ProfilSupplementaire => ({
  ...nouveauProfil(etat()),
  id,
  ...maj,
});
/** Un état dont les profils ont ces projets, d'une personne chacun : le premier est le projet du profil principal. */
export const avec = (...projets: WizardState['projetType'][]): WizardState => {
  const [principal, ...autres] = projets;
  return etat({ projetType: principal, autresProfils: autres.map((p, i) => extra(`profil-${i + 2}`, { projetType: p })) });
};

export const PROJETS: ProjetType[] = [
  'formation_salarie',
  'reconversion_salarie',
  'recrutement_demandeur_emploi',
  'alternance',
  'formation_dirigeant',
];
/** Un état dont le profil principal compte `principal` personnes, suivi de profils supplémentaires (profil-2, profil-3...) de ces effectifs. */
export const groupeDe = (principal: number, autres: number[], maj: Partial<WizardState> = {}): WizardState =>
  etat({ ...maj, nombrePersonnes: principal, autresProfils: autres.map((nombre, i) => extra(`profil-${i + 2}`, { nombre })) });
/** Le même état que `avec(...projets)`, avec 2 000 € de budget déjà consommé. */
export const avecBudget = (...projets: WizardState['projetType'][]): WizardState => ({ ...avec(...projets), budgetDejaConsomme: 2000 });
/** mulberry32 : tirages reproductibles dans [0, 1[ pour une graine donnée. */
export const hasardFixe = (graine: number): (() => number) => {
  let g = graine;
  return () => {
    g = (g + 0x6d2b79f5) | 0;
    let t = Math.imul(g ^ (g >>> 15), 1 | g);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
