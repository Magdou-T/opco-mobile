import type { MetadataRoute } from 'next';
import { EMBEDDED_OPCOS } from '@opco/core';
// Chemins relatifs : le test du plan du site (tests/mentions.test.ts) importe ce module sans l'alias « @/ ».
import { verificationLaPlusRecente } from '../lib/format';
import { LIEN_MENTIONS } from '../lib/mentions';
import { ADRESSE_DU_SITE, PAGES } from '../lib/metadonnees';

export const dynamic = 'force-static';

/** Vérification la plus récente des barèmes des 11 OPCO : date de mise à jour du répertoire et du simulateur. */
const BAREMES = verificationLaPlusRecente(EMBEDDED_OPCOS);

/**
 * Plan du site : chaque adresse avec sa barre finale, celle que le site sert (`trailingSlash`, export statique en
 * dossiers) ; sans elle, Apache répond par une redirection 301. `lastModified` est la date de la dernière vérification
 * du contenu (revue d'un guide, vérification des barèmes d'un OPCO), jamais la date du build : Google et Bing s'en
 * servent pour recrawler en priorité ce qui a vraiment changé.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const datees: { chemin: string; modifieLe?: string; priorite: number }[] = [
    { chemin: PAGES.accueil.chemin, modifieLe: BAREMES, priorite: 1 },
    { chemin: PAGES.simulateur.chemin, modifieLe: BAREMES, priorite: 0.9 },
    { chemin: PAGES.employeurs.chemin, modifieLe: PAGES.employeurs.modifieLe, priorite: 0.9 },
    { chemin: PAGES.salaries.chemin, modifieLe: PAGES.salaries.modifieLe, priorite: 0.9 },
    { chemin: PAGES.demandeursEmploi.chemin, modifieLe: PAGES.demandeursEmploi.modifieLe, priorite: 0.9 },
    { chemin: PAGES.cpf.chemin, modifieLe: PAGES.cpf.modifieLe, priorite: 0.9 },
    { chemin: PAGES.quelOpco.chemin, modifieLe: PAGES.quelOpco.modifieLe, priorite: 0.9 },
    { chemin: PAGES.alternance.chemin, modifieLe: PAGES.alternance.modifieLe, priorite: 0.8 },
    { chemin: PAGES.comprendre.chemin, modifieLe: PAGES.comprendre.modifieLe, priorite: 0.8 },
    { chemin: PAGES.obligations.chemin, modifieLe: PAGES.obligations.modifieLe, priorite: 0.8 },
    { chemin: PAGES.formerSansBudget.chemin, modifieLe: PAGES.formerSansBudget.modifieLe, priorite: 0.8 },
    { chemin: PAGES.opco.chemin, modifieLe: BAREMES, priorite: 0.8 },
    { chemin: PAGES.lexique.chemin, modifieLe: PAGES.lexique.modifieLe, priorite: 0.6 },
    { chemin: PAGES.aPropos.chemin, modifieLe: PAGES.aPropos.modifieLe, priorite: 0.5 },
    { chemin: PAGES.contact.chemin, priorite: 0.5 },
    { chemin: LIEN_MENTIONS.href, priorite: 0.3 },
  ];

  const fixes = datees.map((p) => ({
    url: `${ADRESSE_DU_SITE}${p.chemin}`,
    ...(p.modifieLe ? { lastModified: p.modifieLe } : {}),
    changeFrequency: 'monthly' as const,
    priority: p.priorite,
  }));

  const fiches = EMBEDDED_OPCOS.map((o) => ({
    url: `${ADRESSE_DU_SITE}/opco/${o.slug}/`,
    ...(o.derniere_verification ? { lastModified: o.derniere_verification } : {}),
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [...fixes, ...fiches];
}
