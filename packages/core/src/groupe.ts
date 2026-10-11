// ============================================================
// Plusieurs personnes formées en même temps : profils du groupe, effectif, état d'une personne d'un profil.
// Fonctions pures : aucune E/S, aucune lecture de l'horloge. La répartition du résultat de l'OPCO, le plan d'un profil et
// la fusion des résultats des profils sont dans le même fichier.
// ============================================================

import { MAX_PERSONNES } from './types';
import type { ChampsProfil, FundingResult, WizardState } from './types';

/** Identifiant du profil principal (les champs de l'étape « Participants » de l'état). */
export const ID_PROFIL_PRINCIPAL = 'principal';

/** Un profil du groupe : son identifiant, le nombre de personnes qui l'ont et ses réponses. */
export interface ProfilDuGroupe {
  id: string;
  nombre: number;
  champs: ChampsProfil;
  principal: boolean;
}

/** Effectif ramené à un entier de 1 à MAX_PERSONNES (valeur absente, périmée ou non finie : 1). */
function effectifValide(valeur: unknown): number {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? Math.min(MAX_PERSONNES, Math.max(1, Math.floor(valeur))) : 1;
}

/** Les réponses du profil principal : les champs de l'étape « Participants » de l'état, projet compris. */
export function champsDuProfilPrincipal(state: WizardState): ChampsProfil {
  return {
    projetType: state.projetType,
    contractType: state.contractType,
    anciennete_mois: state.anciennete_mois,
    isHandicap: state.isHandicap,
    ageBeneficiaire: state.ageBeneficiaire,
    niveauDiplome: state.niveauDiplome,
    typeAlternance: state.typeAlternance,
    inscritFranceTravail: state.inscritFranceTravail,
    statutDirigeant: state.statutDirigeant,
    microEntrepreneur: state.microEntrepreneur,
    soldeCpf: state.soldeCpf,
    regionBeneficiaireCode: state.regionBeneficiaireCode,
  };
}

/**
 * Profils du groupe : le profil principal d'abord, puis les profils supplémentaires dans l'ordre de saisie. Les effectifs
 * sont ramenés à un entier de 1 à MAX_PERSONNES. Un projet non choisi reste `null` ici : l'appelant le lit comme
 * « former un salarié », comme pour une personne seule.
 */
export function profilsDuGroupe(state: WizardState): ProfilDuGroupe[] {
  const principal: ProfilDuGroupe = {
    id: ID_PROFIL_PRINCIPAL,
    nombre: effectifValide(state.nombrePersonnes),
    champs: champsDuProfilPrincipal(state),
    principal: true,
  };
  const autres = (state.autresProfils ?? []).map(
    ({ id, nombre, ...champs }): ProfilDuGroupe => ({ id, nombre: effectifValide(nombre), champs, principal: false }),
  );
  return [principal, ...autres];
}

/** Nombre de personnes du groupe : la somme des effectifs de tous les profils. */
export function nombreDePersonnes(state: Pick<WizardState, 'nombrePersonnes' | 'autresProfils'>): number {
  return (state.autresProfils ?? []).reduce((somme, p) => somme + effectifValide(p.nombre), effectifValide(state.nombrePersonnes));
}

/**
 * L'état d'UNE personne de ce profil : l'entreprise, la formation et les frais de l'état, les réponses du bénéficiaire
 * remplacées par celles du profil (les deux drapeaux de l'application mobile, `isReconversion` et `isSortieChomage`, que le
 * site ne pose pas, gardent la valeur de l'état). Aucun groupe ni prix de groupe : c'est ce que lisent `profilDepuisWizard`
 * et le moteur.
 */
export function etatDuProfil(state: WizardState, profil: ProfilDuGroupe): WizardState {
  return { ...state, ...profil.champs, nombrePersonnes: 1, autresProfils: [], prixDuGroupe: null };
}

// --- Répartition du résultat de l'OPCO entre les profils salariés ---------------------------------------------------

const enCentimes = (euros: number): number => Math.round(euros * 100);
const enEuros = (centimes: number): number => centimes / 100;

/**
 * Répartit `total` centimes entre des parts proportionnelles aux `effectifs`, en centimes entiers : chaque part reçoit
 * `floor(total × effectif / somme)`, puis les centimes qui restent vont aux parts qui ont la plus grande part décimale
 * (à égalité, à la première de la liste). La somme des parts égale toujours `total`. Des effectifs vides ou de somme nulle
 * donnent des parts nulles. Un total négatif est réparti comme sa valeur absolue, puis chaque part reprend le signe :
 * c'est une troncature vers zéro de la fraction entière, les centimes restants se distribuant comme pour un total positif.
 */
