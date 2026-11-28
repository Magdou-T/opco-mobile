// ============================================================
// Métadonnées des pages : titre, description, adresse canonique, Open Graph et carte Twitter, en fonctions pures (tests :
// tests/metadonnees.test.ts). Les adresses portent la barre finale que le site sert (`trailingSlash`, export statique en
// dossiers) ; elles se résolvent sur `metadataBase` (layout.tsx). L'image de partage vient du fichier
// `opengraph-image.tsx` de chaque route (lib/image-de-partage.tsx) : Next.js l'ajoute à l'Open Graph et à la carte
// Twitter de la page. Ne pas déclarer d'image ici : une image de la configuration remplace celle du fichier.
// Longueurs visées : titre affiché de 65 caractères au plus (au-delà, Google le coupe), description de 155 au plus.
// ============================================================

import type { Metadata } from 'next';
import type { OpcoData } from '@opco/core';
import { dateFr, de } from './format';

/** Adresse du site en production, sans barre finale : base des adresses canoniques et du plan du site. */
export const ADRESSE_DU_SITE = 'https://www.financementopco.fr';

export const NOM_DU_SITE = 'financementopco';

/** Gabarit des titres : le nom du site suit le titre de la page (sauf `titreComplet`). */
export const GABARIT_DU_TITRE = `%s | ${NOM_DU_SITE}`;

export interface DescriptionDePage {
  /** Titre de la page, sans le nom du site. */
  titre: string;
  /** Description pour les moteurs de recherche et les aperçus de partage (155 caractères au plus). */
  description: string;
  /** Chemin de la page, barre finale comprise (« / », « /opco/akto/ »). */
  chemin: string;
  /** Titre affiché tel quel, sans « | financementopco » (l'accueil, dont le titre porte déjà le nom du site). */
  titreComplet?: boolean;
  /** Guide daté : date de sa dernière mise à jour (AAAA-MM-JJ). L'aperçu de partage devient un article daté. */
  modifieLe?: string;
}

/** Titre tel que l'onglet et les aperçus de partage l'affichent. */
export function titreAffiche({ titre, titreComplet = false }: Pick<DescriptionDePage, 'titre' | 'titreComplet'>): string {
  return titreComplet ? titre : GABARIT_DU_TITRE.replace('%s', titre);
}

/** Métadonnées complètes d'une page : titre, description, adresse canonique, Open Graph et carte Twitter. */
export function metadonnees(page: DescriptionDePage): Metadata {
  const { titre, description, chemin, titreComplet = false, modifieLe } = page;
  const affiche = titreAffiche(page);
  return {
    title: titreComplet ? { absolute: titre } : titre,
    description,
    alternates: { canonical: chemin },
    openGraph: {
      title: affiche,
      description,
      url: chemin,
      siteName: NOM_DU_SITE,
      locale: 'fr_FR',
      ...(modifieLe ? { type: 'article' as const, modifiedTime: modifieLe } : { type: 'website' as const }),
    },
    twitter: { card: 'summary_large_image', title: affiche, description },
  };
}

/** Date de la dernière revue des guides et des pages par profil. */
export const REVUE_DES_GUIDES = '2026-11-27';

