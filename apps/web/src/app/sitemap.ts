import type { MetadataRoute } from 'next';
import { EMBEDDED_OPCOS } from '@opco/core';
// Chemins relatifs : le test du plan du site (tests/mentions.test.ts) importe ce module sans l'alias « @/ ».
import { LIEN_MENTIONS } from '../lib/mentions';
import { ADRESSE_DU_SITE } from '../lib/metadonnees';

export const dynamic = 'force-static';

/**
 * Plan du site : chaque adresse avec sa barre finale, celle que le site sert (`trailingSlash`, export statique en
 * dossiers) ; sans elle, Apache répond par une redirection 301.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    '/',
    '/simulateur/',
    '/comprendre-les-opco/',
    '/obligations/',
    '/former-sans-budget/',
    '/opco/',
    '/contact/',
    LIEN_MENTIONS.href,
  ].map((path) => ({
    url: `${ADRESSE_DU_SITE}${path}`,
    changeFrequency: 'monthly' as const,
    priority: path === '/' ? 1 : path === LIEN_MENTIONS.href ? 0.3 : 0.8,
  }));

  const opcoPages = EMBEDDED_OPCOS.map((o) => ({
    url: `${ADRESSE_DU_SITE}/opco/${o.slug}/`,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...opcoPages];
}
