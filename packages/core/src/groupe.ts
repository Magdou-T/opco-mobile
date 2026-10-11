// ============================================================
// Plusieurs personnes formées en même temps : profils du groupe, effectif, état d'une personne d'un profil.
// Fonctions pures : aucune E/S, aucune lecture de l'horloge. La répartition du résultat de l'OPCO, le plan d'un profil et
// la fusion des résultats des profils sont dans le même fichier.
// ============================================================

import { trierAidesEvaluees } from './aides/evaluer';
import { construirePlan } from './aides/plan';
import type { LignePlan, OptionPlan, PlanFinancement } from './aides/plan';
import { ORDRE_EMPILEMENT_DEFAUT } from './aides/types';
import type { AideEvaluee, ProfilAides, StatutEligibilite } from './aides/types';
import { MAX_PERSONNES } from './types';
import type { ChampsProfil, Confidence, FundingResult, WizardState } from './types';

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

// --- Plan de financement d'un profil, fusion des plans --------------------------------------------------------------

/**
 * Plan de financement d'un profil du groupe : celui de `construirePlan` appliqué à un bloc de `nombre` personnes.
 * `opco` est la part de ce profil dans le résultat de l'OPCO (déjà valable pour `nombre` personnes) ; `aides` et `profil`
 * sont ceux d'UNE personne. Le coût de la formation, le solde CPF et les montants des aides sont multipliés par `nombre`
 * (une aide limitée au coût d'une personne le reste au coût du bloc), de sorte que l'empilement (ordre, plafond au reste
 * à charge, solde CPF partagé, aides « au choix ») suit les règles d'une personne, appliquées aux montants du bloc.
 * Pour une seule personne, c'est exactement `construirePlan`. Chaque ligne du plan d'un bloc de plusieurs personnes porte
 * `personnes`. `nombre` est ramené à un entier de 1 à MAX_PERSONNES (99), comme les effectifs de `profilsDuGroupe` et de
 * `nombreDePersonnes` : une valeur non finie (NaN ou Infinity), nulle ou négative vaut une personne, une valeur décimale est
 * arrondie à l'entier inférieur (2,5 vaut 2), une valeur finie supérieure à 99 vaut 99 ; `personnes` porte cet effectif
 * ramené.
 */
export function construirePlanDuBloc(
  opco: FundingResult | null,
  aides: readonly AideEvaluee[],
  profil: ProfilAides,
  nombre: number,
): PlanFinancement {
  const n = effectifValide(nombre);
  if (n <= 1) return construirePlan(opco, [...aides], profil);
  const fois = (montant: number | null): number | null => (montant == null ? null : enEuros(enCentimes(montant * n)));
  const plan = construirePlan(
    opco,
    aides.map((a) => ({ ...a, montantEstime: fois(a.montantEstime) })),
    {
      ...profil,
      coutPedagogique: profil.coutPedagogique == null ? null : profil.coutPedagogique * n,
      coutFraisAnnexes: profil.coutFraisAnnexes * n,
      soldeCpf: profil.soldeCpf == null ? null : profil.soldeCpf * n,
    },
  );
  const marquer = (lignes: LignePlan[]): LignePlan[] => lignes.map((l) => ({ ...l, personnes: n }));
  return {
    ...plan,
    financements: marquer(plan.financements),
    aidesEmployeur: marquer(plan.aidesEmployeur),
    remunerations: marquer(plan.remunerations),
    avantagesFiscauxSociaux: marquer(plan.avantagesFiscauxSociaux),
  };
}

const POIDS_FIABILITE: Record<Confidence, number> = { depends_on_branche: 0, estimated: 1, exact: 2 };
const plusFaible = (a: Confidence, b: Confidence): Confidence => (POIDS_FIABILITE[a] <= POIDS_FIABILITE[b] ? a : b);

