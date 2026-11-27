// ============================================================
// Données structurées Schema.org (JSON-LD) du site, en fonctions pures (tests : tests/donnees-structurees.test.ts).
//
// Un graphe par page : l'éditeur (SFG Développement) et le site sont décrits une fois, dans layout.tsx, et chaque page y
// renvoie par leur `@id`. Les moteurs (Google, Bing) et les assistants qui citent leurs sources lisent ainsi qui publie,
// de quoi parle la page, sa place dans le site (fil d'Ariane), sa date de mise à jour et ses questions fréquentes.
// Aucune donnée nouvelle : tout vient des métadonnées des pages, des mentions légales et des données des OPCO.
// Chemins relatifs (pas d'alias « @/ ») : les tests importent ce module directement.
// ============================================================

import { MENTIONS } from './mentions';
import { ADRESSE_DU_SITE, NOM_DU_SITE, PAGES } from './metadonnees';

/** Un nœud du graphe Schema.org. */
export type Noeud = Record<string, unknown>;

/** Graphe complet prêt à sérialiser. */
export interface Graphe {
  '@context': 'https://schema.org';
  '@graph': Noeud[];
}

export const ID_EDITEUR = `${ADRESSE_DU_SITE}/#editeur`;
export const ID_SITE = `${ADRESSE_DU_SITE}/#site`;

/** Adresse absolue d'un chemin du site (« /opco/akto/ » donne « https://www.financementopco.fr/opco/akto/ »). */
export function adresseAbsolue(chemin: string): string {
  return new URL(chemin, `${ADRESSE_DU_SITE}/`).toString();
}

/**
 * Adresse postale de l'éditeur, découpée pour Schema.org. Elle reprend `MENTIONS.editeur.adresseSiege` (« 20 avenue
 * Gabriel Péri, 95870 Bezons ») : un test vérifie que les deux disent la même chose.
 */
export const ADRESSE_EDITEUR = {
  rue: '20 avenue Gabriel Péri',
  codePostal: '95870',
  ville: 'Bezons',
} as const;

/** Téléphone de l'éditeur au format international, tiré de `MENTIONS.editeur.telephone` (« 01 82 41 02 41 »). */
export function telephoneInternational(telephone: string | null): string | undefined {
  if (!telephone) return undefined;
  const chiffres = telephone.replace(/\D/g, '');
  return /^0\d{9}$/.test(chiffres) ? `+33${chiffres.slice(1)}` : undefined;
}

/** L'éditeur du site : SFG Développement, identifié par son SIREN (code ISO 6523 0002 : répertoire SIRENE). */
export function noeudEditeur(): Noeud {
  const { editeur } = MENTIONS;
  const siren = editeur.siren?.replace(/\s/g, '');
  return {
    '@type': 'Organization',
    '@id': ID_EDITEUR,
    name: editeur.denomination,
    legalName: editeur.denomination,
    url: 'https://sfgdeveloppement.fr/',
    logo: {
      '@type': 'ImageObject',
      url: adresseAbsolue('/logo-sfg.png'),
      width: 426,
      height: 224,
    },
    email: editeur.courriel ?? undefined,
    telephone: telephoneInternational(editeur.telephone),
    address: {
      '@type': 'PostalAddress',
      streetAddress: ADRESSE_EDITEUR.rue,
      postalCode: ADRESSE_EDITEUR.codePostal,
      addressLocality: ADRESSE_EDITEUR.ville,
      addressCountry: 'FR',
    },
    ...(siren ? { iso6523Code: `0002:${siren}` } : {}),
    areaServed: { '@type': 'Country', name: 'France' },
    knowsAbout: [
      'Financement de la formation professionnelle',
      'Opérateurs de compétences (OPCO)',
      'Compte personnel de formation (CPF)',
      'Alternance',
      'Plan de développement des compétences',
    ],
  };
}

/** Le site financementOPCO, publié par l'éditeur. */
export function noeudSite(): Noeud {
  return {
    '@type': 'WebSite',
    '@id': ID_SITE,
    url: `${ADRESSE_DU_SITE}/`,
    name: NOM_DU_SITE,
    alternateName: 'financementopco.fr',
    description: PAGES.accueil.description,
    inLanguage: 'fr-FR',
    publisher: { '@id': ID_EDITEUR },
  };
}

/** Graphe commun à toutes les pages (layout.tsx) : l'éditeur et le site. */
export function grapheDuSite(): Graphe {
  return { '@context': 'https://schema.org', '@graph': [noeudEditeur(), noeudSite()] };
}

/** Une étape du fil d'Ariane. */
export interface Etape {
  nom: string;
  chemin: string;
}

