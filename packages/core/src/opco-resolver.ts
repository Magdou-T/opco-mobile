// ============================================================
// Identification de l'OPCO (v2) : IDCC → OPCO avec niveau de certitude.
//
// Table construite à partir de sources réutilisables : table IDCC de la
// norme DSN, données KALI et Journal officiel (DILA), arrêtés d'agrément
// des OPCO et listes de branches publiées par les OPCO. Les tables de
// France Compétences (établies par l'art. R. 6123-34 du code du travail)
// ne sont PAS utilisées : leur réutilisation exige une licence
// (art. R. 6123-35). Le niveau 'confirme' leur est réservé.
// ============================================================

import type { CertitudeOpco } from './types';
import { EMBEDDED_IDCC } from './data';

export interface IdccEntree {
  idcc: string;
  titre: string;
  opco: string | null;
  statut: 'actif' | 'fusionne' | 'echappatoire' | 'partage';
  /** Statut 'fusionne' : IDCC de rattachement. */
  idcc_cible?: string;
  /** Statut 'partage' : OPCO possibles selon l'activité. */
  opcos_possibles?: string[];
  note?: string;
  source: string;
}

export type IdccTable = Record<string, IdccEntree>;

export interface SuggestionNaf {
  /** Code NAF ou préfixe : '47.11F', '47.11', '47.1' ou '47'. */
  prefixe: string;
  opco: string;
  /** Part des établissements du secteur relevant de cet OPCO (0-1), si connue. */
  part: number | null;
  effectif_etablissements?: number | null;
  libelle: string;
  source: string;
}

export interface CandidatOpco {
  opcoSlug: string;
  idccs: { idcc: string; titre: string }[];
}

export interface ResolutionOpco {
  /**
   * OPCO retenu ou présélectionné. Vaut `null` quand la certitude est `inconnu`, ou `a_confirmer` sans
   * présélection fondée : plusieurs candidats, sans convention du siège qui n'en désigne qu'un seul et sans
   * suggestion NAF qui désigne l'un d'eux. L'utilisateur choisit alors parmi `candidats`.
   */
  opcoSlug: string | null;
  certitude: CertitudeOpco;
  /** Explication de la résolution, destinée à l'utilisateur. */
  motif: string;
  /** OPCO possibles et conventions qui y mènent ; vide quand la certitude est `inconnu`. */
  candidats: CandidatOpco[];
  /**
   * IDCC qui fonde `opcoSlug`. Vaut `null` dans les mêmes cas que `opcoSlug` (certitude `inconnu`, ou
   * `a_confirmer` sans présélection fondée) et quand l'OPCO est seulement suggéré par le code NAF,
   * faute de convention exploitable.
   */
  idccRetenu: string | null;
  avertissements: string[];
  urlVerificationOfficielle: string;
}

export interface EntreeResolution {
  /** Tous les IDCC trouvés (entreprise et établissements). */
  idccs: string[];
  /** IDCC du siège : présélection en cas de pluralité. */
  idccSiege?: string[];
  codeNaf?: string | null;
}

/** Codes « échappatoires » de la DSN : ils ne désignent aucun OPCO. */
export const CODES_ECHAPPATOIRES: Record<string, string> = {
  '5501': "Convention d'entreprise indépendante ou texte assimilé non précisé",
  '5100': 'Statuts divers ou inconnus',
  '9998': 'Convention non encore en vigueur',
  '9999': 'Absence de convention collective',
};

/** Outil officiel de France Compétences (lien de vérification pour l'utilisateur). */
export const URL_VERIFICATION_OPCO = 'https://quel-est-mon-opco.francecompetences.fr/';

/** Début du motif quand plusieurs OPCO restent possibles ; la phrase de présélection éventuelle s'y ajoute. */
const MOTIF_PLUSIEURS_OPCO =
  'Plusieurs OPCO possibles selon les conventions collectives déclarées. Une entreprise relève en principe ' +
  "d'une seule convention, déterminée par son activité principale (sauf établissement autonome) : choisissez " +
  "celle de l'établissement du salarié concerné.";

