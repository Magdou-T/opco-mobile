import type { MetadataRoute } from 'next';
import { ALL_OPCOS } from '../../data/opcos';

export const dynamic = 'force-static';

const BASE = 'https://www.financementopco.fr';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    '',
    '/simulateur',
    '/comprendre-les-opco',
    '/obligations',
    '/former-sans-budget',
    '/opco',
    '/contact',
  ].map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: 'monthly' as const,
    priority: path === '' ? 1 : 0.8,
  }));

  const opcoPages = ALL_OPCOS.map((o) => ({
    url: `${BASE}/opco/${o.slug}`,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...opcoPages];
}