/** Fil d'Ariane : l'accueil, les étapes intermédiaires, puis la page elle-même. */
export function noeudFilDAriane(chemin: string, nom: string, intermediaires: readonly Etape[] = []): Noeud {
  const etapes: Etape[] = [{ nom: 'Accueil', chemin: '/' }, ...intermediaires, { nom, chemin }];
  return {
    '@type': 'BreadcrumbList',
    '@id': `${adresseAbsolue(chemin)}#fil-ariane`,
    itemListElement: etapes.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: e.nom,
      item: adresseAbsolue(e.chemin),
    })),
  };
}

/** Une question fréquente et sa réponse, en texte simple (la page affiche les mêmes mots). */
export interface QuestionReponse {
  question: string;
  reponse: string;
}

/** Bloc FAQPage : les questions affichées sur la page, avec leurs réponses. */
export function noeudFaq(chemin: string, questions: readonly QuestionReponse[]): Noeud {
  return {
    '@type': 'FAQPage',
    '@id': `${adresseAbsolue(chemin)}#questions`,
    isPartOf: { '@id': `${adresseAbsolue(chemin)}#page` },
    inLanguage: 'fr-FR',
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.reponse },
    })),
  };
}

export type TypeDePage = 'WebPage' | 'CollectionPage' | 'AboutPage' | 'ContactPage' | 'Article';

export interface DescriptionStructuree {
  chemin: string;
  /** Titre de la page sans le nom du site. */
  titre: string;
  description: string;
  /** « Article » pour un guide : la page porte alors un nœud Article (auteur, dates) en plus du nœud WebPage. */
  type?: TypeDePage;
  /** Nom court de la page dans le fil d'Ariane (par défaut : le titre). */
  nomCourt?: string;
  /** Étapes du fil d'Ariane entre l'accueil et la page. */
  intermediaires?: readonly Etape[];
  /** Dernière mise à jour du contenu (AAAA-MM-JJ). */
  modifieLe?: string;
  /** Première publication (AAAA-MM-JJ). */
  publieLe?: string;
  /** Ce dont parle la page (un OPCO, un dispositif). */
  sujet?: Noeud | Noeud[];
  /** Questions fréquentes affichées sur la page. */
  questions?: readonly QuestionReponse[];
  /** Autres nœuds propres à la page (application, liste de termes). */
  autres?: Noeud[];
}

/** Graphe d'une page : WebPage (ou CollectionPage…), fil d'Ariane, Article d'un guide, FAQ, nœuds propres. */
export function grapheDePage(d: DescriptionStructuree): Graphe {
  const url = adresseAbsolue(d.chemin);
  const idPage = `${url}#page`;
  const estArticle = d.type === 'Article';
  const page: Noeud = {
    '@type': estArticle ? 'WebPage' : (d.type ?? 'WebPage'),
    '@id': idPage,
    url,
    name: d.titre,
    description: d.description,
    inLanguage: 'fr-FR',
    isPartOf: { '@id': ID_SITE },
    publisher: { '@id': ID_EDITEUR },
    breadcrumb: { '@id': `${url}#fil-ariane` },
    ...(d.modifieLe ? { dateModified: d.modifieLe } : {}),
    ...(d.publieLe ? { datePublished: d.publieLe } : {}),
    ...(d.sujet ? { about: d.sujet } : {}),
  };
  const noeuds: Noeud[] = [page, noeudFilDAriane(d.chemin, d.nomCourt ?? d.titre, d.intermediaires)];
  if (estArticle) {
    noeuds.push({
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: d.titre,
      description: d.description,
      inLanguage: 'fr-FR',
      mainEntityOfPage: { '@id': idPage },
      author: { '@id': ID_EDITEUR },
      publisher: { '@id': ID_EDITEUR },
      image: adresseAbsolue('/logo-sfg.png'),
      ...(d.modifieLe ? { dateModified: d.modifieLe } : {}),
      ...(d.publieLe ? { datePublished: d.publieLe } : {}),
      ...(d.sujet ? { about: d.sujet } : {}),
    });
  }
  if (d.questions && d.questions.length > 0) noeuds.push(noeudFaq(d.chemin, d.questions));
  if (d.autres) noeuds.push(...d.autres);
  return { '@context': 'https://schema.org', '@graph': noeuds };
}

/**
 * Sérialisation pour une balise <script type="application/ld+json"> : le chevron ouvrant est échappé (« < »),
 * aucune chaîne des données ne peut fermer la balise. Les clés à valeur `undefined` disparaissent (JSON.stringify).
 */
export function serialiser(graphe: Graphe): string {
  const echappement = `${String.fromCharCode(92)}u003c`;
  return JSON.stringify(graphe).replace(/</g, echappement);
}
