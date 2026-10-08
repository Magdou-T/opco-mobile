// ============================================================
// Identification de l'OPCO (v2) : IDCC → OPCO avec niveau de certitude.
//
// Table IDCC construite à partir de sources réutilisables : table IDCC de
// la norme DSN, données KALI et Journal officiel (DILA), arrêtés
// d'agrément des OPCO et listes de branches publiées par les OPCO. La
// table de correspondance IDCC → OPCO de France Compétences
// (art. R. 6123-34 du code du travail) et son API ne sont pas utilisées
// (réutilisation soumise à licence, art. R. 6123-35).
// Suggestions par code NAF (repli sans convention exploitable) : parts
// observées sur un échantillon d'établissements employeurs joints à la
// Table SIRET-OPCO que France Compétences publie en données ouvertes
// (data.gouv.fr, Licence Ouverte 2.0) ; méthode et date des données :
// spécification, section 5.5. Le niveau 'confirme' (lecture directe du
// SIRET dans une source officielle) n'est jamais produit ici.
// ============================================================

import type { CertitudeOpco } from './types';
import { EMBEDDED_IDCC } from './data';

export interface IdccEntree {
  idcc: string;
  titre: string;
  opco: string | null;
  statut: 'actif' | 'fusionne' | 'echappatoire' | 'partage';
  /**
   * Statut 'fusionne' : IDCC de la convention qui remplace celle-ci, quand il est connu. Une convention close sans
   * convention de remplacement n'en a pas (50 entrées de la table embarquée, dont 7509, 0438, 1237, 0779, 5545) :
   * son propre OPCO, s'il en a un, sert alors de rattachement « à confirmer » ; sans OPCO, elle n'en désigne aucun.
   */
  idcc_cible?: string;
  /** Statut 'partage' : OPCO possibles selon l'activité. */
  opcos_possibles?: string[];
  /**
   * true : l'OPCO de cette convention n'est établi par aucune source officielle propre à cet IDCC (repris d'une
   * ancienne table, ou déduit des conventions qu'elle remplace) ; la note en donne la raison.
   */
  a_confirmer?: boolean;
  note?: string;
  source: string;
}

export type IdccTable = Record<string, IdccEntree>;

export interface SuggestionNaf {
  /** Code NAF ou préfixe : '47.11F', '47.11', '47.1' ou '47'. */
  prefixe: string;
  opco: string;
  /**
   * Part observée (0 à 1) : proportion des établissements employeurs de l'échantillon que la Table SIRET-OPCO
   * rattache à cet OPCO ; `null` si elle n'est pas connue.
   */
  part: number | null;
  /** Taille de l'échantillon : établissements employeurs dont la Table SIRET-OPCO donne un OPCO. */
  effectif_etablissements?: number | null;
  /** Intitulé officiel de la NAF rév. 2 (INSEE) pour ce préfixe. */
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
  /**
   * `fiable` : un seul OPCO possible, établi par au moins une convention ferme (en vigueur, avec OPCO, non marquée
   * `a_confirmer`) et aucune convention non rattachée. `a_confirmer` : plusieurs OPCO possibles, convention non
   * rattachée, rattachement sans convention ferme (conventions fusionnées ou closes, ou marquées `a_confirmer`)
   * ou suggestion d'après le code NAF. `inconnu` : aucun OPCO identifié (jamais de suggestion par le code NAF pour
   * un employeur de droit public). `confirme` n'est jamais produit ici : il est réservé à une lecture directe du
   * SIRET dans une source officielle, non intégrée à ce jour.
   */
  certitude: CertitudeOpco;
  /** Explication de la résolution, destinée à l'utilisateur. */
  motif: string;
  /** OPCO possibles et conventions qui y mènent ; vide quand la certitude est `inconnu`. */
  candidats: CandidatOpco[];
  /**
   * IDCC qui fonde `opcoSlug`. Un seul OPCO possible : celui du siège s'il fait partie des conventions de cet OPCO,
   * sinon la première convention ferme, sinon la première. Vaut `null` dans les mêmes cas que `opcoSlug` (certitude
   * `inconnu`, ou `a_confirmer` sans présélection fondée) et quand l'OPCO est seulement suggéré par le code NAF,
   * faute de convention exploitable.
   */
  idccRetenu: string | null;
  avertissements: string[];
  urlVerificationOfficielle: string;
}

