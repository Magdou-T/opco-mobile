// ============================================================
// Plan de financement : empile les financements cumulables de la
// formation dans un ordre défini, chacun plafonné au reste à charge
// (le total ne dépasse jamais le coût). Les aides à l'employeur, les
// rémunérations et les avantages fiscaux/sociaux sont présentés à part.
// ============================================================

import type { Confidence, FundingResult, PosteFinancement } from '../types';
import type { AideEvaluee, ProfilAides } from './types';

export interface LignePlan {
  id: string;
  nom: string;
  financeurNom: string;
  montant: number;
  confidence: Confidence;
}

export interface OptionPlan {
  id: string;
  nom: string;
  financeurNom: string;
  montantEstime: number | null;
  raison: string;
}

export interface PlanFinancement {
  /** Coût pédagogique + frais annexes saisis ; 0 quand le coût pédagogique est inconnu, jamais négatif. */
  coutFormation: number;
  financements: LignePlan[];
  totalFinance: number;
  resteACharge: number;
  aidesEmployeur: LignePlan[];
  remunerations: LignePlan[];
  avantagesFiscauxSociaux: LignePlan[];
  options: OptionPlan[];
  nonChiffrees: AideEvaluee[];
  servicesGratuits: AideEvaluee[];
}

const arrondi = (n: number): number => Math.round(n * 100) / 100;
const POSTES_FORMATION: PosteFinancement[] = ['pedagogie', 'hebergement', 'restauration', 'frais_annexes'];

/**
 * Fiabilité de la ligne `opco-pdc` : la plus faible des lignes financées qu'elle contient, c'est-à-dire les postes de
 * formation (du plus faible au plus fort : `depends_on_branche`, `estimated`, `exact`). Les salaires et le transport sont
 * des aides à l'employeur présentées à part, avec leur propre fiabilité : ils n'entrent pas dans cette ligne. Exception :
 * quand le plafond annuel a été appliqué (`budgetCapApplied`), le calcul rééchelonne chaque ligne avec un même ratio ; le
 * montant de formation dépend alors aussi de l'estimation des salaires, donc toutes les lignes financées comptent (choix
 * prudent : `budgetCapApplied` est aussi vrai quand le plafond ne limite que la pédagogie).
 */
function confianceOpco(r: FundingResult): Confidence {
  const lignes = r.lines.filter((l) => l.fundedAmount > 0 && (r.budgetCapApplied || POSTES_FORMATION.includes(l.poste)));
  if (lignes.some((l) => l.confidence === 'depends_on_branche')) return 'depends_on_branche';
  if (lignes.some((l) => l.confidence === 'estimated')) return 'estimated';
  return 'exact';
}

interface Candidat extends LignePlan {
  ordre: number;
  /** Aide prélevée sur le solde CPF du bénéficiaire (`modeMontant === 'solde_cpf'`) : un même solde ne finance qu'une fois. */
  surSoldeCpf: boolean;
}

/**
 * Plan de financement d'une formation : ce que chaque financeur prend en charge, le reste à charge, et ce qui est présenté à part.
 *
 * - Entrée : `aides` doit être la sortie de `evaluerAides`. Le tri de ce plan est stable : à montants et pivots égaux,
 *   l'ordre de cette liste départage. Seules les aides `eligible` comptent : les aides « à vérifier » et non éligibles ne
 *   figurent nulle part dans le plan.
 * - Empilement : la ligne OPCO (`opco-pdc`, ordre 10), les dispositifs OPCO chiffrés `additif` et `hors_budget` (ordre 12) et
 *   les aides cumulables de catégorie `cout_formation` (leur `ordreEmpilement`) sont empilés par ordre croissant, la plus
 *   grosse d'abord à ordre égal, chacun plafonné au reste à charge : le total ne dépasse jamais le coût de la formation.
 *   Ce coût est nul quand le coût pédagogique est inconnu (jamais les frais annexes seuls) et jamais négatif.
 * - Solde CPF : les aides qui prélèvent sur le solde CPF (`modeMontant === 'solde_cpf'`) partagent UN seul solde, celui du
 *   profil (`soldeCpf`, nul s'il est inconnu) : chacune est plafonnée par le reste à charge et par ce qui reste du solde
 *   après les aides empilées avant elle. Une autre aide chiffrée du financeur CPF n'est pas concernée : elle s'empile en plus
 *   du solde (la dotation volontaire de l'employeur, son propre argent, n'est pas chiffrée et n'est donc jamais empilée).
 * - Aides « au choix » (alternatives déclarées dans un sens ou dans l'autre) : la sélection est GLOUTONNE, pas optimale.
 *   Des mieux chiffrées aux moins bien chiffrées ; à montant égal, le pivot (l'aide déclarée comme alternative par le plus
 *   grand nombre d'autres aides éligibles), puis l'ordre de la liste. Une aide dont une alternative est déjà retenue devient
 *   une option. Une aide plafonnée à 0 € (coût déjà couvert, solde CPF partagé épuisé) n'apparaît ni dans `financements` ni
 *   dans `options` : le gagnant nommé dans la raison d'une option (`Au choix avec « X »`) peut donc lui-même être absent des
 *   listes, et l'écran ne doit pas compter sur son affichage.
 * - À part, jamais déduits du coût : aides à l'employeur, rémunérations, avantages fiscaux et sociaux ; les aides sans
 *   montant sont dans `nonChiffrees` et les services gratuits dans `servicesGratuits`.
 * - Les dispositifs OPCO `additif` et `hors_budget` sans montant chiffré n'apparaissent pas dans le plan : l'écran lit
 *   `FundingResult.dispositifsComplementaires` pour les afficher.
 */
