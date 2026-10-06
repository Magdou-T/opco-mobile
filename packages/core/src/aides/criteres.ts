// ============================================================
// Évaluation des critères d'une aide, en trois états :
//   ok      : critère rempli
//   ko      : critère non rempli (raison « Réservé à … »)
//   inconnu : information manquante (raison « Précisez … » / « Vérifiez … »)
// ============================================================

import { REGIONS } from '../geo';
import {
  CERTIFICATION_LABELS,
  CONTRACT_TYPE_LABELS,
  NIVEAU_DIPLOME_LABELS,
  STATUT_DIRIGEANT_LABELS,
  TYPE_ALTERNANCE_LABELS,
  type CodeRegion,
} from '../types';
import type { CriteresAide, ProfilAides } from './types';

export type EtatCritere = 'ok' | 'ko' | 'inconnu';

export interface BilanCriteres {
  etat: EtatCritere;
  raisonsKo: string[];
  raisonsInconnu: string[];
}

export const OPCO_NOMS: Record<string, string> = {
  afdas: 'AFDAS',
  akto: 'AKTO',
  atlas: 'ATLAS',
  constructys: 'Constructys',
  ocapiat: 'OCAPIAT',
  'opco-ep': 'OPCO EP',
  'opco-mobilites': 'OPCO Mobilités',
  'opco-sante': 'OPCO Santé',
  opco2i: 'OPCO 2i',
  opcommerce: "L'Opcommerce",
  uniformation: 'Uniformation',
};

const LIBELLES_STRUCTURES = { ess: 'ESS', siae: "structure d'insertion (SIAE)", association: 'association' } as const;

const liste = (valeurs: string[]) => valeurs.join(', ');

/** Code NAF sans points et en majuscules : « 86.21z », « 8621Z » et « 86.21Z » désignent le même code. */
const normaliserNaf = (code: string): string => code.replace(/\./g, '').toUpperCase();

function trancheAge(min?: number, max?: number): string {
  if (min != null && max != null) {
    return min === max ? `Réservé aux personnes de ${min} ans` : `Réservé aux personnes de ${min} à ${max} ans`;
  }
  if (min != null) return `Réservé aux personnes de ${min} ans et plus`;
  return `Réservé aux personnes de ${max} ans au plus`;
}

/**
 * Région à laquelle l'aide se rapporte pour ce profil : celle du bénéficiaire (à défaut celle de l'entreprise) quand
 * l'aide est jugée sur sa résidence (`perimetre_region: 'beneficiaire'`), sinon celle de l'établissement.
 * `null` si elle est inconnue.
 */
export function regionDeReference(c: Pick<CriteresAide, 'perimetre_region'>, p: ProfilAides): CodeRegion | null {
  return c.perimetre_region === 'beneficiaire' ? (p.regionBeneficiaire ?? p.regionEntreprise) : p.regionEntreprise;
}

/**
 * Évalue les critères d'une aide pour un profil, en trois états (`ok`, `ko`, `inconnu`), avec les raisons de chaque
 * critère non rempli (`raisonsKo`) ou à vérifier (`raisonsInconnu`).
 *
 * - Tri-état : une information manquante dans le profil donne `inconnu` (jamais `ok` par défaut) ; un critère absent
 *   n'impose aucune contrainte.
 * - `ko` l'emporte sur `inconnu` : un seul critère non rempli suffit, même si d'autres informations manquent.
 * - `rqth`, `eligible_cpf` et `qualiopi_requis` ne sont évalués que lorsqu'ils valent `true` ; `false` n'ajoute aucune
 *   restriction.
 * - `departements` avec `perimetre_region: 'beneficiaire'` est toujours `inconnu` : le profil ne porte que le
 *   département de l'établissement, pas celui du bénéficiaire.
 * - Avec `perimetre_region: 'beneficiaire'`, la région du bénéficiaire par défaut est celle de l'entreprise (voir
 *   `regionDeReference`).
 * - `naf_prefixes` : préfixes du code NAF, sans tenir compte de la casse ni des points (`86.21Z` = `8621z`).
 */
