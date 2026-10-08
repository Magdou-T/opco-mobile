import type { MetadataRoute } from 'next';
// Chemin relatif, comme sitemap.ts : le test (tests/metadonnees.test.ts) importe ce module sans l'alias « @/ ».
import { ADRESSE_DU_SITE } from '../lib/metadonnees';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${ADRESSE_DU_SITE}/sitemap.xml`,
  };
}
