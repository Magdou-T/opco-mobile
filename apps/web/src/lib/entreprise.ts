// ============================================================
// Étape « Entreprise » : constructeurs purs (ni React ni effet de bord) des mises à jour de l'état du parcours quand
// une entreprise est choisie ou écartée, et quand l'effectif exact change.
//
// Tout ce que la recherche d'entreprise établit (SIREN, statuts, IDCC, NAF, catégorie juridique, effectif INSEE, OPCO
// détecté...) se pose et s'efface d'un seul bloc. profilDepuisWizard (@opco/core) tient les statuts de la structure (`structures`) pour connus
// dès que `sirenNumber` est renseigné et lit `idccEtablissements`, `detectedIdcc` et `codeNaf` pour évaluer les aides :
// aucun de ces champs ne doit survivre à l'entreprise qui l'a produit, ni être posé sans les autres.
//
// Taille et effectif : le calcul OPCO lit la tranche (`companySize`), le profil des aides lit d'abord l'effectif exact
// (`effectif`). Les deux ne doivent jamais se contredire : un effectif saisi impose sa tranche (`etatDepuisEffectif`),
// et la sélection d'une entreprise repart de la tranche suggérée par l'INSEE, sans effectif saisi pour une autre.
// ============================================================

import { createInitialWizardState } from '@opco/core';
import type { CompanySize, EntreeResolution, EntrepriseInfo, ProjetType, ResolutionOpco, WizardState } from '@opco/core';

/**
 * Tranche de taille d'un effectif exact, avec les bornes du moteur d'aides (`bornesEffectif` de @opco/core) :
 * 0 à 10 salariés, 11 à 49, 50 à 299, 300 et plus.
 */
export function trancheDepuisEffectif(effectif: number): CompanySize {
  if (effectif < 11) return 'less_11';
  if (effectif < 50) return '11_49';
  if (effectif < 300) return '50_299';
  return '300_plus';
}

/**
 * Mise à jour quand l'utilisateur saisit ou efface l'effectif exact. Saisi, il impose sa tranche ; effacé, la tranche
 * reste la dernière connue (l'utilisateur peut alors la choisir lui-même).
 */
export function etatDepuisEffectif(effectif: number | null): Partial<WizardState> {
  return effectif == null ? { effectif: null } : { effectif, companySize: trancheDepuisEffectif(effectif) };
}

/**
 * Mise à jour unique de l'état quand l'utilisateur choisit une entreprise dans les résultats de la recherche.
 * `resolution` est celle de `resoudreOpco` pour cette entreprise. La taille est celle que suggère l'INSEE, sinon aucune :
 * jamais celle d'une entreprise précédente. L'effectif exact saisi auparavant est effacé pour la même raison (il
 * imposerait sa tranche à la nouvelle entreprise).
 */
export function etatDepuisEntreprise(entreprise: EntrepriseInfo, resolution: ResolutionOpco): Partial<WizardState> {
  const { siege } = entreprise;
  return {
    companyName: entreprise.nom,
    detectedCompanyName: entreprise.nom,
    sirenNumber: entreprise.siren,
    // Le SIRET du siège peut être vide dans la réponse de l'API : null, jamais une chaîne vide.
    siret: siege.siret || null,
    detectedOpcoSlug: resolution.opcoSlug,
    detectedIdcc: resolution.idccRetenu,
    opcoCertitude: resolution.certitude,
    // Copies : l'état ne partage aucun tableau avec les résultats de la recherche.
    idccEtablissements: [...entreprise.idccs],
    idccSiege: [...entreprise.idccSiege],
    regionCode: siege.region,
    departementCode: siege.departement,
    codeNaf: entreprise.codeNaf,
    natureJuridique: entreprise.natureJuridique,
    trancheEffectifInsee: entreprise.trancheEffectif,
    structures: [...entreprise.structures],
    // Tranche à cheval sur deux tailles (10 à 19, 250 à 499 salariés) : aucune suggestion, l'utilisateur choisit.
    companySize: entreprise.tailleSuggeree ?? null,
    effectif: null,
    // Une nouvelle entreprise annule le choix manuel d'OPCO et de branche fait pour la précédente.
    selectedOpcoSlug: null,
    selectedBrancheId: null,
  };
}

/**
 * Mise à jour unique de l'état quand l'entreprise choisie est écartée (passage en saisie manuelle, nouvelle recherche) :
 * tout ce que la recherche avait établi revient à sa valeur initiale (celle de `createInitialWizardState`), y compris le
 * nom de l'entreprise (l'appelant y remet le texte tapé s'il y en a un).
 * Sont gardés, parce que l'utilisateur peut les avoir choisis lui-même : la région, le département, la taille,
 * l'effectif exact, le budget déjà consommé et l'OPCO choisi à la main (`selectedOpcoSlug`). La taille et l'effectif
 * restent ensemble, donc cohérents.
 */
export function etatSansEntreprise(): Partial<WizardState> {
  const initial = createInitialWizardState();
  return {
    companyName: initial.companyName,
    detectedCompanyName: initial.detectedCompanyName,
    sirenNumber: initial.sirenNumber,
    siret: initial.siret,
    detectedOpcoSlug: initial.detectedOpcoSlug,
    detectedIdcc: initial.detectedIdcc,
    opcoCertitude: initial.opcoCertitude,
    idccEtablissements: initial.idccEtablissements,
    idccSiege: initial.idccSiege,
    codeNaf: initial.codeNaf,
    natureJuridique: initial.natureJuridique,
    trancheEffectifInsee: initial.trancheEffectifInsee,
    structures: initial.structures,
    selectedBrancheId: initial.selectedBrancheId,
  };
}

/**
 * Entrée de `resoudreOpco` (@opco/core), pour une entreprise des résultats comme pour l'état du parcours : conventions,
 * code NAF et catégorie juridique, tableaux copiés. La catégorie juridique compte : un employeur de droit public
 * (7xxx) sans convention ne reçoit aucun OPCO d'après son seul code NAF. L'étape Entreprise appelle le résolveur à la
 * sélection et quand elle recalcule sa carte depuis l'état : les deux appels passent par ici, avec les mêmes champs.
 */
export function entreeDeResolution(source: {
  idccs: readonly string[];
  idccSiege: readonly string[] | null;
  codeNaf: string | null;
  natureJuridique: string | null;
}): EntreeResolution {
  return {
    idccs: [...source.idccs],
    idccSiege: source.idccSiege == null ? null : [...source.idccSiege],
    codeNaf: source.codeNaf,
    natureJuridique: source.natureJuridique,
  };
}

/** L'OPCO est facultatif pour le projet « former le dirigeant » et obligatoire pour les autres (projet non choisi compris). */
export function opcoRequis(projet: ProjetType | null): boolean {
  return projet !== 'formation_dirigeant';
}

/**
 * Projets qui ouvrent un budget auprès de l'OPCO : le budget déjà consommé cette année y est déduit du plafond annuel.
 * Un projet non encore choisi compte comme tel.
 */
export function ouvreBudgetOpco(projet: ProjetType | null): boolean {
  return projet == null || projet === 'formation_salarie' || projet === 'reconversion_salarie';
}