/** Pages fixes du site. */
export const PAGES = {
  accueil: {
    titre: 'financementopco : trouvez tous les financements de votre formation',
    titreComplet: true,
    description:
      'Simulateur gratuit des financements de votre formation : OPCO, CPF, Région, France Travail, Agefiph, Europe. Montants indicatifs et sources officielles.',
    chemin: '/',
  },
  simulateur: {
    titre: 'Simulateur de financement de formation',
    description:
      'Estimez en 6 étapes le financement de votre formation : OPCO, CPF, Région, France Travail, Transitions Pro, Agefiph, Europe. Aides, montants et sources.',
    chemin: '/simulateur/',
  },
  comprendre: {
    titre: 'Comprendre les OPCO : rôle, rattachement, financements',
    description:
      "Les 11 opérateurs de compétences, le rattachement par IDCC et ce qu'ils financent en 2026 : plan de développement, alternance, période de reconversion.",
    chemin: '/comprendre-les-opco/',
    modifieLe: REVUE_DES_GUIDES,
  },
  obligations: {
    titre: 'Obligations formation des entreprises en 2026',
    description:
      "CUFPA, taxe d'apprentissage, entretien de parcours professionnel, abondement correctif : ce que votre entreprise verse et doit organiser en 2026.",
    chemin: '/obligations/',
    modifieLe: REVUE_DES_GUIDES,
  },
  formerSansBudget: {
    titre: 'Se former sans budget : actions collectives, CPF, FSE+',
    description:
      "Actions collectives des OPCO, CPF, période de reconversion, FSE+ : les leviers 2026 pour former sans entamer le budget formation de l'entreprise.",
    chemin: '/former-sans-budget/',
    modifieLe: REVUE_DES_GUIDES,
  },
  opco: {
    titre: 'Les 11 OPCO : fiches et barèmes 2026',
    description:
      'Fiches des 11 OPCO : secteurs couverts, plafonds de prise en charge 2026, frais annexes, actions collectives, conditions et sources officielles.',
    chemin: '/opco/',
  },
  quelOpco: {
    titre: "Quel est mon OPCO ? Le trouver avec l'IDCC",
    description:
      "Trouvez l'OPCO de votre entreprise : rattachement par la convention collective (IDCC), où lire l'IDCC, les 11 OPCO et leurs branches, sources officielles.",
    chemin: '/quel-est-mon-opco/',
    modifieLe: REVUE_DES_GUIDES,
  },
  employeurs: {
    titre: 'Employeur : financer la formation de vos salariés',
    description:
      "OPCO, plan de développement des compétences, alternance, POEI, Agefiph, Région : les financements 2026 de l'employeur selon la taille de l'entreprise.",
    chemin: '/employeurs/',
    modifieLe: REVUE_DES_GUIDES,
  },
  salaries: {
    titre: 'Salarié : faire financer votre formation',
    description:
      "CPF, plan de formation de l'employeur, projet de transition professionnelle, période de reconversion, VAE, bilan de compétences : vos droits en 2026.",
    chemin: '/salaries/',
    modifieLe: REVUE_DES_GUIDES,
  },
  demandeursEmploi: {
    titre: "Demandeur d'emploi : financer votre formation",
    description:
      'CPF, aide individuelle à la formation de France Travail, formations de la Région, POEI, Agefiph, rémunération : financer une formation sans emploi.',
    chemin: '/demandeurs-emploi/',
    modifieLe: REVUE_DES_GUIDES,
  },
  cpf: {
    titre: 'CPF 2026 : droits, reste à charge et démarches',
    description:
      'Compte personnel de formation en 2026 : droits acquis chaque année, plafonds, participation forfaitaire, abondements, formations éligibles et démarches.',
    chemin: '/cpf/',
    modifieLe: REVUE_DES_GUIDES,
  },
  alternance: {
    titre: 'Alternance 2026 : coût, aides et prise en charge OPCO',
    description:
      "Apprentissage et professionnalisation en 2026 : prise en charge par l'OPCO, aide à l'embauche, participation de l'employeur, salaire de l'alternant.",
    chemin: '/alternance/',
    modifieLe: REVUE_DES_GUIDES,
  },
  lexique: {
    titre: 'Lexique de la formation professionnelle',
    description:
      'CUFPA, IDCC, NPEC, PTP, AIF, POEI, AFEST, VAE : les sigles de la formation professionnelle et de son financement, expliqués en une ou deux phrases.',
    chemin: '/lexique/',
    modifieLe: REVUE_DES_GUIDES,
  },
  aPropos: {
    titre: 'Méthode et sources : comment nous vérifions',
    description:
      "Qui publie financementopco, d'où viennent les barèmes et les aides, comment chaque montant est vérifié et daté, et comment signaler une erreur.",
    chemin: '/a-propos/',
    modifieLe: REVUE_DES_GUIDES,
  },
  contact: {
    titre: 'Nous contacter',
    description:
      'Une question sur le financement de votre formation ou un dossier OPCO à monter ? Écrivez à contact@financementopco.fr : réponse sous 48 h ouvrées.',
    chemin: '/contact/',
  },
  mentions: {
    titre: 'Mentions légales et données',
    description:
      "Éditeur, directeur de la publication, hébergeur, données personnelles, sources et licences du site financementopco, édité par SFG Développement.",
    chemin: '/mentions-legales/',
  },
} as const satisfies Record<string, DescriptionDePage>;

/**
 * Fiche d'un OPCO (/opco/<slug>/) : titre et description tirés de ses données, date de vérification comprise. Le titre
 * commence par le nom de l'OPCO, les mots que l'on tape dans un moteur (« AKTO prise en charge 2026 »).
 */
export function descriptionDeFiche(opco: Pick<OpcoData, 'slug' | 'name' | 'derniere_verification'>): DescriptionDePage {
  const verification = opco.derniere_verification ? `, vérifiés le ${dateFr(opco.derniere_verification)}` : '';
  return {
    titre: `${opco.name} : barèmes et prise en charge 2026`,
    description: `Plafonds de prise en charge ${de(opco.name)} en 2026${verification} : coût horaire, budget annuel par taille, frais annexes, branches et sources.`,
    chemin: `/opco/${opco.slug}/`,
  };
}