export interface EntreeResolution {
  /** Tous les IDCC trouvés (entreprise et établissements). */
  idccs: string[];
  /** IDCC du siège : présélection en cas de pluralité (`null` ou absent : aucun). */
  idccSiege?: string[] | null;
  codeNaf?: string | null;
  /**
   * Catégorie juridique INSEE de l'unité légale (champ `nature_juridique` de l'API Recherche d'entreprises), si
   * connue. Une catégorie 7xxx (droit administratif) interdit la suggestion d'un OPCO par le seul code NAF.
   */
  natureJuridique?: string | null;
}

/**
 * Codes « échappatoires » de la DSN : ils ne désignent aucun OPCO. Doublon voulu des entrées `echappatoire` de la
 * table embarquée : la constante vaut aussi pour une table qui ne les contiendrait pas (jeu de données téléchargé),
 * et le site s'en sert pour ne pas afficher ces codes comme des conventions.
 */
export const CODES_ECHAPPATOIRES: Record<string, string> = {
  '5501': "Convention d'entreprise indépendante ou texte assimilé non précisé",
  '5100': 'Statuts divers ou inconnus',
  '9998': 'Convention non encore en vigueur',
  '9999': 'Absence de convention collective',
};

/** Outil officiel de France Compétences (lien de vérification pour l'utilisateur). */
export const URL_VERIFICATION_OPCO = 'https://quel-est-mon-opco.francecompetences.fr/';

/**
 * Catégorie juridique INSEE 7xxx : « Personne morale et organisme soumis au droit administratif » (État,
 * collectivités territoriales, établissements publics administratifs dont les hôpitaux et les établissements
 * sociaux et médico-sociaux publics, autres personnes morales de droit public administratif). Les établissements
 * publics industriels et commerciaux (41xx), les sociétés et les associations n'en font pas partie.
 */
export function estDroitAdministratif(natureJuridique: string | null | undefined): boolean {
  return /^7\d{3}$/.test(String(natureJuridique ?? '').trim());
}

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

/**
 * Phrase du motif pour des conventions dont l'OPCO n'est établi par aucune source officielle propre à cet IDCC
 * (drapeau `a_confirmer`). Sans point final : le motif y ajoute le sien, ou la phrase de vérification.
 */
function phraseAConfirmer(conventions: { idcc: string; titre: string }[]): string {
  return conventions.length === 1
    ? `Rattachement à confirmer : l'OPCO de la convention IDCC ${conventions[0].idcc} (${conventions[0].titre}) n'est établi par aucune source officielle propre à cette convention`
    : `Rattachement à confirmer : l'OPCO des conventions IDCC ${conventions.map((i) => i.idcc).join(', ')} n'est établi par aucune source officielle propre à ces conventions`;
}

/**
 * Phrase du motif pour des conventions fusionnées ou closes utilisées sans convention cible : l'OPCO vient de
 * l'ancienne convention, qui peut avoir changé de champ. Sans point final.
 */
function phraseFusionnees(conventions: { idcc: string; titre: string }[]): string {
  const liste = conventions.map((i) => `IDCC ${i.idcc} (${i.titre})`).join(', ');
  return conventions.length === 1
    ? `Rattachement d'après l'ancienne convention ${liste}, fusionnée ou close : à confirmer`
    : `Rattachement d'après les anciennes conventions ${liste}, fusionnées ou closes : à confirmer`;
}