export function evaluerCriteres(c: CriteresAide, p: ProfilAides): BilanCriteres {
  const ko: string[] = [];
  const inconnu: string[] = [];

  if (c.regions?.length) {
    const region = regionDeReference(c, p);
    if (region == null) inconnu.push('Précisez la région');
    else if (!c.regions.includes(region)) ko.push(`Réservé à : ${liste(c.regions.map((r) => REGIONS[r]))}`);
  }

  if (c.departements?.length) {
    if (c.perimetre_region === 'beneficiaire') {
      inconnu.push(`Vérifiez que le bénéficiaire réside dans l'un de ces départements : ${liste(c.departements)}`);
    } else if (p.departementEntreprise == null) {
      inconnu.push("Précisez le département de l'établissement");
    } else if (!c.departements.includes(p.departementEntreprise)) {
      ko.push(`Réservé aux départements : ${liste(c.departements)}`);
    }
  }

  if (c.effectif_max != null) {
    if (p.effectifMax != null && p.effectifMax <= c.effectif_max) {
      // rempli
    } else if (p.effectifMin != null && p.effectifMin > c.effectif_max) {
      ko.push(`Réservé aux entreprises de ${c.effectif_max} salariés au plus`);
    } else {
      inconnu.push(`Vérifiez que l'effectif ne dépasse pas ${c.effectif_max} salariés`);
    }
  }
  if (c.effectif_min != null) {
    if (p.effectifMin != null && p.effectifMin >= c.effectif_min) {
      // rempli
    } else if (p.effectifMax != null && p.effectifMax < c.effectif_min) {
      ko.push(`Réservé aux entreprises d'au moins ${c.effectif_min} salariés`);
    } else {
      inconnu.push(`Vérifiez que l'effectif atteint au moins ${c.effectif_min} salariés`);
    }
  }

  if (c.age_min != null || c.age_max != null) {
    if (p.age == null) inconnu.push("Précisez l'âge du bénéficiaire");
    else if ((c.age_min != null && p.age < c.age_min) || (c.age_max != null && p.age > c.age_max)) {
      ko.push(trancheAge(c.age_min, c.age_max));
    }
  }

  if (c.rqth === true && !p.rqth) {
    ko.push('Réservé aux personnes reconnues travailleurs handicapés (RQTH ou équivalent)');
  }

  if (c.niveaux_diplome?.length) {
    if (p.niveauDiplome == null) inconnu.push('Précisez le niveau de diplôme du bénéficiaire');
    else if (!c.niveaux_diplome.includes(p.niveauDiplome)) {
      ko.push(`Réservé aux niveaux de diplôme : ${liste(c.niveaux_diplome.map((n) => NIVEAU_DIPLOME_LABELS[n]))}`);
    }
  }

  if (c.niveau_certification_max != null || c.niveau_certification_min != null) {
    if (p.niveauFormationVise == null) inconnu.push('Précisez le niveau de la certification visée');
    else if (c.niveau_certification_max != null && p.niveauFormationVise > c.niveau_certification_max) {
      ko.push(`Réservé aux certifications de niveau ${c.niveau_certification_max} au plus`);
    } else if (c.niveau_certification_min != null && p.niveauFormationVise < c.niveau_certification_min) {
      ko.push(`Réservé aux certifications de niveau ${c.niveau_certification_min} au moins`);
    }
  }

  if (c.contrats?.length) {
    if (p.contrat == null) inconnu.push('Précisez le type de contrat');
    else if (!c.contrats.includes(p.contrat)) {
      ko.push(`Réservé aux contrats : ${liste(c.contrats.map((k) => CONTRACT_TYPE_LABELS[k]))}`);
    }
  }

  if (c.types_alternance?.length) {
    if (p.typeAlternance == null) inconnu.push("Précisez le type de contrat d'alternance");
    else if (!c.types_alternance.includes(p.typeAlternance)) {
      ko.push(`Réservé aux contrats d'alternance suivants : ${liste(c.types_alternance.map((t) => TYPE_ALTERNANCE_LABELS[t]))}`);
    }
  }

  if (c.anciennete_min_mois != null) {
    if (p.ancienneteMois == null) inconnu.push("Précisez l'ancienneté du salarié");
    else if (p.ancienneteMois < c.anciennete_min_mois) {
      ko.push(`Ancienneté minimale requise : ${c.anciennete_min_mois} mois`);
    }
  }

  if (c.inscrit_france_travail != null) {
    if (p.inscritFranceTravail == null) inconnu.push('Précisez si le bénéficiaire est inscrit à France Travail');
    else if (p.inscritFranceTravail !== c.inscrit_france_travail) {
      ko.push(c.inscrit_france_travail ? 'Réservé aux personnes inscrites à France Travail' : 'Réservé aux personnes non inscrites à France Travail');
    }
  }

  if (c.statuts_dirigeant?.length) {
    if (p.statutDirigeant == null) inconnu.push('Précisez le statut du dirigeant');
    else if (!c.statuts_dirigeant.includes(p.statutDirigeant)) {
      ko.push(`Réservé aux statuts suivants : ${liste(c.statuts_dirigeant.map((s) => STATUT_DIRIGEANT_LABELS[s]))}`);
    }
  }

  if (c.micro_entrepreneur != null) {
    if (p.microEntrepreneur == null) inconnu.push('Précisez si le dirigeant est micro-entrepreneur');
    else if (p.microEntrepreneur !== c.micro_entrepreneur) {
      ko.push(c.micro_entrepreneur ? 'Réservé aux micro-entrepreneurs' : 'Non ouvert aux micro-entrepreneurs');
    }
  }

  if (c.certifications?.length) {
    if (p.certification == null) inconnu.push('Précisez la certification visée par la formation');
    else if (!c.certifications.includes(p.certification)) {
      ko.push(`Réservé aux formations menant à : ${liste(c.certifications.map((k) => CERTIFICATION_LABELS[k]))}`);
    }
  }

  if (c.eligible_cpf === true) {
    if (p.eligibleCpf == null) inconnu.push('Vérifiez que la formation est éligible au CPF');
    else if (!p.eligibleCpf) ko.push('Réservé aux formations éligibles au CPF');
  }

  if (c.duree_min_heures != null || c.duree_max_heures != null) {
    if (p.dureeHeures == null) inconnu.push('Précisez la durée de la formation');
    else if (c.duree_min_heures != null && p.dureeHeures < c.duree_min_heures) ko.push(`Durée minimale : ${c.duree_min_heures} h`);
    else if (c.duree_max_heures != null && p.dureeHeures > c.duree_max_heures) ko.push(`Durée maximale : ${c.duree_max_heures} h`);
  }

  if (c.opcos?.length) {
    if (p.opco == null) inconnu.push("Identifiez l'OPCO de l'entreprise");
    else if (!c.opcos.includes(p.opco)) {
      ko.push(`Réservé aux entreprises relevant de : ${liste(c.opcos.map((o) => OPCO_NOMS[o] ?? o))}`);
    }
  }

  if (c.idcc?.length) {
    const idcc = c.idcc;
    if (p.idccs.length === 0) inconnu.push("Précisez la convention collective de l'entreprise");
    else if (!p.idccs.some((i) => idcc.includes(i))) ko.push(`Réservé aux conventions collectives : IDCC ${liste(idcc)}`);
  }

  if (c.naf_prefixes?.length) {
    const naf = p.codeNaf == null ? null : normaliserNaf(p.codeNaf);
    if (naf == null) inconnu.push("Précisez le code NAF de l'entreprise");
    else if (!c.naf_prefixes.some((pre) => naf.startsWith(normaliserNaf(pre)))) {
      ko.push(`Réservé aux secteurs (code NAF) : ${liste(c.naf_prefixes)}`);
    }
  }

  if (c.structures?.length) {
    const structures = c.structures;
    const libelles = liste(structures.map((s) => LIBELLES_STRUCTURES[s]));
    if (p.structures == null) inconnu.push(`Vérifiez que votre structure relève de : ${libelles}`);
    else if (!p.structures.some((s) => structures.includes(s))) ko.push(`Réservé aux structures : ${libelles}`);
  }

  if (c.qualiopi_requis === true) {
    if (p.qualiopi == null) inconnu.push("Vérifiez que l'organisme de formation est certifié Qualiopi");
    else if (!p.qualiopi) ko.push('Organisme de formation certifié Qualiopi exigé');
  }

  return {
    etat: ko.length > 0 ? 'ko' : inconnu.length > 0 ? 'inconnu' : 'ok',
    raisonsKo: ko,
    raisonsInconnu: inconnu,
  };
}
