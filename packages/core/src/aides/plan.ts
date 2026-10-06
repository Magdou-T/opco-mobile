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
  /** Coût pédagogique + frais annexes saisis. */
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

function confianceOpco(r: FundingResult): Confidence {
  const lignes = r.lines.filter((l) => l.fundedAmount > 0);
  if (lignes.some((l) => l.confidence === 'depends_on_branche')) return 'depends_on_branche';
  if (lignes.some((l) => l.confidence === 'estimated')) return 'estimated';
  return 'exact';
}

interface Candidat extends LignePlan {
  ordre: number;
}

export function construirePlan(opco: FundingResult | null, aides: AideEvaluee[], profil: ProfilAides): PlanFinancement {
  const coutFormation = arrondi((profil.coutPedagogique ?? 0) + profil.coutFraisAnnexes);
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
        candidats.push({ ordre: 12, id: `opco-${d.id}`, nom: d.nom, financeurNom: opco.opcoName, montant: d.montantEstime, confidence: d.confidence });
      }
    }
  }

  // 2. Aides éligibles du catalogue (les aides « à vérifier » ne sont jamais comptées)
  const eligibles = aides.filter((a) => a.statut === 'eligible');
  // Aides « au choix » (alternatives déclarées dans un sens ou dans l'autre) : sélection gloutonne, des
  // mieux chiffrées aux moins bien chiffrées (à égalité, l'ordre de la liste évaluée est conservé, le tri
  // étant stable) ; une aide dont une alternative est déjà retenue devient une option. Ce choix est
  // indépendant de l'ordre dans lequel les alternatives sont déclarées et ne fusionne pas des aides
  // seulement liées par un tiers (a–b, b–c : a et c peuvent être retenues ensemble).
  const retenues = new Set<string>();
  const ecartees = new Set<string>();
  const parMontant = [...eligibles].sort((x, y) => (y.montantEstime ?? -1) - (x.montantEstime ?? -1));
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
        if (a.cumulable) candidats.push({ ...ligne, ordre: a.ordreEmpilement });
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
    }
  }

  // 3. Empilement plafonné au reste à charge
  candidats.sort((x, y) => x.ordre - y.ordre || y.montant - x.montant);
  const financements: LignePlan[] = [];
  let reste = coutFormation;
  for (const c of candidats) {
    if (reste <= 0) break;
    const montant = arrondi(Math.min(c.montant, reste));
    if (montant <= 0) continue;
    financements.push({ id: c.id, nom: c.nom, financeurNom: c.financeurNom, montant, confidence: c.confidence });
    reste = arrondi(reste - montant);
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
