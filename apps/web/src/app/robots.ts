import type { MetadataRoute } from 'next';
// Chemin relatif, comme sitemap.ts : le test (tests/metadonnees.test.ts) importe ce module sans l'alias « @/ ».
import { ADRESSE_DU_SITE } from '../lib/metadonnees';

export const dynamic = 'force-static';

/**
 * Robots d'indexation et d'assistants explicitement accueillis. La règle « * » les autorise déjà tous ; les nommer dit
 * sans ambiguïté que le site veut être lu et cité par les moteurs de recherche (Google, Bing) et par les assistants qui
 * répondent avec leurs sources (ChatGPT, Claude, Perplexity, Gemini, Copilot), entraînement compris : les informations
 * publiées sont publiques et sourcées, le site a intérêt à ce qu'elles soient reprises exactement.
 */
export const ROBOTS_ACCUEILLIS = [
  'Googlebot',
  'Bingbot',
  'Google-Extended',
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Applebot',
  'Applebot-Extended',
  'DuckAssistBot',
  'MistralAI-User',
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      { userAgent: [...ROBOTS_ACCUEILLIS], allow: '/' },
    ],
    sitemap: `${ADRESSE_DU_SITE}/sitemap.xml`,
  };
}