export function construirePlan(opco: FundingResult | null, aides: AideEvaluee[], profil: ProfilAides): PlanFinancement {
  // Coût pédagogique inconnu : coût de la formation inconnu, donc nul (jamais les frais annexes seuls) ; jamais négatif.
  const coutFormation =
    profil.coutPedagogique == null ? 0 : Math.max(0, arrondi(profil.coutPedagogique + profil.coutFraisAnnexes));
  const candidats: Candidat[] = [];
  const aidesEmployeur: LignePlan[] = [];
  const remunerations: LignePlan[] = [];
  const avantagesFiscauxSociaux: LignePlan[] = [];
  const options: OptionPlan[] = [];
  const nonChiffrees: AideEvaluee[] = [];
  const servicesGratuits: AideEvaluee[] = [];

  // 1. OPCO : plan de développement des compétences et dispositifs complémentaires
  if (opco) {
    const formation = opco.lines
      .filter((l) => POSTES_FORMATION.includes(l.poste))
      .reduce((s, l) => s + l.fundedAmount, 0);
    if (formation > 0) {
      candidats.push({
        ordre: 10,
        surSoldeCpf: false,
        id: 'opco-pdc',
        nom: 'Plan de développement des compétences',
        financeurNom: opco.opcoName,
        montant: arrondi(formation),
        confidence: confianceOpco(opco),
      });
    }
    const salaires = opco.lines.find((l) => l.poste === 'salaires');
    if (salaires && salaires.fundedAmount > 0) {
      aidesEmployeur.push({
        id: 'opco-salaires',
        nom: 'Prise en charge des salaires pendant la formation',
        financeurNom: opco.opcoName,
        montant: salaires.fundedAmount,
        confidence: salaires.confidence,
      });
    }
    const transport = opco.lines.find((l) => l.poste === 'transport');
    if (transport && transport.fundedAmount > 0) {
      aidesEmployeur.push({
        id: 'opco-transport',
        nom: 'Forfait de frais de transport',
        financeurNom: opco.opcoName,
        montant: transport.fundedAmount,
        confidence: transport.confidence,
      });
    }
    for (const d of opco.dispositifsComplementaires) {
      if (d.cumul === 'alternatif') {
        options.push({
          id: `opco-${d.id}`,
          nom: d.nom,
          financeurNom: opco.opcoName,
          montantEstime: d.montantEstime,
          raison: 'Alternative au plan de développement des compétences (non cumulable)',
        });
      } else if (d.montantEstime != null && d.montantEstime > 0) {
        candidats.push({
          ordre: 12,
          surSoldeCpf: false,
          id: `opco-${d.id}`,
          nom: d.nom,
          financeurNom: opco.opcoName,
          montant: d.montantEstime,
          confidence: d.confidence,
        });
      }
    }
  }

  // 2. Aides éligibles du catalogue (les aides « à vérifier » ne sont jamais comptées)
  const eligibles = aides.filter((a) => a.statut === 'eligible');
  // Aides « au choix » (alternatives déclarées dans un sens ou dans l'autre) : sélection gloutonne, des
  // mieux chiffrées aux moins bien chiffrées. À montant égal, l'aide citée comme alternative par le plus
  // grand nombre d'autres aides éligibles l'emporte : le « pivot », l'aide générale que les aides
  // spécialisées citent (dans un graphe « en étoile », retenue la première, elle écarte toutes les
  // feuilles) ; puis l'ordre de la liste évaluée départage (le tri est stable). Le sens dans lequel une
  // alternative est déclarée n'intervient que par ce décompte. Une aide dont une alternative est déjà
  // retenue devient une option. Le choix ne fusionne pas des aides seulement liées par un tiers (a–b,
  // b–c : a et c peuvent être retenues ensemble).
  const retenues = new Set<string>();
  const ecartees = new Set<string>();
  const parMontant = eligibles
    .map((a) => ({ a, declarations: eligibles.filter((x) => x !== a && x.alternatives.includes(a.id)).length }))
    .sort((x, y) => (y.a.montantEstime ?? -1) - (x.a.montantEstime ?? -1) || y.declarations - x.declarations)
    .map(({ a }) => a);
  for (const a of parMontant) {
    const gagnant = parMontant.find(
      (x) => retenues.has(x.id) && (a.alternatives.includes(x.id) || x.alternatives.includes(a.id)),
    );
    if (gagnant) {
      ecartees.add(a.id);
      options.push({
        id: a.id,
        nom: a.nom,
        financeurNom: a.financeurNom,
        montantEstime: a.montantEstime,
        raison: `Au choix avec « ${gagnant.nom} »`,
      });
    } else {
      retenues.add(a.id);
    }
  }

  for (const a of eligibles) {
    if (ecartees.has(a.id)) continue;
    if (a.categorie === 'service_gratuit') {
      servicesGratuits.push(a);
      continue;
    }
    if (a.montantEstime == null) {
      nonChiffrees.push(a);
      continue;
    }
    const ligne: LignePlan = { id: a.id, nom: a.nom, financeurNom: a.financeurNom, montant: a.montantEstime, confidence: a.confidence };
    switch (a.categorie) {
      case 'cout_formation':
        if (a.cumulable) candidats.push({ ...ligne, ordre: a.ordreEmpilement, surSoldeCpf: a.modeMontant === 'solde_cpf' });
        else {
          options.push({
            id: a.id,
            nom: a.nom,
            financeurNom: a.financeurNom,
            montantEstime: a.montantEstime,
            raison: 'Non cumulable avec les autres financements : à comparer',
          });
        }
        break;
      case 'aide_employeur':
        aidesEmployeur.push(ligne);
        break;
      case 'remuneration_beneficiaire':
        remunerations.push(ligne);
        break;
      case 'avantage_fiscal_social':
        avantagesFiscauxSociaux.push(ligne);
        break;
      default: {
        // Garde d'exhaustivité : une nouvelle catégorie d'aide ne compile plus tant qu'elle n'est pas traitée ici.
        const _categorieNonTraitee: never = a.categorie;
        break;
      }
    }
  }

  // 3. Empilement plafonné au reste à charge ; les aides prélevées sur le solde CPF le sont aussi au solde restant
  candidats.sort((x, y) => x.ordre - y.ordre || y.montant - x.montant);
  const financements: LignePlan[] = [];
  let reste = coutFormation;
  let soldeCpfRestant = profil.soldeCpf ?? 0;
  for (const c of candidats) {
    if (reste <= 0) break;
    const montant = arrondi(Math.min(c.montant, c.surSoldeCpf ? Math.min(reste, soldeCpfRestant) : reste));
    if (montant <= 0) continue;
    financements.push({ id: c.id, nom: c.nom, financeurNom: c.financeurNom, montant, confidence: c.confidence });
    reste = arrondi(reste - montant);
    if (c.surSoldeCpf) soldeCpfRestant = arrondi(soldeCpfRestant - montant);
  }
  const resteACharge = Math.max(0, reste);

  return {
    coutFormation,
    financements,
    totalFinance: arrondi(coutFormation - resteACharge),
    resteACharge,
    aidesEmployeur,
    remunerations,
    avantagesFiscauxSociaux,
    options,
    nonChiffrees,
    servicesGratuits,
  };
}
