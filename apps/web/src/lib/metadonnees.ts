// ============================================================
// Métadonnées des pages : titre, description, adresse canonique, Open Graph et carte Twitter, en fonctions pures (tests :
// tests/metadonnees.test.ts). Les adresses portent la barre finale que le site sert (`trailingSlash`, export statique en
// dossiers) ; elles se résolvent sur `metadataBase` (layout.tsx). Aucune image de partage : le site n'en publie pas.
// ============================================================

import type { Metadata } from 'next';
import type { OpcoData } from '@opco/core';
import { dateFr, de } from './format';

/** Adresse du site en production, sans barre finale : base des adresses canoniques et du plan du site. */
export const ADRESSE_DU_SITE = 'https://www.financementopco.fr';

export const NOM_DU_SITE = 'financementOPCO';

/** Gabarit des titres : le nom du site suit le titre de la page (sauf `titreComplet`). */
export const GABARIT_DU_TITRE = `%s | ${NOM_DU_SITE}`;

export interface DescriptionDePage {
  /** Titre de la page, sans le nom du site. */
  titre: string;
  /** Description pour les moteurs de recherche et les aperçus de partage (160 caractères environ). */
  description: string;
  /** Chemin de la page, barre finale comprise (« / », « /opco/akto/ »). */
  chemin: string;
  /** Titre affiché tel quel, sans « | financementOPCO » (l'accueil, dont le titre porte déjà le nom du site). */
  titreComplet?: boolean;
}

/** Titre tel que l'onglet et les aperçus de partage l'affichent. */
export function titreAffiche({ titre, titreComplet = false }: Pick<DescriptionDePage, 'titre' | 'titreComplet'>): string {
  return titreComplet ? titre : GABARIT_DU_TITRE.replace('%s', titre);
}

/** Métadonnées complètes d'une page : titre, description, adresse canonique, Open Graph et carte Twitter (sans image). */
export function metadonnees(page: DescriptionDePage): Metadata {
  const { titre, description, chemin, titreComplet = false } = page;
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
      type: 'website',
    },
    twitter: { card: 'summary', title: affiche, description },
  };
}

/** Pages fixes du site. */
export const PAGES = {
  accueil: {
    titre: 'financementOPCO : trouvez tous les financements de votre formation',
    titreComplet: true,
    description:
      'Simulateur gratuit des financements de votre formation : OPCO, CPF, Région, France Travail, Agefiph, Europe. Montants indicatifs, sources officielles et guides.',
    chemin: '/',
  },
  simulateur: {
    titre: 'Simulateur de financement : trouvez toutes vos aides',
    description:
      'Estimez en 6 étapes le financement de votre formation : OPCO, CPF, Région, France Travail, Transitions Pro, Agefiph, Europe… Aides éligibles, montants, démarches et sources.',
    chemin: '/simulateur/',
  },
  comprendre: {
    titre: 'Comprendre les OPCO : rôle, rattachement, financements',
    description:
      "Qui sont les 11 opérateurs de compétences, comment votre entreprise est rattachée au sien, et ce qu'ils peuvent financer en 2026 : plan de développement des compétences, alternance, période de reconversion, VAE.",
    chemin: '/comprendre-les-opco/',
  },
  obligations: {
    titre: 'Obligations formation des entreprises en 2026',
    description:
      "CUFPA, taxe d'apprentissage, entretien de parcours professionnel, abondement correctif de 3 000 € : ce que votre entreprise doit verser et organiser en 2026, taux exacts et sources officielles.",
    chemin: '/obligations/',
  },
  formerSansBudget: {
    titre: 'Se former sans budget : actions collectives, CPF, FSE+',
    description:
      "Actions collectives des OPCO, CPF, période de reconversion, et cofinancement FSE+ quand votre OPCO en ouvre un : les leviers 2026 pour former sans consommer l'enveloppe de l'entreprise.",
    chemin: '/former-sans-budget/',
  },
  opco: {
    titre: 'Les 11 OPCO : fiches, barèmes et dispositifs 2026',
    description:
      'Fiches détaillées des 11 opérateurs de compétences : secteurs couverts, plafonds de financement 2026, frais annexes, actions collectives et conditions de prise en charge.',
    chemin: '/opco/',
  },
  contact: {
    titre: 'Nous contacter',
    description:
      'Une question sur le financement de votre formation, un projet à monter avec votre OPCO ? Écrivez à SFG Développement : réponse sous 48 h ouvrées.',
    chemin: '/contact/',
  },
  mentions: {
    titre: 'Mentions légales et données',
    description:
      "Éditeur, directeur de la publication, hébergeur, données personnelles, sources et licences du site financementOPCO, un service de SFG Développement.",
    chemin: '/mentions-legales/',
  },
} as const satisfies Record<string, DescriptionDePage>;

/** Fiche d'un OPCO (/opco/<slug>/) : titre et description tirés de ses données, date de vérification comprise. */
export function descriptionDeFiche(opco: Pick<OpcoData, 'slug' | 'name' | 'derniere_verification'>): DescriptionDePage {
  const verification = opco.derniere_verification ? ` vérifiés le ${dateFr(opco.derniere_verification)}` : '';
  return {
    titre: `${opco.name} : barèmes de financement 2026, conditions, dispositifs`,
    description: `Barèmes de prise en charge 2026 ${de(opco.name)}${verification} : plafonds horaires, budgets annuels, frais annexes, barèmes par branche, dispositifs complémentaires et alertes, avec sources officielles.`,
    chemin: `/opco/${opco.slug}/`,
  };
}