/**
 * Plan du groupe : la fusion des plans de ses profils. Aucun plan : un plan vide. Un seul plan : rendu tel quel. Sinon,
 * coût, financé et reste s'additionnent en centimes entiers ; les lignes de même identifiant s'additionnent (montant,
 * `personnes`, la fiabilité la plus faible l'emporte, le nom et le financeur sont ceux de la première occurrence) ; les
 * financements sont triés par ordre d'empilement, puis par montant décroissant. L'ordre d'une ligne est d'abord
 * l'`ordreEmpilement` de l'aide de `aides` qui porte le même identifiant (il l'emporte sur la règle suivante, même pour un
 * identifiant qui commence par `opco-`), sinon 10 pour `opco-pdc` et 12 pour un dispositif de l'OPCO (`opco-` suivi de son
 * identifiant), sinon `ORDRE_EMPILEMENT_DEFAUT.autre` (85) pour un identifiant inconnu. Les options s'additionnent (montants
 * connus seulement, nul si aucun profil n'en a) ; les aides sans montant et les services gratuits sont réunis sans doublon.
 */
export function fusionnerPlans(
  plans: readonly PlanFinancement[],
  aides: readonly Pick<AideEvaluee, 'id' | 'ordreEmpilement'>[],
): PlanFinancement {
  if (plans.length === 1) return plans[0];
  const ordreParId = new Map(aides.map((a) => [a.id, a.ordreEmpilement]));
  const ordreDe = (id: string): number =>
    ordreParId.get(id) ?? (id === 'opco-pdc' ? 10 : id.startsWith('opco-') ? 12 : ORDRE_EMPILEMENT_DEFAUT.autre);
  const somme = (valeur: (p: PlanFinancement) => number): number => enEuros(plans.reduce((s, p) => s + enCentimes(valeur(p)), 0));

  const fusionnerLignes = (listes: readonly LignePlan[][]): LignePlan[] => {
    const parId = new Map<string, LignePlan>();
    for (const l of listes.flat()) {
      const deja = parId.get(l.id);
      if (!deja) {
        parId.set(l.id, { ...l, personnes: l.personnes ?? 1 });
      } else {
        deja.montant = enEuros(enCentimes(deja.montant) + enCentimes(l.montant));
        deja.confidence = plusFaible(deja.confidence, l.confidence);
        deja.personnes = (deja.personnes ?? 1) + (l.personnes ?? 1);
      }
    }
    return [...parId.values()];
  };

  const options = new Map<string, OptionPlan>();
  for (const o of plans.flatMap((p) => p.options)) {
    const deja = options.get(o.id);
    if (!deja) options.set(o.id, { ...o });
    else if (o.montantEstime != null) {
      deja.montantEstime = deja.montantEstime == null ? o.montantEstime : enEuros(enCentimes(deja.montantEstime) + enCentimes(o.montantEstime));
    }
  }

  const uniques = (listes: readonly AideEvaluee[][]): AideEvaluee[] => {
    const vues = new Map<string, AideEvaluee>();
    for (const a of listes.flat()) if (!vues.has(a.id)) vues.set(a.id, a);
    return [...vues.values()];
  };

  return {
    coutFormation: somme((p) => p.coutFormation),
    financements: fusionnerLignes(plans.map((p) => p.financements)).sort(
      (x, y) => ordreDe(x.id) - ordreDe(y.id) || y.montant - x.montant,
    ),
    totalFinance: somme((p) => p.totalFinance),
    resteACharge: somme((p) => p.resteACharge),
    aidesEmployeur: fusionnerLignes(plans.map((p) => p.aidesEmployeur)),
    remunerations: fusionnerLignes(plans.map((p) => p.remunerations)),
    avantagesFiscauxSociaux: fusionnerLignes(plans.map((p) => p.avantagesFiscauxSociaux)),
    options: [...options.values()],
    nonChiffrees: uniques(plans.map((p) => p.nonChiffrees)),
    servicesGratuits: uniques(plans.map((p) => p.servicesGratuits)),
  };
}

