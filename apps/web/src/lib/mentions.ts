// ============================================================
// Mentions légales et information sur les données (page /mentions-legales/), en données typées. Un champ `null` attend
// une information que seul l'éditeur peut fournir : la page l'écrit entre crochets (« [à compléter : capital social] ») et
// signale en tête qu'elle est incomplète tant qu'il en reste (`mentionsIncompletes`). Aucune donnée légale n'est devinée :
// sont préremplis les faits publics du répertoire SIRENE (API Recherche d'entreprises, relus le 08/10/2026 : SIREN, SIRET
// et adresse du siège, nature juridique 5710) et ce que l'éditeur publie lui-même sur son site (voir `MENTIONS`), à
// confirmer sur l'extrait Kbis. Module sans dépendance (tests : tests/mentions.test.ts). Voir apps/web/DESIGN.md, section 16.
// ============================================================

import { INSECABLE } from './insecable';

/** Une information légale : le texte publié, ou null tant que l'éditeur ne l'a pas fournie. */
export type Champ = string | null;

export interface MentionsLegales {
  editeur: {
    denomination: Champ;
    formeJuridique: Champ;
    capitalSocial: Champ;
    siren: Champ;
    siretSiege: Champ;
    adresseSiege: Champ;
    /** Ville du greffe du tribunal de commerce où la société est immatriculée au RCS. */
    villeRcs: Champ;
    tvaIntracommunautaire: Champ;
    courriel: Champ;
    telephone: Champ;
  };
  directeurPublication: {
    nom: Champ;
    fonction: Champ;
  };
  /** Hébergeur du site (indice à vérifier dans le tableau de bord de l'hébergement : Hostinger International Ltd, Chypre). */
  hebergeur: {
    denomination: Champ;
    adresse: Champ;
    telephone: Champ;
  };
  donnees: {
    /** Base légale du traitement des messages de contact (RGPD, article 6). */
    baseLegaleContact: Champ;
    dureeConservationContact: Champ;
    /** Adresse (électronique ou postale) où exercer ses droits sur ses données. */
    adresseExerciceDroits: Champ;
    /** Facultatif : écrire « non désigné » si l'éditeur n'en a pas. */
    delegueProtectionDonnees: Champ;
  };
}

/** Les informations publiées. Le contrôleur remplace chaque `null` par l'information fournie par l'éditeur. */
// Valeurs de l'éditeur reprises de ses propres pages publiques (conditions générales de vente et politique de
// confidentialité de sfgdeveloppement.fr, relues le 09/10/2026) : capital, greffe, téléphone, exonération de TVA,
// coordonnées pour exercer ses droits, durée de conservation, absence de délégué. L'hébergeur est celui du sous-domaine
// qui porte l'application (OVHcloud, comme le site WordPress) : identité et adresse de la notice officielle d'OVH
// (ovhcloud.com/fr/terms-and-conditions/), qui ne donne pas de numéro de téléphone. Ce qui n'est écrit nulle part (directeur
// de la publication, téléphone de l'hébergeur) reste à `null`, donc « à compléter » sur la page.
export const MENTIONS: MentionsLegales = {
  editeur: {
    denomination: 'SFG Développement',
    formeJuridique: 'Société par actions simplifiée (SAS)',
    capitalSocial: `500${INSECABLE}€`,
    siren: '814 739 728',
    siretSiege: '814 739 728 00024',
    adresseSiege: '20 avenue Gabriel Péri, 95870 Bezons',
    villeRcs: 'Pontoise',
    tvaIntracommunautaire: 'Exonération de TVA (article 261-4-4° du CGI)',
    courriel: 'contact@sfgdeveloppement.fr',
    telephone: ['01', '82', '41', '02', '41'].join(INSECABLE),
  },
  directeurPublication: {
    nom: null,
    fonction: null,
  },
  hebergeur: {
    denomination: 'OVH SAS (OVHcloud)',
    adresse: '2 rue Kellermann, 59100 Roubaix',
    telephone: null,
  },
  donnees: {
    baseLegaleContact: "Intérêt légitime de répondre à votre demande (article 6, paragraphe 1, point f, du RGPD)",
    dureeConservationContact: `3${INSECABLE}ans à compter du dernier contact`,
    adresseExerciceDroits:
      'contact@sfgdeveloppement.fr, ou par courrier : DPO / Référent protection des données, SFG Développement, 20 avenue Gabriel Péri, 95870 Bezons',
    delegueProtectionDonnees:
      'Non désigné. Un référent à la protection des données traite les demandes, aux coordonnées ci-dessus.',
  },
};

