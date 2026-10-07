// ============================================================
// Recherche d'entreprise : lecture de la saisie et présentation des résultats (fonctions pures, sans appel réseau).
// ============================================================

import { CODES_ECHAPPATOIRES } from '@opco/core';

/**
 * Préfixe « SIREN » ou « SIRET » (avec « : » ou « n° » éventuels) devant un numéro, puis chiffres et séparateurs.
 * En JavaScript, `\s` couvre aussi l'espace insécable (U+00A0) et l'espace fine insécable (U+202F).
 */
const NUMERO_SAISI = /^(?:sire[nt](?![\p{L}\d])\s*(?:n°|nº|:)?\s*)?([\d\s.\-]+)$/iu;

/** Espace insécable : un numéro groupé ne se coupe pas en fin de ligne. */
const INSECABLE = String.fromCharCode(0x00a0);

/**
 * Requête envoyée à l'API recherche-entreprises. Un numéro de 9 chiffres (SIREN) ou de 14 chiffres (SIRET) saisi avec
 * des espaces (insécables compris), des points ou des tirets, éventuellement précédé de « SIREN » ou « SIRET », est
 * envoyé en chiffres collés : l'API ne trouve rien pour « 814 739 728 » écrit avec des tirets ou des espaces insécables.
 * Toute autre saisie (un nom, un numéro incomplet) est envoyée telle quelle, sans les espaces de début et de fin.
 */
export function requeteRecherche(saisie: string): string {
  const texte = saisie.trim();
  const numero = NUMERO_SAISI.exec(texte);
  if (numero) {
    const chiffres = numero[1].replace(/\D/g, '');
    if (chiffres.length === 9 || chiffres.length === 14) return chiffres;
  }
  return texte;
}

/**
 * IDCC à afficher sous un résultat : sans les codes « échappatoires » de la DSN (9999 « absence de convention
 * collective », 5501, 5100, 9998), qui ne désignent aucune convention.
 */
export function idccAffichables(idccs: readonly string[]): string[] {
  return idccs.filter((idcc) => !(idcc in CODES_ECHAPPATOIRES));
}

/**
 * Numéro SIREN (« 814 739 728 ») ou SIRET (« 814 739 728 00024 ») groupé pour la lecture, avec des espaces insécables.
 * Toute autre valeur est rendue telle quelle.
 */
export function numeroLisible(numero: string): string {
  const n = numero.trim();
  if (/^\d{9}$/.test(n)) return [n.slice(0, 3), n.slice(3, 6), n.slice(6)].join(INSECABLE);
  if (/^\d{14}$/.test(n)) return [n.slice(0, 3), n.slice(3, 6), n.slice(6, 9), n.slice(9)].join(INSECABLE);
  return numero;
}