// --- Fusion des aides du catalogue ---------------------------------------------------------------------------------

const RANG_STATUT: Record<StatutEligibilite, number> = { eligible: 0, a_verifier: 1, non_eligible: 2 };

interface VueDeLAide {
  profil: ProfilDuGroupe;
  aide: AideEvaluee;
}

/** Une aide vue par plusieurs profils : le meilleur statut, le plus grand montant par personne, les profils concernés. */
function fusionnerUneAide(vues: VueDeLAide[]): AideEvaluee {
  // Meilleur statut d'abord, puis plus grand montant : c'est cette vue qui fournit tout ce qui ne dépend pas du profil.
  const meilleure = [...vues].sort(
    (a, b) => RANG_STATUT[a.aide.statut] - RANG_STATUT[b.aide.statut] || (b.aide.montantEstime ?? -1) - (a.aide.montantEstime ?? -1),
  )[0];
  const statut = meilleure.aide.statut;
  const concernees = vues.filter((v) => v.aide.statut !== 'non_eligible');
  const montants = concernees.map((v) => v.aide.montantEstime).filter((m): m is number => m != null);
  const montantMax = montants.length > 0 ? Math.max(...montants) : null;
  // Le profil qui porte le plus grand montant donne le libellé et le lien de la demande.
  const porteuse = montantMax == null ? meilleure : (concernees.find((v) => v.aide.montantEstime === montantMax) ?? meilleure);
  // Éligible : rien à confirmer. Sinon, les raisons des profils qui portent le statut retenu (jamais celles d'un profil pour
  // lequel l'aide est hors périmètre : « Ne concerne pas ce type de projet » n'a rien à faire dans la liste).
  const raisons =
    statut === 'eligible'
      ? []
      : [
          ...new Set(
            vues.filter((v) => v.aide.statut === statut && (statut !== 'non_eligible' || !v.aide.horsPerimetre)).flatMap((v) => v.aide.raisons),
          ),
        ];
  return {
    ...meilleure.aide,
    raisons,
    horsPerimetre: vues.every((v) => v.aide.horsPerimetre),
    montantEstime: statut === 'non_eligible' ? meilleure.aide.montantEstime : montantMax,
    libelleMontant: porteuse.aide.libelleMontant,
    urlDemarche: porteuse.aide.urlDemarche,
    profils: concernees.map((v) => ({
      profilId: v.profil.id,
      nombre: v.profil.nombre,
      statut: v.aide.statut,
      montantEstime: v.aide.montantEstime,
    })),
  };
}

/**
 * Aides du catalogue d'un groupe : une entrée par aide, fusion de ce que chaque profil en voit. Un seul profil : sa liste
 * telle quelle, sans champ `profils`. Plusieurs profils : le meilleur statut (éligible, puis à vérifier, puis non éligible) ;
 * `horsPerimetre` seulement si l'aide l'est pour tous les profils ; le plus grand montant PAR PERSONNE parmi les profils
 * éligibles ou à vérifier (« jusqu'à »), avec son libellé et son lien ; les raisons réunies sans doublon quand l'aide n'est
 * pas éligible ; `profils` : un élément par profil éligible ou à vérifier. La liste est triée comme une liste évaluée.
 */
export function fusionnerAides(blocs: readonly { profil: ProfilDuGroupe; aides: readonly AideEvaluee[] }[]): AideEvaluee[] {
  if (blocs.length === 1) return [...blocs[0].aides];
  const vuesParId = new Map<string, VueDeLAide[]>();
  for (const bloc of blocs) {
    for (const aide of bloc.aides) {
      const vues = vuesParId.get(aide.id);
      if (vues) vues.push({ profil: bloc.profil, aide });
      else vuesParId.set(aide.id, [{ profil: bloc.profil, aide }]);
    }
  }
  return trierAidesEvaluees([...vuesParId.values()].map(fusionnerUneAide));
}
