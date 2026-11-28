// ============================================================
// Ancre de l'adresse (`window.location.hash`), en fonction pure (tests : tests/fiche.test.ts, par la réexportation de
// lib/fiche.ts). Module sans importation : le composant client qui l'emploie (OuvertureDesDetails) n'embarque ni
// lib/fiche.ts, ni lib/format.ts, ni les libellés de @opco/core.
// ============================================================

/**
 * Identifiant visé par l'ancre d'une adresse (`window.location.hash`) : sans le « # » de tête, décodé
 * (« #%C3%A9conomie » donne « économie »). Une ancre mal encodée (« #taux-100% », « #%E0%A4%A ») est rendue telle quelle
 * sans son « # » : `decodeURIComponent` lèverait une `URIError` et ferait tomber la page. Ne lève jamais.
 */
export function decoderAncre(hash: string): string {
  const brut = hash.startsWith('#') ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(brut);
  } catch {
    return brut;
  }
}