/**
 * Invite à vérifier les conventions qui n'ont pu être rattachées à aucun OPCO : absentes de la table, ou
 * présentes mais sans OPCO confirmé par une source. Le texte commence par une minuscule : il suit un « ; »
 * (un seul candidat) ou « Par ailleurs, » (plusieurs candidats).
 */
function phraseVerification(inconnues: string[]): string {
  return inconnues.length === 1
    ? `la convention IDCC ${inconnues[0]} n'a pas pu être rattachée à un OPCO : vérifiez qu'elle ne désigne pas un autre OPCO.`
    : `les conventions IDCC ${inconnues.join(', ')} n'ont pas pu être rattachées à un OPCO : vérifiez qu'elles ne désignent pas un autre OPCO.`;
}

export function normaliserIdcc(raw: string): string | null {
  const s = String(raw).trim();
  if (!/^\d{1,4}$/.test(s)) return null;
  const code = s.padStart(4, '0');
  return code === '0000' ? null : code;
}

function redirigerFusion(code: string, table: IdccTable, avertissements: string[]): string {
  const entree = table[code];
  if (entree?.statut === 'fusionne' && entree.idcc_cible) {
    if (!table[entree.idcc_cible]) {
      // Cible absente de la table : pas de redirection, l'OPCO de l'ancienne convention sert de rattachement.
      avertissements.push(
        `IDCC ${code} (${entree.titre}) : convention fusionnée dans l'IDCC ${entree.idcc_cible}, absent de notre table ; rattachement d'après l'ancienne convention.`,
      );
      return code;
    }
    avertissements.push(
      `IDCC ${code} (${entree.titre}) : convention fusionnée, rattachement à l'IDCC ${entree.idcc_cible}.`,
    );
    return entree.idcc_cible;
  }
  return code;
}

/** Suggestion la plus précise : sous-classe (47.11F) > classe (47.11) > groupe (47.1) > division (47). */
export function suggestionParNaf(codeNaf: string | null, suggestions: SuggestionNaf[]): SuggestionNaf | null {
  if (!codeNaf) return null;
  let naf = codeNaf.trim().toUpperCase();
  // Forme sans point (ex. 4711F) : convertie en 47.11F avant la recherche
  if (/^\d{4}[A-Z]$/.test(naf)) naf = `${naf.slice(0, 2)}.${naf.slice(2)}`;
  for (const prefixe of [naf, naf.slice(0, 5), naf.slice(0, 4), naf.slice(0, 2)]) {
    const trouvee = suggestions.find((s) => s.prefixe.toUpperCase() === prefixe);
    if (trouvee) return trouvee;
  }
  return null;
}

