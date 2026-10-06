// ============================================================
// Lecture d'un résultat de l'API publique recherche-entreprises
// (https://recherche-entreprises.api.gouv.fr) : établissements, région,
// effectif, NAF, IDCC et statuts. Fonction pure : aucun appel réseau ici.
// ============================================================

import { departementDuCodePostal, estCodeRegion, regionDuDepartement } from './geo';
import { normaliserIdcc } from './opco-resolver';
import type { CodeRegion, CompanySize, TypeStructure } from './types';

export interface EtablissementInfo {
  siret: string;
  estSiege: boolean;
  codePostal: string;
  commune: string;
  departement: string | null;
  region: CodeRegion | null;
  idccs: string[];
}

export interface EntrepriseInfo {
  siren: string;
  nom: string;
  codeNaf: string | null;
  categorie: string | null;
  natureJuridique: string | null;
  /** Code de tranche d'effectif INSEE (null si inconnu). */
  trancheEffectif: string | null;
  anneeTrancheEffectif: string | null;
  tailleSuggeree: CompanySize | null;
  structures: TypeStructure[];
  estEntrepreneurIndividuel: boolean;
  siege: EtablissementInfo;
  etablissements: EtablissementInfo[];
  /** Tous les IDCC (entreprise et établissements), sans doublon. */
  idccs: string[];
  idccSiege: string[];
}

/** Libellés des tranches d'effectif salarié INSEE. */
export const TRANCHES_EFFECTIF_INSEE: Record<string, string> = {
  '00': '0 salarié',
  '01': '1 ou 2 salariés',
  '02': '3 à 5 salariés',
  '03': '6 à 9 salariés',
  '11': '10 à 19 salariés',
  '12': '20 à 49 salariés',
  '21': '50 à 99 salariés',
  '22': '100 à 199 salariés',
  '31': '200 à 249 salariés',
  '32': '250 à 499 salariés',
  '41': '500 à 999 salariés',
  '42': '1 000 à 1 999 salariés',
  '51': '2 000 à 4 999 salariés',
  '52': '5 000 à 9 999 salariés',
  '53': '10 000 salariés et plus',
};

/** Taille suggérée d'après la tranche INSEE ; null si la tranche chevauche deux tailles (10-19, 250-499). */
export function tailleDepuisTranche(tranche: string | null): CompanySize | null {
  switch (tranche) {
    case '00':
    case '01':
    case '02':
    case '03':
      return 'less_11';
    case '12':
      return '11_49';
    case '21':
    case '22':
    case '31':
      return '50_299';
    case '41':
    case '42':
    case '51':
    case '52':
    case '53':
      return '300_plus';
    default:
      return null;
  }
}

const texte = (v: unknown): string => (v == null ? '' : String(v));
const texteOuNull = (v: unknown): string | null => {
  const s = texte(v).trim();
  return s ? s : null;
};

function idccsDe(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const codes: string[] = [];
  for (const brut of v) {
    const code = normaliserIdcc(String(brut));
    if (code && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

function etablissementDepuis(raw: Record<string, unknown> | undefined, siege: boolean): EtablissementInfo {
  const r = raw ?? {};
  const codePostal = texte(r.code_postal);
  const departement = texteOuNull(r.departement) ?? departementDuCodePostal(codePostal);
  const regionBrute = texteOuNull(r.region);
  return {
    siret: texte(r.siret),
    estSiege: r.est_siege === true || siege,
    codePostal,
    commune: texte(r.libelle_commune),
    departement,
    region: estCodeRegion(regionBrute) ? regionBrute : regionDuDepartement(departement),
    idccs: idccsDe(r.liste_idcc),
  };
}

export function parseResultatRechercheEntreprises(raw: Record<string, unknown>): EntrepriseInfo {
  const complements = (raw.complements as Record<string, unknown> | undefined) ?? {};
  const siegeBrut = raw.siege as Record<string, unknown> | undefined;
  const siege = etablissementDepuis(siegeBrut, true);
  const matching = Array.isArray(raw.matching_etablissements)
    ? (raw.matching_etablissements as Record<string, unknown>[])
    : [];
  const etablissements = matching.map((e) => etablissementDepuis(e, false));

  const idccs: string[] = [];
  for (const code of [...idccsDe(complements.liste_idcc), ...siege.idccs, ...etablissements.flatMap((e) => e.idccs)]) {
    if (!idccs.includes(code)) idccs.push(code);
  }

  const trancheBrute = texteOuNull(raw.tranche_effectif_salarie) ?? texteOuNull(siegeBrut?.tranche_effectif_salarie);
  const tranche = trancheBrute === 'NN' ? null : trancheBrute;

  const structures: TypeStructure[] = [];
  if (complements.est_ess === true) structures.push('ess');
  if (complements.est_siae === true) structures.push('siae');
  if (complements.est_association === true) structures.push('association');

  return {
    siren: texte(raw.siren),
    nom: texte(raw.nom_complet || raw.nom_raison_sociale),
    codeNaf: texteOuNull(raw.activite_principale),
    categorie: texteOuNull(raw.categorie_entreprise),
    natureJuridique: texteOuNull(raw.nature_juridique),
    trancheEffectif: tranche,
    anneeTrancheEffectif: texteOuNull(raw.annee_tranche_effectif_salarie),
    tailleSuggeree: tailleDepuisTranche(tranche),
    structures,
    estEntrepreneurIndividuel: complements.est_entrepreneur_individuel === true,
    siege,
    etablissements,
    idccs,
    idccSiege: siege.idccs.length > 0 ? siege.idccs : (etablissements.find((e) => e.estSiege)?.idccs ?? []),
  };
}
