// ============================================================
// Évaluation des aides pour un profil : statut d'éligibilité,
// raisons, montant estimé. Fonctions pures (date de référence en paramètre).
// ============================================================

import { evaluerCriteres, regionDeReference } from './criteres';
import {
  ORDRE_EMPILEMENT_DEFAUT,
  type Aide,
  type AideEvaluee,
  type MontantAide,
  type ProfilAides,
  type StatutEligibilite,
} from './types';

const arrondi = (n: number): number => Math.round(n * 100) / 100;

/**
 * Heures de formation par mois à temps plein : 35 h × 52 semaines / 12 mois.
 * Base prudente : un temps partiel dure plus longtemps pour les mêmes heures, donc la durée en mois (et le montant
 * d'une aide `par_mois`) est plutôt sous-estimée que surestimée.
 */
export const HEURES_PAR_MOIS_TEMPS_PLEIN = 151.67;

const MENTION_LIMITE_COUT = '(limité au coût de la formation)';

/** Ajoute la mention de limite au libellé, avant le point final s'il y en a un (jamais de double point). */
function avecMentionLimiteCout(libelle: string): string {
  return libelle.endsWith('.') && !libelle.endsWith('..')
    ? `${libelle.slice(0, -1)} ${MENTION_LIMITE_COUT}.`
    : `${libelle} ${MENTION_LIMITE_COUT}`;
}

/** AAAA-MM-JJ → JJ/MM/AAAA */
export function formaterDate(iso: string): string {
  const [annee, mois, jour] = iso.split('-');
  return annee && mois && jour ? `${jour}/${mois}/${annee}` : iso;
}

/**
 * Montant estimé d'une aide pour le profil (`null` si non chiffrable : le libellé seul s'affiche alors).
 *
 * La première majoration dont tous les critères sont remplis remplace la valeur, le pourcentage et le plafond qu'elle
 * renseigne (un `plafond: null` explicite lève le plafond de l'aide) ainsi que le libellé.
 *
 * Selon le mode :
 * - `forfait` : la valeur ;
 * - `pourcentage` : pourcentage du coût pédagogique (ou du coût total, frais annexes compris) ; `null` si ce coût est inconnu ;
 * - `par_heure` : valeur × durée de la formation ; `null` si la durée est inconnue ;
 * - `par_mois` : versé chaque mois de formation, au prorata de la durée de la formation à temps plein
 *   (durée en heures / `HEURES_PAR_MOIS_TEMPS_PLEIN`), dans la limite de `duree_max_mois` ; `null` si la valeur, la durée
 *   maximale ou la durée de la formation est inconnue. Pour une aide versée sur une période indépendante de la
 *   formation, utiliser `forfait` avec le total maximal ;
 * - `solde_cpf` : le solde CPF connu ; `non_chiffre` : jamais d'estimation.
 *
 * Le plafond (de l'aide ou de la majoration) s'applique ensuite au total ; le résultat est arrondi aux centimes et
 * jamais négatif.
 */
export function estimerMontant(m: MontantAide, p: ProfilAides): { montant: number | null; libelle: string } {
  let valeur = m.valeur;
  let pourcentage = m.pourcentage;
  let plafond = m.plafond;
  let libelle = m.libelle;

  for (const maj of m.majorations ?? []) {
    if (evaluerCriteres(maj.criteres, p).etat === 'ok') {
      if (maj.valeur !== undefined) valeur = maj.valeur;
      if (maj.pourcentage !== undefined) pourcentage = maj.pourcentage;
      if (maj.plafond !== undefined) plafond = maj.plafond;
      libelle = maj.libelle;
      break;
    }
  }

  let montant: number | null = null;
  switch (m.mode) {
    case 'forfait':
      montant = valeur;
      break;
    case 'pourcentage': {
      const base =
        m.base === 'cout_total'
          ? p.coutPedagogique != null
            ? p.coutPedagogique + p.coutFraisAnnexes
            : null
          : p.coutPedagogique;
      montant = base != null && pourcentage != null ? (base * pourcentage) / 100 : null;
      break;
    }
    case 'par_heure':
      montant = valeur != null && p.dureeHeures != null ? valeur * p.dureeHeures : null;
      break;
    case 'par_mois':
      montant =
        valeur != null && m.duree_max_mois != null && p.dureeHeures != null
          ? valeur * Math.min(m.duree_max_mois, p.dureeHeures / HEURES_PAR_MOIS_TEMPS_PLEIN)
          : null;
      break;
    case 'solde_cpf':
      montant = p.soldeCpf;
      break;
    case 'non_chiffre':
      montant = null;
      break;
  }

  if (montant != null && plafond != null) montant = Math.min(montant, plafond);
  return { montant: montant != null ? Math.max(0, arrondi(montant)) : null, libelle };
}

