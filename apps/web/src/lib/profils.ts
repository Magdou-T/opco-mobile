// ============================================================
// Libellés d'un profil du groupe (étape Participants, récapitulatif, tableau « Par profil », cartes d'aides). Fonctions
// pures. Le statut se dit en un ou deux mots ; le libellé complet l'accompagne de ce qui le précise, de l'âge et de la
// reconnaissance de travailleur handicapé : « Salarié en CDI, 35 ans », « Dirigeant artisan, 52 ans, RQTH ». Les puces
// d'une carte de profil (`pucesDuProfil`) disent le reste de ce que le profil a répondu, sans le statut.
// ============================================================

import { NIVEAU_DIPLOME_LABELS, STATUT_PAR_PROJET } from '@opco/core';
import type { ChampsProfil, ContractType, ProjetType, StatutDirigeant, TypeAlternance } from '@opco/core';
import { formatEuro, nombreEtUnite } from './format';

/** Le statut du profil, en un ou deux mots (boutons de choix du statut, résumé du profil). */
export const STATUT_DU_PROFIL: Record<ProjetType, string> = {
  formation_salarie: 'Salarié',
  reconversion_salarie: 'Salarié en reconversion',
  recrutement_demandeur_emploi: "Demandeur d'emploi",
  alternance: 'Alternant',
  formation_dirigeant: 'Dirigeant',
};

const CONTRAT_COURT: Record<Exclude<ContractType, 'alternance'>, string> = { cdi: 'CDI', cdd: 'CDD', interim: 'intérim' };

const STATUT_DIRIGEANT_COURT: Record<StatutDirigeant, string> = {
  commercant: 'commerçant',
  artisan: 'artisan',
  profession_liberale: 'profession libérale',
  exploitant_agricole: 'exploitant agricole',
  assimile_salarie: 'assimilé salarié',
};

/** Le type de contrat d'un alternant, dans les mots de `libelleDuProfil` (« Alternant en apprentissage »). */
const TYPE_ALTERNANCE_COURT: Record<TypeAlternance, string> = {
  apprentissage: 'apprentissage',
  professionnalisation: 'contrat de professionnalisation',
};

/**
 * Libellé d'un profil : le statut (« Salarié en CDI », « Salarié en reconversion, CDD », « Alternant en apprentissage »,
 * « Dirigeant artisan », « Demandeur d'emploi »), puis l'âge (« 35 ans », espace insécable) et « RQTH ». Un projet non
 * choisi se lit « Salarié », comme partout ; le contrat « alternance » d'un salarié (reste d'une saisie) est ignoré.
 */
export function libelleDuProfil(champs: ChampsProfil): string {
  const projet = champs.projetType ?? 'formation_salarie';
  const contrat = champs.contractType && champs.contractType !== 'alternance' ? CONTRAT_COURT[champs.contractType] : null;
  let tete = STATUT_DU_PROFIL[projet];
  if (projet === 'formation_salarie' && contrat) tete += ` en ${contrat}`;
  else if (projet === 'reconversion_salarie' && contrat) tete += `, ${contrat}`;
  else if (projet === 'alternance' && champs.typeAlternance) {
    tete += champs.typeAlternance === 'apprentissage' ? ' en apprentissage' : ' en contrat de professionnalisation';
  } else if (projet === 'formation_dirigeant' && champs.statutDirigeant) tete += ` ${STATUT_DIRIGEANT_COURT[champs.statutDirigeant]}`;
  return [tete, champs.ageBeneficiaire != null ? nombreEtUnite(champs.ageBeneficiaire, 'ans') : null, champs.isHandicap ? 'RQTH' : null]
    .filter((morceau): morceau is string => !!morceau)
    .join(', ');
}

/** Ce qui précise le statut d'un profil, dans les mots de `libelleDuProfil` ; rien pour un demandeur d'emploi. */
function precisionDuStatut(champs: ChampsProfil, projet: ProjetType): string | null {
  switch (projet) {
    case 'formation_salarie':
    case 'reconversion_salarie':
      return champs.contractType && champs.contractType !== 'alternance' ? CONTRAT_COURT[champs.contractType] : null;
    case 'alternance':
      return champs.typeAlternance ? TYPE_ALTERNANCE_COURT[champs.typeAlternance] : null;
    case 'formation_dirigeant':
      return champs.statutDirigeant ? STATUT_DIRIGEANT_COURT[champs.statutDirigeant] : null;
    case 'recrutement_demandeur_emploi':
      return null;
  }
}

/**
 * Puces d'un profil, pour la carte de l'étape Participants : ce que le profil a déjà répondu, sans le statut que l'étiquette
 * de la carte dit déjà. Dans cet ordre : ce qui précise le statut (le contrat d'un salarié ou d'un salarié en reconversion,
 * le type de contrat d'un alternant, le statut d'un dirigeant ; rien pour un demandeur d'emploi), l'âge (« 35 ans », espace
 * insécable), le diplôme, « RQTH » et le solde CPF (« Solde CPF 1 200 € », `formatEuro`), ce dernier pour les statuts qui
 * posent la question seulement (salarié, salarié en reconversion, dirigeant). La précision du statut reprend les mots de
 * `libelleDuProfil` avec une majuscule initiale (« CDI », « Intérim », « Apprentissage », « Artisan ») : une puce commence
 * par une majuscule, alors que le libellé les écrit après le statut. Une réponse absente ne produit aucune puce, une réponse à
 * zéro en produit une (la présence compte, pas la valeur) : un profil neuf n'en a aucune. Un projet non choisi se lit
 * « salarié » ; le contrat « alternance » d'un salarié (reste d'une saisie) et les réponses d'un autre statut sont ignorés.
 */
export function pucesDuProfil(champs: ChampsProfil): string[] {
  const projet = champs.projetType ?? 'formation_salarie';
  const statut = STATUT_PAR_PROJET[projet];
  const puces: string[] = [];
  const precision = precisionDuStatut(champs, projet);
  if (precision) puces.push(precision.charAt(0).toUpperCase() + precision.slice(1));
  if (champs.ageBeneficiaire != null) puces.push(nombreEtUnite(champs.ageBeneficiaire, 'ans'));
  if (champs.niveauDiplome != null) puces.push(NIVEAU_DIPLOME_LABELS[champs.niveauDiplome]);
  if (champs.isHandicap) puces.push('RQTH');
  if ((statut === 'salarie' || statut === 'dirigeant') && champs.soldeCpf != null) puces.push(`Solde CPF ${formatEuro(champs.soldeCpf)}`);
  return puces;
}