type Groupe = keyof MentionsLegales;

/** Libellé de chaque champ, dans l'ordre de la page : il nomme aussi ce qui reste à compléter. */
export const LIBELLES_DES_CHAMPS: { [G in Groupe]: { [C in keyof MentionsLegales[G]]: string } } = {
  editeur: {
    denomination: 'dénomination',
    formeJuridique: 'forme juridique',
    capitalSocial: 'capital social',
    siren: 'SIREN',
    siretSiege: 'SIRET du siège',
    adresseSiege: 'adresse du siège',
    villeRcs: 'ville du greffe (RCS)',
    tvaIntracommunautaire: 'numéro de TVA intracommunautaire',
    courriel: 'adresse électronique',
    telephone: 'téléphone',
  },
  directeurPublication: {
    nom: 'nom du directeur de la publication',
    fonction: 'fonction du directeur de la publication',
  },
  hebergeur: {
    denomination: "dénomination exacte de l'hébergeur",
    adresse: "adresse de l'hébergeur",
    telephone: "téléphone de l'hébergeur",
  },
  donnees: {
    baseLegaleContact: 'base légale du traitement des messages de contact',
    dureeConservationContact: 'durée de conservation des messages de contact',
    adresseExerciceDroits: "adresse d'exercice des droits",
    delegueProtectionDonnees: 'délégué à la protection des données (facultatif)',
  },
};

/** Un champ à compléter : son chemin (« editeur.capitalSocial ») et son libellé. */
interface ChampACompleter {
  champ: string;
  libelle: string;
}

/** Champs encore vides (`null`), dans l'ordre de la page. Liste vide : la page est complète. */
export function mentionsIncompletes(mentions: MentionsLegales = MENTIONS): ChampACompleter[] {
  const vides: ChampACompleter[] = [];
  for (const groupe of Object.keys(LIBELLES_DES_CHAMPS) as Groupe[]) {
    const libelles = LIBELLES_DES_CHAMPS[groupe] as Record<string, string>;
    const valeurs = mentions[groupe] as Record<string, Champ>;
    for (const [champ, libelle] of Object.entries(libelles)) {
      if (valeurs[champ] == null) vides.push({ champ: `${groupe}.${champ}`, libelle });
    }
  }
  return vides;
}

/** Texte d'un champ vide : « [à compléter : capital social] » (espace insécable avant le deux-points). */
export function aCompleter(libelle: string): string {
  return `[à compléter${INSECABLE}: ${libelle}]`;
}

/** Rubriques de la page, dans l'ordre (sommaire et sections). */
export const RUBRIQUES_MENTIONS = [
  { id: 'editeur', titre: 'Éditeur' },
  { id: 'publication', titre: 'Directeur de la publication' },
  { id: 'hebergement', titre: 'Hébergement' },
  { id: 'donnees', titre: 'Données personnelles' },
  { id: 'sources', titre: 'Sources et licences' },
  { id: 'limites', titre: 'Limites des estimations' },
] as const;

/** Adresse de la page (barre finale, comme toutes les adresses du site) et libellé du lien du pied de page. */
export const LIEN_MENTIONS = { href: '/mentions-legales/', libelle: 'Mentions légales et données' } as const;

/**
 * Attribution des données des entreprises (licence ouverte 2.0), sous les résultats de la recherche d'entreprise et
 * sur la carte de l'entreprise choisie.
 */
export const SOURCE_ENTREPRISES = `Source${INSECABLE}: API Recherche d'entreprises (DINUM), données SIRENE de l'INSEE, licence ouverte 2.0.`;

/**
 * Table SIRET-OPCO de France compétences (données ouvertes) : les suggestions d'OPCO par code NAF de @opco/core en
 * sont tirées (parts observées sur un échantillon d'établissements ; méthode et date : spécification, section 5.5).
 * L'adresse est celle que porte chaque suggestion (champ `source`) ; un test le vérifie.
 */
export const TABLE_SIRET_OPCO = {
  adresse: 'https://www.data.gouv.fr/datasets/table-siret-opco',
  miseAJour: '24/09/2026',
} as const;

/** Mention courte, sous le motif de la carte de l'OPCO, quand l'OPCO présélectionné vient du code NAF. */
export const SOURCE_SUGGESTION_NAF = `Source de la suggestion${INSECABLE}: Table SIRET-OPCO de France compétences (data.gouv.fr), licence ouverte 2.0, mise à jour du ${TABLE_SIRET_OPCO.miseAJour}.`;