export function evaluerAide(aide: Aide, p: ProfilAides, dateRef: string): AideEvaluee {
  const exclusions: string[] = [];
  const doutes: string[] = [];

  if (!aide.projets.includes(p.projet)) exclusions.push('Ne concerne pas ce type de projet');
  if (!aide.beneficiaires.includes(p.statutBeneficiaire)) exclusions.push('Ne concerne pas ce public');
  if (aide.statut === 'suspendu') exclusions.push('Dispositif suspendu : pas de nouvelle demande possible actuellement');
  if (aide.validite.fin != null && aide.validite.fin < dateRef) {
    exclusions.push(`Dispositif terminé le ${formaterDate(aide.validite.fin)}`);
  }

  const bilan = evaluerCriteres(aide.criteres, p);
  exclusions.push(...bilan.raisonsKo);
  doutes.push(...bilan.raisonsInconnu);
  if (aide.statut === 'a_confirmer') doutes.push('Montant ou conditions en cours de confirmation auprès du financeur');
  if (aide.validite.debut != null && aide.validite.debut > dateRef) {
    doutes.push(`Dispositif ouvert à partir du ${formaterDate(aide.validite.debut)}`);
  }

  const statut: StatutEligibilite = exclusions.length > 0 ? 'non_eligible' : doutes.length > 0 ? 'a_verifier' : 'eligible';
  const { montant, libelle } = estimerMontant(aide.montant, p);
  // Une aide de coût de formation ne peut pas financer plus que le coût connu de la formation.
  const coutConnu = p.coutPedagogique != null ? p.coutPedagogique + p.coutFraisAnnexes : null;
  const plafonne = aide.categorie === 'cout_formation' && montant != null && coutConnu != null && montant > coutConnu;
  const montantFinal = plafonne ? arrondi(coutConnu) : montant;
  const libelleFinal = plafonne ? avecMentionLimiteCout(libelle) : libelle;
  const region = regionDeReference(aide.criteres, p);
  // Pour le seul lien : sans région de référence, on prend la région connue du bénéficiaire, puis celle de l'entreprise.
  const regionDuLien = region ?? p.regionBeneficiaire ?? p.regionEntreprise;
  const lienRegional = regionDuLien ? aide.liens_par_region?.[regionDuLien] : undefined;
  const autreRegion = !!aide.criteres.regions?.length && region != null && !aide.criteres.regions.includes(region);
  const horsPerimetre =
    !aide.projets.includes(p.projet) || !aide.beneficiaires.includes(p.statutBeneficiaire) || autreRegion;

  return {
    id: aide.id,
    nom: aide.nom,
    financeur: aide.financeur,
    financeurNom: aide.financeur_nom,
    categorie: aide.categorie,
    description: aide.description,
    statut,
    raisons: exclusions.length > 0 ? exclusions : doutes,
    horsPerimetre,
    conditions: aide.conditions,
    montantEstime: montantFinal,
    libelleMontant: libelleFinal,
    cumulable: aide.cumul.cumulable,
    alternatives: aide.cumul.alternatives ?? [],
    noteCumul: aide.cumul.note ?? null,
    demarches: aide.demarches,
    urlDemarche: lienRegional ?? aide.url_demarche,
    sources: aide.sources,
    derniereVerification: aide.derniere_verification,
    confidence: aide.confidence,
    ordreEmpilement: aide.ordre_empilement ?? ORDRE_EMPILEMENT_DEFAUT[aide.financeur],
  };
}

const RANG: Record<StatutEligibilite, number> = { eligible: 0, a_verifier: 1, non_eligible: 2 };

/** Comparaison par valeur de code, sans Intl : le même ordre sur tous les moteurs (l'ordre des accents n'a pas d'importance). */
const comparer = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Évalue toutes les aides et les trie : éligibles, puis à vérifier, puis non éligibles ; à statut égal, montant estimé
 * décroissant (un montant non chiffré après un montant de 0 €), puis nom (sans tenir compte de la casse), puis identifiant.
 */
export function evaluerAides(aides: Aide[], p: ProfilAides, dateRef: string): AideEvaluee[] {
  return aides
    .map((a) => evaluerAide(a, p, dateRef))
    .sort(
      (a, b) =>
        RANG[a.statut] - RANG[b.statut] ||
        (b.montantEstime ?? -1) - (a.montantEstime ?? -1) ||
        comparer(a.nom.toLowerCase(), b.nom.toLowerCase()) ||
        comparer(a.id, b.id),
    );
}