/** Note d'une entrée sans son point final (l'avertissement ajoute le sien), ou `parDefaut` si elle est absente. */
function detailNote(note: string | undefined, parDefaut: string): string {
  return note?.trim().replace(/\.\s*$/, '') || parDefaut;
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
  const marquees = new Set<string>(); // conventions dont l'OPCO n'est établi par aucune source officielle propre à l'IDCC
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
      const detail = detailNote(e.note, "convention répartie entre plusieurs OPCO selon l'activité");
      avertissements.push(`IDCC ${code} (${e.titre}) : ${detail}.`);
    }
    if (e.statut === 'fusionne') fusionnees.add(code);
    if (e.a_confirmer) {
      // La note donne la raison pour laquelle aucune source officielle n'établit l'OPCO de cette convention.
      marquees.add(code);
      const detail = detailNote(e.note, "OPCO non établi par une source officielle propre à cette convention");
      avertissements.push(`IDCC ${code} (${e.titre}) : ${detail}.`);
    }
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
    // Conventions fermes : en vigueur, avec OPCO, non marquées « à confirmer » (une convention fusionnée redirigée
    // vers sa cible est jugée sur la cible). Sans aucune convention ferme, aucune source officielle propre à une
    // convention en vigueur n'établit cet OPCO : la certitude ne peut pas être « fiable ».
    const fermes = c.idccs.filter((i) => !fusionnees.has(i.idcc) && !marquees.has(i.idcc));
    let certitude: CertitudeOpco = 'fiable';
    let motif = `Identifié via la convention collective ${conventions}`;
    if (fermes.length === 0) {
      certitude = 'a_confirmer';
      // Les conventions marquées d'abord, puis les conventions fusionnées ou closes (sans convention cible utilisable).
      const phrases: string[] = [];
      const marqueesDuCandidat = c.idccs.filter((i) => marquees.has(i.idcc) && !fusionnees.has(i.idcc));
      const closesDuCandidat = c.idccs.filter((i) => fusionnees.has(i.idcc));
      if (marqueesDuCandidat.length > 0) phrases.push(phraseAConfirmer(marqueesDuCandidat));
      if (closesDuCandidat.length > 0) phrases.push(phraseFusionnees(closesDuCandidat));
      motif = phrases.join('. ');
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
      // IDCC du siège s'il fait partie des conventions du candidat, sinon la première convention ferme (ni close ni
      // marquée « à confirmer » tant qu'une convention ferme fonde l'OPCO), sinon la première
      idccRetenu: (c.idccs.find((i) => siege.has(i.idcc)) ?? fermes[0] ?? c.idccs[0]).idcc,
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

  // 4. Aucun IDCC exploitable. Employeur de droit public (catégorie juridique 7xxx) : la plupart ne cotisent pas à
  //    un OPCO, le code NAF ne suffit donc pas à en suggérer un.
  if (estDroitAdministratif(entree.natureJuridique)) {
    return {
      opcoSlug: null,
      certitude: 'inconnu',
      motif:
        `Employeur public (catégorie juridique ${String(entree.natureJuridique).trim()}) : la plupart des employeurs ` +
        'publics ne cotisent pas à un OPCO. Si cet établissement en a un, sélectionnez-le dans la liste ou ' +
        "vérifiez-le sur l'outil officiel de France Compétences.",
      candidats: [],
      idccRetenu: null,
      avertissements,
      urlVerificationOfficielle,
    };
  }

  // 5. Autres employeurs sans IDCC exploitable : suggestion par code NAF
  const suggestion = suggestionParNaf(entree.codeNaf ?? null, suggestionsNaf);
  if (suggestion) {
    // Part observée sur un échantillon : sa taille est donnée quand elle est connue (une part de 100 % ne vaut que
    // pour les établissements observés).
    const pourcentage = suggestion.part != null ? Math.round(suggestion.part * 100) : null;
    const echantillon = suggestion.effectif_etablissements;
    const part =
      pourcentage == null
        ? ''
        : echantillon != null && echantillon > 0
          ? ` : ${pourcentage} % des établissements employeurs observés dans ce secteur (échantillon de ${echantillon}) relèvent de cet OPCO`
          : ` : ${pourcentage} % des établissements de ce secteur relèvent de cet OPCO`;
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
    // Une convention partagée entre plusieurs OPCO (selon l'activité) ne désigne jamais un OPCO seul.
    if (idcc && e?.opco && e.statut !== 'partage' && !resultats.some((r) => r.opcoSlug === e.opco)) {
      resultats.push({ opcoSlug: e.opco, brancheName: e.titre, idcc });
    }
  }
  return resultats;
}
