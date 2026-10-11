// ============================================================
// Libellés d'un profil du groupe (étape Participants, récapitulatif, tableau « Par profil », cartes d'aides). Fonctions
// pures. Le statut se dit en un ou deux mots ; le libellé complet l'accompagne de ce qui le précise, de l'âge et de la
// reconnaissance de travailleur handicapé : « Salarié en CDI, 35 ans », « Dirigeant artisan, 52 ans, RQTH ».
// ============================================================

import type { ChampsProfil, ContractType, ProjetType, StatutDirigeant } from '@opco/core';
import { nombreEtUnite } from './format';

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