export function repartirCentimes(total: number, effectifs: readonly number[]): number[] {
  const somme = effectifs.reduce((s, e) => s + e, 0);
  if (effectifs.length === 0 || somme <= 0) return effectifs.map(() => 0);
  const signe = total < 0 ? -1 : 1;
  const montant = Math.abs(Math.round(total));
  const parts = effectifs.map((e) => Math.floor((montant * e) / somme));
  let reste = montant - parts.reduce((s, p) => s + p, 0);
  const parDecimale = effectifs
    .map((e, i) => ({ i, decimale: (montant * e) % somme }))
    .sort((a, b) => b.decimale - a.decimale || a.i - b.i);
  for (const { i } of parDecimale) {
    if (reste <= 0) break;
    parts[i] += 1;
    reste -= 1;
  }
  return parts.map((p) => (p === 0 ? 0 : signe * p));
}

/**
 * Répartit le résultat de l'OPCO d'un groupe entre ses profils salariés (`effectifs` : le nombre de personnes de chacun,
 * dans l'ordre des profils). Chaque ligne se répartit en centimes entiers, le financé et le reste à charge séparément (le
 * demandé d'une part est leur somme : il ne passe jamais sous le financé), puis le montant estimé de chaque dispositif et
 * l'enveloppe maximale. La somme des parts égale le groupe, poste par poste, au centime, pour le demandé et le financé. Le
 * reste à charge d'une part est son demandé moins son financé, et non le `remainder` de la ligne du groupe : le moteur
 * arrondit `remainder` sur les montants bruts, donc `remainder` peut différer d'un centime de demandé moins financé. Seul
 * demandé moins financé conserve à la fois la somme des demandés et celle des financés des parts. Les totaux de chaque
 * part se recalculent à partir de ses lignes. Sous le plafond annuel global, le moteur pose `totalFunded` au plafond
 * restant alors que ses lignes sont arrondies une à une : leur somme peut s'en écarter de quelques centimes, et la somme
 * des totaux des parts peut alors s'écarter de même du total du groupe. L'identité avec le groupe pour un seul profil ne
 * vaut donc que pour les lignes, hors `remainder` d'une ligne incohérente. L'enveloppe d'une part, répartie seule, peut
 * s'écarter de quelques centimes de son financé et de son demandé : ne pas l'y comparer. Le plafond annuel, le budget déjà
 * consommé, les textes et les drapeaux sont repris tels quels ; `personnes` vaut l'effectif de la part. Les textes de
 * détail restent ceux du groupe entier (« Coût pour 5 personnes : … ») : une part ne s'affiche jamais, seul le plan de son
 * profil en lit les montants.
 */
export function repartirFinancement(r: FundingResult, effectifs: readonly number[]): FundingResult[] {
  const lignes = r.lines.map((l) => ({
    finance: repartirCentimes(enCentimes(l.fundedAmount), effectifs),
    reste: repartirCentimes(enCentimes(l.requestedAmount) - enCentimes(l.fundedAmount), effectifs),
  }));
  const dispositifs = r.dispositifsComplementaires.map((d) =>
    d.montantEstime == null ? null : repartirCentimes(enCentimes(d.montantEstime), effectifs),
  );
  const enveloppe = repartirCentimes(enCentimes(r.enveloppeMaxPotentielle), effectifs);

  return effectifs.map((effectif, k) => {
    const lines = r.lines.map((l, j) => {
      const finance = lignes[j].finance[k];
      const reste = lignes[j].reste[k];
      return { ...l, requestedAmount: enEuros(finance + reste), fundedAmount: enEuros(finance), remainder: enEuros(reste) };
    });
    const demande = lines.reduce((s, l) => s + enCentimes(l.requestedAmount), 0);
    const finance = lines.reduce((s, l) => s + enCentimes(l.fundedAmount), 0);
    return {
      ...r,
      personnes: effectif,
      lines,
      totalRequested: enEuros(demande),
      totalFunded: enEuros(finance),
      totalRemainder: enEuros(demande - finance),
      dispositifsComplementaires: r.dispositifsComplementaires.map((d, j) => {
        const parts = dispositifs[j];
        return { ...d, montantEstime: parts == null ? null : enEuros(parts[k]) };
      }),
      enveloppeMaxPotentielle: enEuros(enveloppe[k]),
    };
  });
}
