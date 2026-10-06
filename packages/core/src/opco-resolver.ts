// ============================================================
// Identification de l'OPCO (v2) : IDCC → OPCO avec niveau de certitude.
//
// Table construite à partir de sources réutilisables : arrêtés d'agrément
// des OPCO (Légifrance), listes de branches publiées par les OPCO, liste
// des IDCC du ministère du Travail. Les tables de France Compétences
// (art. R. 6123-34 du code du travail) ne sont PAS utilisées : leur
// réutilisation exige une licence. Le niveau 'confirme' leur est réservé.
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
  opcoSlug: string | null;
  certitude: CertitudeOpco;
  motif: string;
  candidats: CandidatOpco[];
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

export function normaliserIdcc(raw: string): string | null {
  const s = String(raw).trim();
  if (!/^\d{1,4}$/.test(s)) return null;
  const code = s.padStart(4, '0');
  return code === '0000' ? null : code;
}

function redirigerFusion(code: string, table: IdccTable, avertissements: string[]): string {
  const entree = table[code];
  if (entree?.statut === 'fusionne' && entree.idcc_cible) {
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
  const naf = codeNaf.trim().toUpperCase();
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

  // 1. Normalisation + redirection des conventions fusionnées
  const codes: string[] = [];
  for (const brut of entree.idccs) {
    const code = normaliserIdcc(brut);
    if (!code) continue;
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
  const nonReferences: string[] = [];
  for (const code of exploitables) {
    const e = table[code];
    const opcos = e ? (e.statut === 'partage' ? e.opcos_possibles ?? [] : e.opco ? [e.opco] : []) : [];
    if (!e || opcos.length === 0) {
      nonReferences.push(code);
      continue;
    }
    if (e.statut === 'partage') {
      avertissements.push(`IDCC ${code} (${e.titre}) : ${e.note ?? "convention répartie entre plusieurs OPCO selon l'activité"}.`);
    }
    for (const opco of opcos) {
      const liste = parOpco.get(opco) ?? [];
      liste.push({ idcc: code, titre: e.titre });
      parOpco.set(opco, liste);
    }
  }
  if (nonReferences.length > 0) {
    avertissements.push(`IDCC non référencé(s) dans notre table : ${nonReferences.join(', ')}.`);
  }

  const candidats: CandidatOpco[] = [...parOpco.entries()].map(([opcoSlug, idccs]) => ({ opcoSlug, idccs }));

  if (candidats.length === 1) {
    const c = candidats[0];
    return {
      opcoSlug: c.opcoSlug,
      certitude: 'fiable',
      motif: `Identifié via la convention collective ${c.idccs.map((i) => `IDCC ${i.idcc} (${i.titre})`).join(', ')}.`,
      candidats,
      idccRetenu: c.idccs[0].idcc,
      avertissements,
      urlVerificationOfficielle,
    };
  }

  if (candidats.length > 1) {
    const preselection = candidats.find((c) => c.idccs.some((i) => siege.has(i.idcc))) ?? candidats[0];
    return {
      opcoSlug: preselection.opcoSlug,
      certitude: 'a_confirmer',
      motif:
        'Plusieurs OPCO possibles selon les conventions collectives déclarées. Une entreprise relève en principe ' +
        "d'une seule convention, déterminée par son activité principale (sauf établissement autonome) : choisissez " +
        "celle de l'établissement du salarié concerné. Présélection : convention du siège.",
      candidats,
      idccRetenu: preselection.idccs.find((i) => siege.has(i.idcc))?.idcc ?? preselection.idccs[0].idcc,
      avertissements,
      urlVerificationOfficielle,
    };
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
  return (code && table[code]?.titre) || `Convention IDCC ${idcc}`;
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