export function resoudreOpco(
  entree: EntreeResolution,
  table: IdccTable,
  suggestionsNaf: SuggestionNaf[] = [],
): ResolutionOpco {
  const avertissements: string[] = [];
  const urlVerificationOfficielle = URL_VERIFICATION_OPCO;

  // 1. Normalisation, dédoublonnage (ordre conservé), puis redirection des conventions fusionnées
  //    (dédoublonner d'abord évite d'émettre deux fois le même avertissement de fusion).
  const normalises: string[] = [];
  for (const brut of entree.idccs) {
    const code = normaliserIdcc(brut);
    if (code && !normalises.includes(code)) normalises.push(code);
  }
  const codes: string[] = [];
  for (const code of normalises) {
    const effectif = redirigerFusion(code, table, avertissements);
    if (!codes.includes(effectif)) codes.push(effectif);
  }
  const siege = new Set<string>();
  for (const brut of entree.idccSiege ?? []) {
    const code = normaliserIdcc(brut);
    if (code) siege.add(redirigerFusion(code, table, []));
  }

  // 2. Codes échappatoires
  const exploitables: string[] = [];
  for (const code of codes) {
    const libelle =
      CODES_ECHAPPATOIRES[code] ?? (table[code]?.statut === 'echappatoire' ? table[code].titre : null);
    if (libelle) avertissements.push(`Code ${code} (${libelle}) : ce code ne permet pas de déterminer l'OPCO.`);
    else exploitables.push(code);
  }

  // 3. Regroupement par OPCO
  const parOpco = new Map<string, { idcc: string; titre: string }[]>();
  const absentes: string[] = []; // code absent de la table
  const sansOpco: string[] = []; // code présent dans la table, mais aucun OPCO utilisable (non confirmé par une source)
  const fusionnees = new Set<string>(); // conventions fusionnées ou closes utilisées telles quelles (pas de cible utilisable)
  for (const code of exploitables) {
    const e = table[code];
    if (!e) {
      absentes.push(code);
      continue;
    }
    const opcos = e.statut === 'partage' ? e.opcos_possibles ?? [] : e.opco ? [e.opco] : [];
    if (opcos.length === 0) {
      sansOpco.push(code);
      continue;
    }
    if (e.statut === 'partage') {
      // La note complète reste dans l'avertissement (le motif reste court) ; son point final est retiré avant le nôtre.
      const detail = e.note?.trim().replace(/\.\s*$/, '') || "convention répartie entre plusieurs OPCO selon l'activité";
      avertissements.push(`IDCC ${code} (${e.titre}) : ${detail}.`);
    }
    if (e.statut === 'fusionne') fusionnees.add(code);
    for (const opco of opcos) {
      const liste = parOpco.get(opco) ?? [];
      liste.push({ idcc: code, titre: e.titre });
      parOpco.set(opco, liste);
    }
  }
  if (absentes.length > 0) {
    avertissements.push(`IDCC non référencé(s) dans notre table : ${absentes.join(', ')}.`);
  }
  for (const code of sansOpco) {
    avertissements.push(
      `IDCC ${code} (${table[code].titre}) : aucun OPCO confirmé par une source officielle pour cette convention.`,
    );
  }
  // Conventions qui n'ont pu être rattachées à aucun OPCO (absentes ou sans OPCO confirmé), dans l'ordre déclaré.
  const inconnues = exploitables.filter((code) => absentes.includes(code) || sansOpco.includes(code));
  const verification = inconnues.length > 0 ? phraseVerification(inconnues) : null;

  const candidats: CandidatOpco[] = [...parOpco.entries()].map(([opcoSlug, idccs]) => ({ opcoSlug, idccs }));

  if (candidats.length === 1) {
    const c = candidats[0];
    const conventions = c.idccs.map((i) => `IDCC ${i.idcc} (${i.titre})`).join(', ');
    let certitude: CertitudeOpco = 'fiable';
    let motif = `Identifié via la convention collective ${conventions}`;
    if (c.idccs.every((i) => fusionnees.has(i.idcc))) {
      // Le candidat ne repose que sur des conventions fusionnées ou closes, sans convention cible utilisable :
      // l'OPCO vient de l'ancienne convention, qui peut avoir changé de champ.
      certitude = 'a_confirmer';
      motif =
        c.idccs.length === 1
          ? `Rattachement d'après l'ancienne convention ${conventions}, fusionnée ou close : à confirmer`
          : `Rattachement d'après les anciennes conventions ${conventions}, fusionnées ou closes : à confirmer`;
    }
    if (verification) {
      // Une convention absente de la table ou sans OPCO confirmé peut désigner un autre OPCO : on ne conclut pas sans confirmation.
      certitude = 'a_confirmer';
      motif = `${motif} ; ${verification}`;
    } else {
      motif = `${motif}.`;
    }
    return {
      opcoSlug: c.opcoSlug,
      certitude,
      motif,
      candidats,
      // IDCC du siège s'il fait partie des conventions du candidat, sinon la première
      idccRetenu: (c.idccs.find((i) => siege.has(i.idcc)) ?? c.idccs[0]).idcc,
      avertissements,
      urlVerificationOfficielle,
    };
  }

  if (candidats.length > 1) {
    // Motif de base : convention partagée seule (un seul IDCC, commun à tous les candidats) ou plusieurs conventions.
    // Pour une convention partagée, la note complète figure dans l'avertissement : le motif reste court.
    const idccsCandidats = new Set(candidats.flatMap((c) => c.idccs.map((i) => i.idcc)));
    let motif = MOTIF_PLUSIEURS_OPCO;
    if (idccsCandidats.size === 1) {
      const code = [...idccsCandidats][0];
      motif = `La convention collective IDCC ${code} (${table[code].titre}) relève de plusieurs OPCO selon l'activité principale de l'entreprise. Choisissez l'OPCO correspondant à votre activité.`;
    }
    // Même vérification que pour un seul candidat : une convention absente de la table ou sans OPCO confirmé
    // peut désigner un autre OPCO. Elle précède la phrase de présélection éventuelle.
    if (verification) motif = `${motif} Par ailleurs, ${verification}`;
    const aConfirmer = (opcoSlug: string | null, idccRetenu: string | null, motifFinal: string): ResolutionOpco => ({
      opcoSlug,
      certitude: 'a_confirmer',
      motif: motifFinal,
      candidats,
      idccRetenu,
      avertissements,
      urlVerificationOfficielle,
    });

    // Présélection 1 : siège, seulement si un unique candidat porte une convention du siège
    // (sans effet pour une convention partagée seule : tous les candidats ont le même IDCC).
    const duSiege = candidats.filter((c) => c.idccs.some((i) => siege.has(i.idcc)));
    if (duSiege.length === 1) {
      const c = duSiege[0];
      const idccSiegeRetenu = (c.idccs.find((i) => siege.has(i.idcc)) ?? c.idccs[0]).idcc;
      return aConfirmer(c.opcoSlug, idccSiegeRetenu, `${motif} Présélection : convention du siège.`);
    }

    // Présélection 2 : code NAF, si la suggestion désigne l'un des candidats
    const suggestionNaf = suggestionParNaf(entree.codeNaf ?? null, suggestionsNaf);
    const parNaf = suggestionNaf ? candidats.find((c) => c.opcoSlug === suggestionNaf.opco) : undefined;
    if (suggestionNaf && parNaf) {
      return aConfirmer(
        parNaf.opcoSlug,
        parNaf.idccs[0].idcc,
        `${motif} Présélection d'après le code NAF ${suggestionNaf.prefixe} (${suggestionNaf.libelle}), à confirmer.`,
      );
    }

    // Aucune présélection fondée : l'utilisateur choisit parmi les candidats.
    return aConfirmer(null, null, motif);
  }

  // 4. Aucun IDCC exploitable : suggestion par code NAF
  const suggestion = suggestionParNaf(entree.codeNaf ?? null, suggestionsNaf);
  if (suggestion) {
    const part =
      suggestion.part != null
        ? ` : ${Math.round(suggestion.part * 100)} % des établissements de ce secteur relèvent de cet OPCO`
        : '';
    return {
      opcoSlug: suggestion.opco,
      certitude: 'a_confirmer',
      motif: `Aucune convention collective exploitable. Suggestion d'après le code NAF ${suggestion.prefixe} (${suggestion.libelle})${part}. À confirmer.`,
      candidats: [{ opcoSlug: suggestion.opco, idccs: [] }],
      idccRetenu: null,
      avertissements,
      urlVerificationOfficielle,
    };
  }

  return {
    opcoSlug: null,
    certitude: 'inconnu',
    motif:
      "OPCO non identifié automatiquement : sélectionnez-le dans la liste ou vérifiez-le sur l'outil officiel de France Compétences.",
    candidats: [],
    idccRetenu: null,
    avertissements,
    urlVerificationOfficielle,
  };
}

/** Titre officiel d'une convention, ou libellé générique. */
export function titreConvention(idcc: string, table: IdccTable): string {
  const code = normaliserIdcc(idcc);
  return (code && table[code]?.titre) || `Convention IDCC ${code ?? String(idcc).trim()}`;
}

/**
 * @deprecated Utiliser resoudreOpco. Conservé pour l'app mobile (apps/mobile).
 */
export function resolveIdccToOpco(idccCodes: string[]): { opcoSlug: string; brancheName: string; idcc: string }[] {
  const resultats: { opcoSlug: string; brancheName: string; idcc: string }[] = [];
  for (const brut of idccCodes) {
    const idcc = normaliserIdcc(brut);
    const e = idcc ? EMBEDDED_IDCC[idcc] : undefined;
    if (idcc && e?.opco && !resultats.some((r) => r.opcoSlug === e.opco)) {
      resultats.push({ opcoSlug: e.opco, brancheName: e.titre, idcc });
    }
  }
  return resultats;
}
