// ============================================================
// Étape « Entreprise » : constructeurs purs (ni React ni effet de bord) des mises à jour de l'état du parcours quand
// une entreprise est choisie ou écartée.
//
// Tout ce que la recherche d'entreprise établit (SIREN, statuts, IDCC, NAF, effectif INSEE, OPCO détecté...) se pose et
// s'efface d'un seul bloc. profilDepuisWizard (@opco/core) tient les statuts de la structure (`structures`) pour connus
// dès que `sirenNumber` est renseigné et lit `idccEtablissements`, `detectedIdcc` et `codeNaf` pour évaluer les aides :
// aucun de ces champs ne doit survivre à l'entreprise qui l'a produit, ni être posé sans les autres.
// ============================================================

import { createInitialWizardState } from '@opco/core';
import type { CompanySize, EntrepriseInfo, ProjetType, ResolutionOpco, WizardState } from '@opco/core';

/**
 * Mise à jour unique de l'état quand l'utilisateur choisit une entreprise dans les résultats de la recherche.
 * `resolution` est celle de `resoudreOpco` pour cette entreprise ; `tailleActuelle` est la taille déjà saisie (gardée
 * quand l'INSEE n'en suggère aucune).
 */
export function etatDepuisEntreprise(
  entreprise: EntrepriseInfo,
  resolution: ResolutionOpco,
  tailleActuelle: CompanySize | null,
): Partial<WizardState> {
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
    trancheEffectifInsee: entreprise.trancheEffectif,
    structures: [...entreprise.structures],
    // La taille suggérée par l'INSEE remplace la saisie ; sans suggestion (tranche à cheval sur deux tailles), on garde la saisie.
    companySize: entreprise.tailleSuggeree ?? tailleActuelle,
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
 * l'effectif exact, le budget déjà consommé et l'OPCO choisi à la main (`selectedOpcoSlug`).
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
    trancheEffectifInsee: initial.trancheEffectifInsee,
    structures: initial.structures,
    selectedBrancheId: initial.selectedBrancheId,
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
